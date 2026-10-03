// Password-manager imports are parsed entirely on this device; this module makes no network calls.
const { DOMParser } = require('@xmldom/xmldom');
const yauzl = require('yauzl');
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_ARCHIVE_BYTES = 50 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES = 1000;
const MAX_ARCHIVE_UNCOMPRESSED_BYTES = 50 * 1024 * 1024;
const MAX_COMPRESSION_RATIO = 100;
const MAX_ROWS = 50000;
const MAX_FILENAME_LENGTH = 255;

function importError(message, code = 'INVALID_IMPORT') {
  const error = new Error(message);
  error.code = code;
  return error;
}

function validateImportRequest(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    throw importError('Invalid import request.');
  }
  const { fileName, content } = request;
  if (typeof fileName !== 'string' || fileName.length === 0 || fileName.length > MAX_FILENAME_LENGTH) {
    throw importError('The import filename is invalid.');
  }
  if (typeof content !== 'string' && !(content instanceof Uint8Array)) {
    throw importError('The import file must contain text or bytes.');
  }
  const byteLength = typeof content === 'string' ? Buffer.byteLength(content, 'utf8') : content.byteLength;
  const zipBytes = typeof content === 'string' ? Buffer.from(content, 'binary') : Buffer.from(content);
  const isZip = isZipContent(zipBytes);
  if (byteLength > (isZip ? MAX_ARCHIVE_BYTES : MAX_FILE_BYTES)) {
    throw importError(isZip ? '1Password archives must be 50 MB or smaller.' : 'Files must be 10 MB or smaller.');
  }
  if (request.formatOverride !== undefined &&
      ![
        'generic-csv', 'chrome-csv', 'bitwarden-json', 'bitwarden-csv',
        'onepassword-1pux', 'onepassword-csv', 'keepass-xml', 'keepass-csv'
      ].includes(request.formatOverride)) {
    throw importError('The selected import format is invalid.');
  }
}

function isZipContent(buffer) {
  return buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b &&
    ((buffer[2] === 0x03 && buffer[3] === 0x04) ||
      (buffer[2] === 0x05 && buffer[3] === 0x06) ||
      (buffer[2] === 0x07 && buffer[3] === 0x08));
}

function getImportBuffer(content) {
  return typeof content === 'string' ? Buffer.from(content, 'utf8') : Buffer.from(content);
}

function detectVantaLockBackup(content) {
  const trimmed = content.trimStart();
  if (!trimmed.startsWith('{')) return false;
  let data;
  try {
    data = JSON.parse(content);
  } catch (_error) {
    return false;
  }
  return Boolean(data && typeof data === 'object' && !Array.isArray(data) && (
    (data.cipher === 'AES-256-GCM' && data.kdf === 'Argon2id' && data.encryptedData) ||
    (data.formatVersion === 1 && Array.isArray(data.entries))
  ));
}

function countDelimiter(record, delimiter) {
  let quoted = false;
  let count = 0;
  for (let index = 0; index < record.length; index++) {
    const char = record[index];
    if (char === '"') {
      if (quoted && record[index + 1] === '"') index++;
      else quoted = !quoted;
    } else if (!quoted && char === delimiter) {
      count++;
    }
  }
  return count;
}

function detectDelimiter(content) {
  let firstRecordEnd = content.length;
  let quoted = false;
  for (let index = 0; index < content.length; index++) {
    const char = content[index];
    if (char === '"') {
      if (quoted && content[index + 1] === '"') index++;
      else quoted = !quoted;
    } else if (!quoted && (char === '\n' || char === '\r')) {
      firstRecordEnd = index;
      break;
    }
  }
  const firstRecord = content.slice(0, firstRecordEnd);
  const candidates = [',', ';', '\t'];
  return candidates.reduce((best, candidate) =>
    countDelimiter(firstRecord, candidate) > countDelimiter(firstRecord, best)
      ? candidate
      : best
  , ',');
}

function parseCsvRecords(content, delimiter) {
  const records = [];
  let record = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < content.length; index++) {
    const char = content[index];
    if (quoted) {
      if (char === '"' && content[index + 1] === '"') {
        field += '"';
        index++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"' && field.length === 0) {
      quoted = true;
    } else if (char === delimiter) {
      record.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      record.push(field);
      records.push(record);
      record = [];
      field = '';
      if (char === '\r' && content[index + 1] === '\n') index++;
    } else {
      field += char;
    }
  }
  if (quoted) throw importError('The CSV contains an unclosed quoted field.');
  if (field.length > 0 || record.length > 0) {
    record.push(field);
    records.push(record);
  }
  return records;
}

function parseGenericCsv(content) {
  const normalized = content.replace(/^\uFEFF/, '');
  const records = parseCsvRecords(normalized, detectDelimiter(normalized));
  const skippedItems = [];
  const nonEmptyRecords = records.filter(record => {
    const empty = record.every(value => value.trim() === '');
    if (empty) skippedItems.push({ reason: 'Empty row' });
    return !empty;
  });
  if (nonEmptyRecords.length === 0) {
    throw importError('The CSV file does not contain a header row.');
  }

  const rawHeaders = nonEmptyRecords.shift();
  const headers = [];
  const seenHeaders = new Map();
  rawHeaders.forEach((rawHeader, index) => {
    const label = rawHeader.trim() || `Column ${index + 1}`;
    const occurrence = (seenHeaders.get(label) || 0) + 1;
    seenHeaders.set(label, occurrence);
    headers.push(occurrence === 1 ? label : `${label} (${occurrence})`);
  });

  const dataRecords = nonEmptyRecords;
  if (dataRecords.length > MAX_ROWS) {
    throw importError('Files may contain no more than 50,000 rows.');
  }
  const widestRecord = Math.max(headers.length, ...dataRecords.map(record => record.length));
  while (headers.length < widestRecord) {
    let label = `Column ${headers.length + 1}`;
    while (headers.includes(label)) label = `Extra ${label}`;
    headers.push(label);
  }
  const rows = dataRecords.map(record => {
    return Object.fromEntries(headers.map((header, index) => [
      header,
      typeof record[index] === 'string' ? record[index] : ''
    ]));
  });
  return { headers, rows, skippedItems };
}

function detectCsvFormat(headers) {
  const normalized = new Set(headers.map(header =>
    String(header).trim().toLocaleLowerCase().replace(/[^a-z0-9]/g, '')
  ));
  const bitwardenHeaders = ['type', 'name', 'loginuri', 'loginusername', 'loginpassword'];
  if (bitwardenHeaders.every(header => normalized.has(header))) return 'bitwarden-csv';
  const chromeHeaders = ['name', 'url', 'username', 'password', 'note'];
  if (chromeHeaders.every(header => normalized.has(header))) return 'chrome-csv';
  const hasTitle = normalized.has('title') || normalized.has('account');
  const hasLoginFields = (normalized.has('username') || normalized.has('loginname')) &&
    normalized.has('password');
  const hasWebsite = normalized.has('url') || normalized.has('website');
  if (normalized.has('title') && normalized.has('username') && normalized.has('password') &&
      hasWebsite && (normalized.has('otpauth') || normalized.has('type'))) return 'onepassword-csv';
  if (hasTitle &&
      (normalized.has('username') || normalized.has('loginname')) &&
      normalized.has('password') &&
      (normalized.has('group') || normalized.has('account') || normalized.has('loginname') ||
        normalized.has('comments') || normalized.has('website'))) return 'keepass-csv';
  if (normalized.has('title') && normalized.has('username') && normalized.has('password') && hasWebsite) {
    return 'onepassword-csv';
  }
  if (hasTitle && hasLoginFields) return 'keepass-csv';
  return 'generic-csv';
}

function stringValue(value) {
  return typeof value === 'string' ? value : '';
}

function normalizeBitwardenRows(records, getItem) {
  const headers = ['name', 'url', 'username', 'password', 'notes'];
  const rows = [];
  const skippedItems = [];
  records.forEach(record => {
    const item = getItem(record);
    if (item.skipReason) {
      skippedItems.push({ reason: item.skipReason });
      if (item.hasTotp) skippedItems.push({ reason: 'One-time-code secret is not stored' });
      return;
    }
    if (item.hasTotp) skippedItems.push({ reason: 'One-time-code secret is not stored' });
    rows.push({
      name: item.name,
      url: item.url,
      username: item.username,
      password: item.password,
      notes: item.notes
    });
  });
  return { headers, rows, skippedItems };
}

function parseBitwardenJson(content) {
  let data;
  try {
    data = JSON.parse(content);
  } catch (_error) {
    throw importError('The Bitwarden JSON file is invalid.');
  }
  if (data && typeof data === 'object' && !Array.isArray(data) && data.encrypted === true) {
    throw importError('Export an unencrypted JSON from Bitwarden and try again');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data) || !Array.isArray(data.items)) {
    throw importError('This is not a supported Bitwarden JSON export.');
  }
  if (data.items.length > MAX_ROWS) {
    throw importError('Files may contain no more than 50,000 rows.');
  }
  return {
    format: 'bitwarden-json',
    ...normalizeBitwardenRows(data.items, item => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return { skipReason: 'Malformed Bitwarden item is not supported yet.' };
      }
      const type = item.type;
      const login = item.login && typeof item.login === 'object' && !Array.isArray(item.login)
        ? item.login
        : {};
      const firstUri = Array.isArray(login.uris) && login.uris[0] &&
        typeof login.uris[0] === 'object' && !Array.isArray(login.uris[0])
        ? login.uris[0].uri
        : '';
      const hasTotp = Boolean(stringValue(login.totp));
      if (type === 3) {
        return { skipReason: 'Payment cards are not supported yet.', hasTotp };
      }
      if (type === 4) {
        return { skipReason: 'Identities are not supported yet.', hasTotp };
      }
      if (type !== 1 && type !== 2) {
        return { skipReason: 'This Bitwarden item type is not supported yet.', hasTotp };
      }
      if (Array.isArray(item.attachments) && item.attachments.length > 0) {
        return { skipReason: 'Attachments are not supported yet.', hasTotp };
      }
      return {
        name: stringValue(item.name),
        url: stringValue(firstUri),
        username: type === 1 ? stringValue(login.username) : '',
        password: type === 1 ? stringValue(login.password) : '',
        notes: stringValue(item.notes),
        hasTotp
      };
    })
  };
}

function parseBitwardenCsv(parsedCsv) {
  const findHeader = wanted => parsedCsv.headers.find(header =>
    String(header).trim().toLocaleLowerCase().replace(/[^a-z0-9]/g, '') === wanted
  );
  const header = {
    type: findHeader('type'),
    name: findHeader('name'),
    url: findHeader('loginuri'),
    username: findHeader('loginusername'),
    password: findHeader('loginpassword'),
    notes: findHeader('notes'),
    totp: findHeader('logintotp')
  };
  if (!header.type || !header.name || !header.url || !header.username || !header.password) {
    throw importError('The Bitwarden CSV is missing required login columns.');
  }
  return {
    format: 'bitwarden-csv',
    ...normalizeBitwardenRows(parsedCsv.rows, row => {
      const type = stringValue(row[header.type]).toLocaleLowerCase();
      const hasTotp = Boolean(header.totp && stringValue(row[header.totp]));
      if (type === 'card') return { skipReason: 'Payment cards are not supported yet.', hasTotp };
      if (type === 'identity') return { skipReason: 'Identities are not supported yet.', hasTotp };
      if (type !== 'login' && type !== 'note') {
        return { skipReason: 'This Bitwarden item type is not supported yet.', hasTotp };
      }
      return {
        name: stringValue(row[header.name]),
        url: stringValue(row[header.url]),
        username: type === 'login' ? stringValue(row[header.username]) : '',
        password: type === 'login' ? stringValue(row[header.password]) : '',
        notes: stringValue(row[header.notes]),
        hasTotp
      };
    })
  };
}

function normalizeCollection(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];
  return Object.values(value);
}

function normalizeOnePasswordRows(items) {
  if (items.length > MAX_ROWS) throw importError('Files may contain no more than 50,000 rows.');
  const headers = ['title', 'url', 'username', 'password', 'notes'];
  const rows = [];
  const skippedItems = [];
  const normalize = value => String(value || '').toLocaleLowerCase().replace(/[^a-z0-9]/g, '');
  items.forEach(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      skippedItems.push({ reason: 'Malformed 1Password item is not supported yet.' });
      return;
    }
    if (item.archived === true || item.trashed === true || item.state === 'archived' || item.state === 'trashed') {
      skippedItems.push({ reason: 'Archived or trashed entries were skipped.' });
      return;
    }
    const overview = item.overview && typeof item.overview === 'object' && !Array.isArray(item.overview)
      ? item.overview
      : {};
    const details = item.details && typeof item.details === 'object' && !Array.isArray(item.details)
      ? item.details
      : {};
    const category = normalize(overview.category || item.category || item.type);
    const loginFields = Array.isArray(details.loginFields) ? details.loginFields : [];
    const isCard = category.includes('creditcard') || category === 'card' || category.includes('paymentcard');
    const isIdentity = category.includes('identity');
    if (isCard || isIdentity) {
      skippedItems.push({ reason: isCard
        ? 'Payment cards are not supported yet.'
        : 'Identities are not supported yet.' });
      return;
    }
    if (Array.isArray(item.files) && item.files.length > 0 ||
        Array.isArray(item.attachments) && item.attachments.length > 0) {
      skippedItems.push({ reason: 'Attachments are not supported yet.' });
      return;
    }
    const values = Object.create(null);
    let hasTotp = false;
    loginFields.forEach(field => {
      if (!field || typeof field !== 'object' || Array.isArray(field)) return;
      const designation = normalize(field.designation || field.label || field.name);
      if (['totp', 'otp', 'oneTimePassword', 'oneTimeCode'].map(normalize).includes(designation)) {
        if (typeof field.value === 'string' && field.value) hasTotp = true;
        return;
      }
      if (designation === 'username' || designation === 'password') {
        values[designation] = typeof field.value === 'string' ? field.value : '';
      }
    });
    if (hasTotp) skippedItems.push({ reason: 'One-time-code secret is not stored' });
    const notes = typeof details.notesPlain === 'string' ? details.notesPlain : '';
    const name = typeof overview.title === 'string' ? overview.title : '';
    const url = typeof overview.url === 'string' ? overview.url : '';
    const isLogin = Boolean(values.username || values.password || loginFields.length || category === 'login');
    const isNote = Boolean(notes) || category.includes('securenote') || category === 'note';
    if (!isLogin && !isNote) {
      skippedItems.push({ reason: 'This 1Password item type is not supported yet.' });
      return;
    }
    rows.push({
      title: name,
      url,
      username: values.username || '',
      password: values.password || '',
      notes
    });
  });
  return { headers, rows, skippedItems };
}

function parseOnePasswordJson(content) {
  let data;
  try {
    data = JSON.parse(content);
  } catch (_error) {
    throw importError('The 1Password export data is not valid JSON.');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw importError('The 1Password export data has an unsupported structure.');
  }
  const items = [];
  normalizeCollection(data.accounts).forEach(account => {
    if (!account || typeof account !== 'object' || Array.isArray(account)) return;
    normalizeCollection(account.vaults).forEach(vault => {
      if (!vault || typeof vault !== 'object' || Array.isArray(vault)) return;
      items.push(...normalizeCollection(vault.items));
    });
  });
  return { format: 'onepassword-1pux', ...normalizeOnePasswordRows(items) };
}

function parseOnePasswordCsv(parsedCsv) {
  const normalize = value => String(value).trim().toLocaleLowerCase().replace(/[^a-z0-9]/g, '');
  const findHeader = names => parsedCsv.headers.find(header => names.includes(normalize(header)));
  const header = {
    title: findHeader(['title']),
    url: findHeader(['url', 'website']),
    username: findHeader(['username']),
    password: findHeader(['password']),
    notes: findHeader(['notes']),
    otp: findHeader(['otpauth']),
    type: findHeader(['type'])
  };
  if (!header.title || !header.username || !header.password) {
    throw importError('The 1Password CSV is missing required login columns.');
  }
  const rows = [];
  const skippedItems = parsedCsv.skippedItems.slice();
  parsedCsv.rows.forEach(row => {
    const category = header.type ? normalize(row[header.type]) : '';
    const otpValue = header.otp ? row[header.otp] : '';
    if (otpValue) skippedItems.push({ reason: 'One-time-code secret is not stored' });
    if (category.includes('card')) {
      skippedItems.push({ reason: 'Payment cards are not supported yet.' });
      return;
    }
    if (category.includes('identity')) {
      skippedItems.push({ reason: 'Identities are not supported yet.' });
      return;
    }
    if (category && !['login', 'password', 'note', 'securenote'].includes(category)) {
      skippedItems.push({ reason: 'This 1Password item type is not supported yet.' });
      return;
    }
    rows.push({
      title: row[header.title] || '',
      url: header.url ? row[header.url] || '' : '',
      username: row[header.username] || '',
      password: row[header.password] || '',
      notes: header.notes ? row[header.notes] || '' : ''
    });
  });
  return { format: 'onepassword-csv', headers: ['title', 'url', 'username', 'password', 'notes'], rows, skippedItems };
}

function readZipEntry(zipfile, entry) {
  return new Promise((resolve, reject) => {
    zipfile.openReadStream(entry, (error, stream) => {
      if (error) return reject(importError('The 1Password export data could not be read.'));
      const chunks = [];
      let length = 0;
      stream.on('data', chunk => {
        length += chunk.length;
        if (length > MAX_ARCHIVE_UNCOMPRESSED_BYTES) {
          stream.destroy(importError('1Password archives may not exceed 50 MB uncompressed.'));
          return;
        }
        chunks.push(chunk);
      });
      stream.on('error', () => reject(importError('The 1Password export data could not be read.')));
      stream.on('end', () => resolve(Buffer.concat(chunks, length).toString('utf8')));
    });
  });
}

function parseOnePasswordArchive(buffer) {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, {
      lazyEntries: true,
      decodeStrings: true,
      validateEntrySizes: true
    }, (openError, zipfile) => {
      if (openError || !zipfile) {
        reject(importError('The 1Password archive is invalid or corrupted.'));
        return;
      }
      let fileCount = 0;
      let totalUncompressed = 0;
      let totalCompressed = 0;
      let dataEntry = null;
      let failed = false;
      const skippedItems = [];
      const fail = error => {
        if (failed) return;
        failed = true;
        zipfile.close();
        reject(error);
      };
      zipfile.on('error', () => fail(importError('The 1Password archive is invalid or corrupted.')));
      zipfile.on('entry', entry => {
        const isDirectory = entry.fileName.endsWith('/');
        if (!isDirectory) {
          fileCount++;
          totalUncompressed += entry.uncompressedSize;
          totalCompressed += entry.compressedSize;
          if (fileCount > MAX_ARCHIVE_ENTRIES) {
            fail(importError('1Password archives may contain no more than 1,000 files.'));
            return;
          }
          if (totalUncompressed > MAX_ARCHIVE_UNCOMPRESSED_BYTES) {
            fail(importError('1Password archives may not exceed 50 MB uncompressed.'));
            return;
          }
          if ((entry.uncompressedSize > 0 &&
              (entry.compressedSize === 0 || entry.uncompressedSize > entry.compressedSize * MAX_COMPRESSION_RATIO)) ||
              (totalUncompressed > totalCompressed * MAX_COMPRESSION_RATIO)) {
            fail(importError('The 1Password archive exceeds the 100:1 compression ratio limit.'));
            return;
          }
          if (entry.fileName.split('/').pop().toLocaleLowerCase() === 'export.data') {
            if (dataEntry) {
              fail(importError('The 1Password archive contains multiple export.data files.'));
              return;
            }
            dataEntry = entry;
          } else {
            skippedItems.push({ reason: '1Password archive attachment was skipped.' });
          }
        }
        zipfile.readEntry();
      });
      zipfile.on('end', async () => {
        if (failed) return;
        if (!dataEntry) {
          fail(importError('The 1Password archive does not contain export.data.'));
          return;
        }
        try {
          const json = await readZipEntry(zipfile, dataEntry);
          const parsed = parseOnePasswordJson(json);
          resolve({
            ...parsed,
            skippedItems: parsed.skippedItems.concat(skippedItems)
          });
        } catch (error) {
          fail(error);
        }
      });
      zipfile.readEntry();
    });
  });
}

function isKdbxContent(buffer) {
  return buffer.length >= 8 &&
    buffer[0] === 0x03 && buffer[1] === 0xd9 && buffer[2] === 0xa2 && buffer[3] === 0x9a &&
    buffer[4] === 0x67 && buffer[5] === 0xfb && buffer[6] === 0x4b && buffer[7] === 0xb5;
}

function parseKeePassCsv(parsedCsv) {
  return {
    format: 'keepass-csv',
    headers: parsedCsv.headers,
    rows: parsedCsv.rows,
    skippedItems: parsedCsv.skippedItems
  };
}

function parseKeePassXml(content) {
  if (/<!\s*(DOCTYPE|ENTITY)\b/i.test(content)) {
    throw importError('KeePass XML files containing DOCTYPE or entity declarations are not allowed.');
  }
  let document;
  let parseError = '';
  try {
    document = new DOMParser({
      onError(_level, message) {
        parseError = message;
      }
    }).parseFromString(content, 'application/xml');
  } catch (_error) {
    if (parseError) throw importError(`The KeePass XML file is malformed: ${parseError}`);
    throw importError('The KeePass XML file is malformed.');
  }
  if (parseError) throw importError(`The KeePass XML file is malformed: ${parseError}`);
  const root = document && document.documentElement;
  if (!root || root.nodeName !== 'KeePassFile') {
    throw importError('The XML file is not a KeePass 2.x export.');
  }

  const headers = ['title', 'url', 'username', 'password', 'notes'];
  const rows = [];
  const skippedItems = [];
  let entryCount = 0;
  const childrenNamed = (node, name) => Array.from(node.childNodes || [])
    .filter(child => child.nodeType === 1 && child.nodeName === name);
  const directChild = (node, name) => childrenNamed(node, name)[0] || null;
  const getValue = (entry, targetKey) => {
    for (const field of childrenNamed(entry, 'String')) {
      const key = directChild(field, 'Key');
      if (!key || key.textContent.trim().toLocaleLowerCase() !== targetKey.toLocaleLowerCase()) continue;
      const value = directChild(field, 'Value');
      return value ? value.textContent : '';
    }
    return '';
  };
  const isOtpKey = key => /(?:totp|otp|one[\s_-]*time[\s_-]*(?:code|password))/i.test(key);
  const visitGroup = (group, inRecycleBin) => {
    const name = directChild(group, 'Name');
    const recycleBin = inRecycleBin || Boolean(
      name && name.textContent.trim().toLocaleLowerCase() === 'recycle bin'
    );
    childrenNamed(group, 'Entry').forEach(entry => {
      entryCount++;
      if (entryCount > MAX_ROWS) throw importError('Files may contain no more than 50,000 rows.');
      if (recycleBin) {
        skippedItems.push({ reason: 'KeePass Recycle Bin entries were skipped.' });
        return;
      }
      if (childrenNamed(entry, 'Binary').length || childrenNamed(entry, 'Attachment').length) {
        skippedItems.push({ reason: 'Attachments are not supported yet.' });
        return;
      }
      const fields = Object.create(null);
      let hasTotp = false;
      childrenNamed(entry, 'String').forEach(field => {
        const keyNode = directChild(field, 'Key');
        const valueNode = directChild(field, 'Value');
        if (!keyNode || !valueNode) return;
        const key = keyNode.textContent.trim();
        const value = valueNode.textContent;
        if (isOtpKey(key)) {
          if (value) hasTotp = true;
          return;
        }
        const normalized = key.toLocaleLowerCase();
        if (['title', 'url', 'username', 'password', 'notes'].includes(normalized)) {
          fields[normalized] = value;
        }
      });
      if (hasTotp) skippedItems.push({ reason: 'One-time-code secret is not stored' });
      rows.push({
        title: fields.title || '',
        url: fields.url || '',
        username: fields.username || '',
        password: fields.password || '',
        notes: fields.notes || ''
      });
    });
    childrenNamed(group, 'Group').forEach(child => visitGroup(child, recycleBin));
  };
  const rootContainer = directChild(root, 'Root');
  if (!rootContainer) throw importError('The KeePass XML export is missing its Root element.');
  childrenNamed(rootContainer, 'Group').forEach(group => visitGroup(group, false));
  return { format: 'keepass-xml', headers, rows, skippedItems };
}

function parsePasswordImportFile(request) {
  validateImportRequest(request);
  const buffer = getImportBuffer(request.content);
  const zipContent = isZipContent(buffer);
  if (request.formatOverride === 'onepassword-1pux' || (!request.formatOverride && zipContent)) {
    if (!zipContent) throw importError('This is not a 1Password .1pux archive.');
    return parseOnePasswordArchive(buffer);
  }
  if (isKdbxContent(buffer)) {
    throw importError('Export your KeePass database as XML or CSV first');
  }
  let content = typeof request.content === 'string' ? request.content : '';
  if (!content) {
    try {
      content = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    } catch (_error) {
      throw importError('The selected file is not valid UTF-8 text or a supported archive.');
    }
  }
  if (detectVantaLockBackup(content)) {
    throw importError(
      'That looks like a VantaLock backup. Use the VantaLock backup option.',
      'VANTALOCK_BACKUP'
    );
  }
  const formatOverride = request.formatOverride;
  if (formatOverride === 'keepass-xml') return parseKeePassXml(content);
  if (formatOverride === 'keepass-csv') return parseKeePassCsv(parseGenericCsv(content));
  if (!formatOverride && content.replace(/^\uFEFF/, '').trimStart().startsWith('<')) {
    return parseKeePassXml(content);
  }
  if (formatOverride === 'onepassword-csv') {
    return parseOnePasswordCsv(parseGenericCsv(content));
  }
  if (formatOverride === 'bitwarden-json') return parseBitwardenJson(content);
  if (!formatOverride && content.trimStart().startsWith('{')) {
    let data;
    try {
      data = JSON.parse(content);
    } catch (_error) {
      // Non-JSON content is parsed as CSV below.
    }
    if (data && typeof data === 'object' && !Array.isArray(data) &&
        (Array.isArray(data.items) || data.encrypted === true)) {
      return parseBitwardenJson(content);
    }
  }
  const parsed = parseGenericCsv(content);
  const detectedFormat = detectCsvFormat(parsed.headers);
  if (formatOverride === 'bitwarden-csv' || (!formatOverride && detectedFormat === 'bitwarden-csv')) {
    return parseBitwardenCsv(parsed);
  }
  if (detectedFormat === 'onepassword-csv' && !formatOverride) {
    return parseOnePasswordCsv(parsed);
  }
  if (formatOverride === 'keepass-csv' || (!formatOverride && detectedFormat === 'keepass-csv')) {
    return parseKeePassCsv(parsed);
  }
  return {
    format: formatOverride || detectedFormat,
    ...parsed
  };
}

module.exports = {
  MAX_ARCHIVE_BYTES,
  MAX_ARCHIVE_ENTRIES,
  MAX_ARCHIVE_UNCOMPRESSED_BYTES,
  MAX_COMPRESSION_RATIO,
  MAX_FILE_BYTES,
  isKdbxContent,
  MAX_ROWS,
  detectDelimiter,
  detectCsvFormat,
  detectVantaLockBackup,
  parseBitwardenCsv,
  parseBitwardenJson,
  parseOnePasswordArchive,
  parseOnePasswordCsv,
  parseOnePasswordJson,
  parseKeePassCsv,
  parseKeePassXml,
  parseGenericCsv,
  parsePasswordImportFile,
  validateImportRequest
};

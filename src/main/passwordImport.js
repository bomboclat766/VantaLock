// Password-manager imports are parsed entirely on this device; this module makes no network calls.
const MAX_FILE_BYTES = 10 * 1024 * 1024;
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
  if (typeof content !== 'string') throw importError('The import file must contain text.');
  if (Buffer.byteLength(content, 'utf8') > MAX_FILE_BYTES) {
    throw importError('Files must be 10 MB or smaller.');
  }
  if (request.formatOverride !== undefined &&
      !['generic-csv', 'chrome-csv', 'bitwarden-json', 'bitwarden-csv'].includes(request.formatOverride)) {
    throw importError('The selected import format is invalid.');
  }
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
  return chromeHeaders.every(header => normalized.has(header)) ? 'chrome-csv' : 'generic-csv';
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

function parsePasswordImportFile(request) {
  validateImportRequest(request);
  if (detectVantaLockBackup(request.content)) {
    throw importError(
      'That looks like a VantaLock backup. Use the VantaLock backup option.',
      'VANTALOCK_BACKUP'
    );
  }
  const formatOverride = request.formatOverride;
  if (formatOverride === 'bitwarden-json') return parseBitwardenJson(request.content);
  if (!formatOverride && request.content.trimStart().startsWith('{')) {
    let data;
    try {
      data = JSON.parse(request.content);
    } catch (_error) {
      // Non-JSON content is parsed as CSV below.
    }
    if (data && typeof data === 'object' && !Array.isArray(data) &&
        (Array.isArray(data.items) || data.encrypted === true)) {
      return parseBitwardenJson(request.content);
    }
  }
  const parsed = parseGenericCsv(request.content);
  const detectedFormat = detectCsvFormat(parsed.headers);
  if (formatOverride === 'bitwarden-csv' || (!formatOverride && detectedFormat === 'bitwarden-csv')) {
    return parseBitwardenCsv(parsed);
  }
  return {
    format: formatOverride || detectedFormat,
    ...parsed
  };
}

module.exports = {
  MAX_FILE_BYTES,
  MAX_ROWS,
  detectDelimiter,
  detectCsvFormat,
  detectVantaLockBackup,
  parseBitwardenCsv,
  parseBitwardenJson,
  parseGenericCsv,
  parsePasswordImportFile,
  validateImportRequest
};

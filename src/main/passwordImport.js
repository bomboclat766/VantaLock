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

function parsePasswordImportFile(request) {
  validateImportRequest(request);
  if (detectVantaLockBackup(request.content)) {
    throw importError(
      'That looks like a VantaLock backup. Use the VantaLock backup option.',
      'VANTALOCK_BACKUP'
    );
  }
  return {
    format: 'generic-csv',
    ...parseGenericCsv(request.content)
  };
}

module.exports = {
  MAX_FILE_BYTES,
  MAX_ROWS,
  detectDelimiter,
  detectVantaLockBackup,
  parseGenericCsv,
  parsePasswordImportFile,
  validateImportRequest
};

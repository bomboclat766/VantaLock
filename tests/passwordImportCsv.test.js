const {
  MAX_FILE_BYTES,
  MAX_ROWS,
  parseGenericCsv,
  parsePasswordImportFile
} = require('../src/main/passwordImport');

describe('generic CSV password import parser', () => {
  test('parses quoted commas, escaped quotes, and embedded newlines', () => {
    const parsed = parseGenericCsv(
      'name,notes,password\r\n"Example, Inc.","said ""hello""\nand left",secret'
    );
    expect(parsed).toEqual({
      headers: ['name', 'notes', 'password'],
      rows: [{
        name: 'Example, Inc.',
        notes: 'said "hello"\nand left',
        password: 'secret'
      }],
      skippedItems: []
    });
  });

  test('accepts a UTF-8 BOM, CRLF and LF, ignores empty records, and pads ragged rows', () => {
    const parsed = parseGenericCsv('\uFEFFtitle,username,password\r\n\r\nExample,user\nShort,');
    expect(parsed.headers).toEqual(['title', 'username', 'password']);
    expect(parsed.rows).toEqual([
      { title: 'Example', username: 'user', password: '' },
      { title: 'Short', username: '', password: '' }
    ]);
    expect(parsed.skippedItems).toEqual([{ reason: 'Empty row' }]);
  });

  test.each([
    ['semicolon', 'name;url\nExample;https://example.test', 'https://example.test'],
    ['tab', 'name\turl\nExample\thttps://example.test', 'https://example.test']
  ])('detects %s delimiters', (_format, content, expectedUrl) => {
    const parsed = parseGenericCsv(content);
    expect(parsed.rows[0].url).toBe(expectedUrl);
  });

  test('detects Chrome CSV from case-insensitive content headers, not the filename', () => {
    const parsed = parsePasswordImportFile({
      fileName: 'manager-export.txt',
      content: 'NAME,Url,Username,Password,Note\nExample,https://example.test,alice,secret,memo'
    });
    expect(parsed.format).toBe('chrome-csv');
    expect(parsed.headers).toEqual(['NAME', 'Url', 'Username', 'Password', 'Note']);
    expect(parsed.rows[0]).toEqual({
      NAME: 'Example',
      Url: 'https://example.test',
      Username: 'alice',
      Password: 'secret',
      Note: 'memo'
    });
  });

  test('creates deterministic names for blank and duplicate headers', () => {
    const parsed = parseGenericCsv('name,name,\nfirst,second,third');
    expect(parsed.headers).toEqual(['name', 'name (2)', 'Column 3']);
    expect(parsed.rows[0]).toEqual({
      name: 'first',
      'name (2)': 'second',
      'Column 3': 'third'
    });
  });

  test('retains extra values in ragged rows under generated headers', () => {
    const parsed = parseGenericCsv('title\nExample,extra');
    expect(parsed.headers).toEqual(['title', 'Column 2']);
    expect(parsed.rows[0]).toEqual({ title: 'Example', 'Column 2': 'extra' });
  });

  test('rejects unclosed quoted fields', () => {
    expect(() => parseGenericCsv('title,notes\nExample,"unfinished')).toThrow(
      'The CSV contains an unclosed quoted field.'
    );
  });

  test('rejects VantaLock backups based on content with the prescribed message', () => {
    expect(() => parsePasswordImportFile({
      fileName: 'data.csv',
      content: JSON.stringify({
        cipher: 'AES-256-GCM',
        kdf: 'Argon2id',
        encryptedData: {}
      })
    })).toThrow('That looks like a VantaLock backup. Use the VantaLock backup option.');
  });

  test('validates IPC payload types, filename length, size, and row cap in the main process', () => {
    expect(() => parsePasswordImportFile(null)).toThrow('Invalid import request.');
    expect(() => parsePasswordImportFile({ fileName: 'x.csv', content: Buffer.from('x') }))
      .toThrow('The import file must contain text.');
    expect(() => parsePasswordImportFile({ fileName: 'x'.repeat(256), content: 'a,b' }))
      .toThrow('The import filename is invalid.');
    expect(() => parsePasswordImportFile({
      fileName: 'large.csv',
      content: 'x'.repeat(MAX_FILE_BYTES + 1)
    })).toThrow('Files must be 10 MB or smaller.');
    const tooManyRows = `title\n${Array.from({ length: MAX_ROWS + 1 }, () => 'item').join('\n')}`;
    expect(() => parsePasswordImportFile({ fileName: 'large.csv', content: tooManyRows }))
      .toThrow('Files may contain no more than 50,000 rows.');
  });
});

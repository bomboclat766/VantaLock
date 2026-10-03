const {
  MAX_ARCHIVE_BYTES,
  MAX_ARCHIVE_ENTRIES,
  MAX_ARCHIVE_UNCOMPRESSED_BYTES,
  MAX_FILE_BYTES,
  MAX_ROWS,
  parseGenericCsv,
  parsePasswordImportFile
} = require('../src/main/passwordImport');
const { createZip } = require('./helpers/zipFixture');

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

  test('detects Bitwarden JSON and extracts only login and secure note values', () => {
    const parsed = parsePasswordImportFile({
      fileName: 'not-json.csv',
      content: JSON.stringify({
        folders: [{ id: 'folder-a', name: 'Ignored folder' }],
        items: [
          {
            type: 1,
            name: 'Login',
            notes: 'safe note',
            login: {
              username: 'alice',
              password: 'secret',
              totp: 'otpauth://secret',
              uris: [{ uri: 'https://login.example.test' }]
            }
          },
          { type: 2, name: 'Secure memo', notes: 'note content' },
          { type: 3, name: 'Card', card: { number: 'never returned' } },
          { type: 4, name: 'Identity', identity: { ssn: 'never returned' } },
          { type: 1, name: 'Attachment login', attachments: [{ id: 'file-1' }] }
        ]
      })
    });
    expect(parsed.format).toBe('bitwarden-json');
    expect(parsed.headers).toEqual(['name', 'url', 'username', 'password', 'notes']);
    expect(parsed.rows).toEqual([
      {
        name: 'Login',
        url: 'https://login.example.test',
        username: 'alice',
        password: 'secret',
        notes: 'safe note'
      },
      { name: 'Secure memo', url: '', username: '', password: '', notes: 'note content' }
    ]);
    expect(parsed.skippedItems).toEqual([
      { reason: 'One-time-code secret is not stored' },
      { reason: 'Payment cards are not supported yet.' },
      { reason: 'Identities are not supported yet.' },
      { reason: 'Attachments are not supported yet.' }
    ]);
    expect(JSON.stringify(parsed)).not.toContain('otpauth://');
    expect(JSON.stringify(parsed)).not.toContain('never returned');
  });

  test('refuses encrypted Bitwarden JSON with the recovery instruction', () => {
    expect(() => parsePasswordImportFile({
      fileName: 'export.json',
      content: JSON.stringify({ encrypted: true, items: [] })
    })).toThrow('Export an unencrypted JSON from Bitwarden and try again');
  });

  test('detects and parses Bitwarden CSV by its header content', () => {
    const parsed = parsePasswordImportFile({
      fileName: 'anything.data',
      content: [
        'folder,favorite,type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp',
        'Work,false,login,Work login,remark,,0,https://work.test,alice,secret,otp-secret',
        'Personal,false,note,Memo,note body,,0,,,,',
        'Personal,false,card,Card,,,0,,,,'
      ].join('\n')
    });
    expect(parsed.format).toBe('bitwarden-csv');
    expect(parsed.rows).toEqual([
      { name: 'Work login', url: 'https://work.test', username: 'alice', password: 'secret', notes: 'remark' },
      { name: 'Memo', url: '', username: '', password: '', notes: 'note body' }
    ]);
    expect(parsed.skippedItems).toEqual([
      { reason: 'One-time-code secret is not stored' },
      { reason: 'Payment cards are not supported yet.' }
    ]);
    expect(JSON.stringify(parsed)).not.toContain('otp-secret');
  });

  test('detects 1Password CSV, omits OTPAuth, and reports unsupported categories', () => {
    const parsed = parsePasswordImportFile({
      fileName: 'export.txt',
      content: [
        'Title,Website,Username,Password,Notes,OTPAuth,Type',
        'Login,https://one.test,alice,secret,memo,otp-secret,Login',
        'Card,,,1234,,,"Credit Card"',
        'Secure memo,,,,note text,,Secure Note'
      ].join('\n')
    });
    expect(parsed.format).toBe('onepassword-csv');
    expect(parsed.rows).toEqual([
      { title: 'Login', url: 'https://one.test', username: 'alice', password: 'secret', notes: 'memo' },
      { title: 'Secure memo', url: '', username: '', password: '', notes: 'note text' }
    ]);
    expect(parsed.skippedItems).toEqual([
      { reason: 'One-time-code secret is not stored' },
      { reason: 'Payment cards are not supported yet.' }
    ]);
    expect(JSON.stringify(parsed)).not.toContain('otp-secret');
  });

  test('parses 1Password .1pux data and ignores archive attachments', async () => {
    const exportData = JSON.stringify({
      accounts: [{
        vaults: [{
          items: [
            {
              overview: { title: 'Synthetic Login', url: 'https://one.test', category: 'login' },
              details: {
                loginFields: [
                  { designation: 'username', value: 'alice' },
                  { designation: 'password', value: 'secret' },
                  { designation: 'totp', value: 'otp-secret' }
                ],
                notesPlain: 'memo'
              }
            },
            {
              overview: { title: 'Synthetic Note', category: 'SECURE_NOTE' },
              details: { notesPlain: 'note body' }
            },
            { overview: { title: 'Card', category: 'creditCard' }, details: {} },
            { overview: { title: 'Identity', category: 'identity' }, details: {} },
            { overview: { title: 'Old', category: 'login' }, archived: true, details: {} }
          ]
        }]
      }]
    });
    const archive = createZip([
      { name: 'export.data', data: exportData },
      { name: 'attachments/file.bin', data: 'ignored attachment' }
    ]);
    const parsed = await parsePasswordImportFile({
      fileName: 'disguised.bin',
      content: new Uint8Array(archive)
    });
    expect(parsed.format).toBe('onepassword-1pux');
    expect(parsed.rows).toEqual([
      {
        title: 'Synthetic Login',
        url: 'https://one.test',
        username: 'alice',
        password: 'secret',
        notes: 'memo'
      },
      { title: 'Synthetic Note', url: '', username: '', password: '', notes: 'note body' }
    ]);
    expect(parsed.skippedItems).toEqual([
      { reason: 'One-time-code secret is not stored' },
      { reason: 'Payment cards are not supported yet.' },
      { reason: 'Identities are not supported yet.' },
      { reason: 'Archived or trashed entries were skipped.' },
      { reason: '1Password archive attachment was skipped.' }
    ]);
    expect(JSON.stringify(parsed)).not.toContain('otp-secret');
  });

  test('rejects .1pux archives that exceed the entry, uncompressed-size, or ratio limits', async () => {
    const tooManyFiles = createZip(Array.from(
      { length: MAX_ARCHIVE_ENTRIES + 1 },
      (_value, index) => ({ name: `file-${index}.bin`, data: '' })
    ));
    await expect(parsePasswordImportFile({
      fileName: 'x.1pux',
      content: new Uint8Array(tooManyFiles)
    })).rejects.toThrow('1Password archives may contain no more than 1,000 files.');

    const oversizedEntry = createZip([{
      name: 'export.data',
      data: '{}',
      method: 8,
      uncompressedSize: MAX_ARCHIVE_UNCOMPRESSED_BYTES + 1
    }]);
    await expect(parsePasswordImportFile({
      fileName: 'x.1pux',
      content: new Uint8Array(oversizedEntry)
    })).rejects.toThrow('1Password archives may not exceed 50 MB uncompressed.');

    const ratioArchive = createZip([
      { name: 'export.data', data: '{}' },
      { name: 'attachment.bin', data: 'x'.repeat(20000), method: 8 }
    ]);
    await expect(parsePasswordImportFile({
      fileName: 'x.1pux',
      content: new Uint8Array(ratioArchive)
    })).rejects.toThrow('The 1Password archive exceeds the 100:1 compression ratio limit.');

    const oversizedArchive = new Uint8Array(MAX_ARCHIVE_BYTES + 1);
    oversizedArchive.set([0x50, 0x4b, 0x03, 0x04]);
    expect(() => parsePasswordImportFile({ fileName: 'x.1pux', content: oversizedArchive }))
      .toThrow('1Password archives must be 50 MB or smaller.');
  });

  test('detects KeePass CSV from tolerant account, login-name, and web-site headers', () => {
    const parsed = parsePasswordImportFile({
      fileName: 'renamed.txt',
      content: 'Group,Account,Login Name,Password,Web Site,Comments\nWork,Mailbox,alice,secret,https://mail.test,memo'
    });
    expect(parsed.format).toBe('keepass-csv');
    expect(parsed.rows[0]).toEqual({
      Group: 'Work',
      Account: 'Mailbox',
      'Login Name': 'alice',
      Password: 'secret',
      'Web Site': 'https://mail.test',
      Comments: 'memo'
    });
  });

  test('parses KeePass XML nested groups, skips Recycle Bin and attachments, and omits OTP values', () => {
    const xml = `<?xml version="1.0"?>
      <KeePassFile><Root><Group><Name>Root group</Name>
        <Entry>
          <String><Key>Title</Key><Value>Mailbox</Value></String>
          <String><Key>UserName</Key><Value>alice</Value></String>
          <String><Key>Password</Key><Value>secret</Value></String>
          <String><Key>URL</Key><Value>https://mail.test</Value></String>
          <String><Key>Notes</Key><Value>memo</Value></String>
          <String><Key>TOTP Seed</Key><Value>otp-secret</Value></String>
        </Entry>
        <Group><Name>Nested</Name>
          <Entry><String><Key>Title</Key><Value>Nested note</Value></String>
            <String><Key>Notes</Key><Value>note content</Value></String></Entry>
        </Group>
        <Group><Name>Recycle Bin</Name>
          <Entry><String><Key>Title</Key><Value>Deleted</Value></String></Entry>
        </Group>
        <Entry><String><Key>Title</Key><Value>Attachment entry</Value></String>
          <Binary><Key>file</Key><Value>blob</Value></Binary></Entry>
      </Group></Root></KeePassFile>`;
    const parsed = parsePasswordImportFile({ fileName: 'backup.data', content: xml });
    expect(parsed.format).toBe('keepass-xml');
    expect(parsed.rows).toEqual([
      {
        title: 'Mailbox',
        url: 'https://mail.test',
        username: 'alice',
        password: 'secret',
        notes: 'memo'
      },
      { title: 'Nested note', url: '', username: '', password: '', notes: 'note content' }
    ]);
    expect(parsed.skippedItems).toEqual([
      { reason: 'One-time-code secret is not stored' },
      { reason: 'Attachments are not supported yet.' },
      { reason: 'KeePass Recycle Bin entries were skipped.' }
    ]);
    expect(JSON.stringify(parsed)).not.toContain('otp-secret');
  });

  test('rejects KeePass XML containing a DOCTYPE or entity declaration', () => {
    const withDoctype = '<!DOCTYPE KeePassFile [<!ENTITY secret "value">]><KeePassFile/>';
    const withEntity = '<!ENTITY secret "value"><KeePassFile/>';
    expect(() => parsePasswordImportFile({
      fileName: 'not-xml.xml',
      content: withDoctype
    })).toThrow('KeePass XML files containing DOCTYPE or entity declarations are not allowed.');
    expect(() => parsePasswordImportFile({
      fileName: 'not-xml.xml',
      content: withEntity
    })).toThrow('KeePass XML files containing DOCTYPE or entity declarations are not allowed.');
  });

  test('rejects malformed KeePass XML', () => {
    expect(() => parsePasswordImportFile({
      fileName: 'broken.xml',
      content: '<KeePassFile><Root></KeePassFile>'
    })).toThrow('The KeePass XML file is malformed.');
  });

  test('refuses KeePass KDBX by binary content, independent of filename', () => {
    const kdbx = new Uint8Array([0x03, 0xd9, 0xa2, 0x9a, 0x67, 0xfb, 0x4b, 0xb5]);
    expect(() => parsePasswordImportFile({
      fileName: 'mystery.bin',
      content: kdbx
    })).toThrow('Export your KeePass database as XML or CSV first');
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
    expect(() => parsePasswordImportFile({ fileName: 'x.csv', content: {} }))
      .toThrow('The import file must contain text or bytes.');
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

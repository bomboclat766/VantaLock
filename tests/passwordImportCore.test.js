const {
  buildPreview,
  createHeaderMapping,
  createVaultEntries,
  persistImport
} = require('../src/renderer/passwordImportCore');

describe('password import mapping and preview', () => {
  test('guesses standard headers and allows mappings to be overridden', () => {
    const mapping = createHeaderMapping(['Name', 'Website', 'Login Email', 'Pass', 'Extra']);
    expect(mapping).toEqual({
      Name: 'title',
      Website: 'website',
      'Login Email': 'username',
      Pass: 'password',
      Extra: 'notes'
    });
    mapping['Login Email'] = 'ignore';
    expect(mapping['Login Email']).toBe('ignore');
  });

  test('creates logins with passwords, notes without passwords, and URL-host title fallback', () => {
    const parsed = {
      headers: ['title', 'url', 'username', 'password', 'notes'],
      rows: [
        { title: 'Example', url: 'https://example.test/sign-in', username: 'alice', password: 'secret', notes: 'login note' },
        { title: '', url: 'https://notes.test/path', username: 'bob', password: '', notes: 'note text' }
      ],
      skippedItems: [{ reason: 'Empty row' }]
    };
    const preview = buildPreview(parsed, {
      title: 'title',
      url: 'website',
      username: 'username',
      password: 'password',
      notes: 'notes'
    });
    expect(preview.emptyRowsSkipped).toBe(1);
    expect(preview.entries).toEqual([
      {
        type: 'login',
        typeName: 'Login / Password',
        title: 'Example',
        fields: {
          site_name: 'Example',
          url: 'https://example.test/sign-in',
          username: 'alice',
          password: 'secret'
        },
        notes: 'login note'
      },
      {
        type: 'note',
        typeName: 'Secure Note',
        title: 'notes.test',
        fields: {
          title: 'notes.test',
          content: 'Username: bob\nWebsite: https://notes.test/path\nNotes: note text'
        }
      }
    ]);
  });

  test('skips nonempty rows without title or a valid website host', () => {
    const preview = buildPreview({
      rows: [{ username: 'alice', password: 'secret' }],
      skippedItems: []
    }, { Username: 'username', Password: 'password' });
    expect(preview.entries).toEqual([]);
    expect(preview.skippedItems).toEqual([{ reason: 'No title or valid website host' }]);
  });

  test('creates same-schema entries in the selected compartment with timestamps', () => {
    const entries = createVaultEntries([{
      type: 'login',
      typeName: 'Login / Password',
      title: 'Example',
      fields: { username: 'alice', password: 'secret' }
    }, {
      type: 'note',
      typeName: 'Secure Note',
      title: 'Note',
      fields: { title: 'Note', content: 'Text' }
    }], 'personal', () => 1700000000000);
    expect(entries[0]).toMatchObject({
      id: '1700000000000',
      vault: 'personal',
      type: 'login',
      title: 'Example',
      notes: '',
      fields: { username: 'alice', password: 'secret' }
    });
    expect(entries[0].createdAt).toMatch(/^\d{4}-\d\d-\d\dT/);
    expect(entries[1].id).not.toBe(entries[0].id);
  });

  test('persists only after confirmation, enforces the entry limit, and leaves entries unchanged on failure', () => {
    const existing = [{ id: 'existing' }];
    const imported = [{ id: 'new' }];
    const persist = jest.fn(() => true);
    expect(persistImport(existing, imported, persist)).toEqual([...existing, ...imported]);
    expect(persist).toHaveBeenCalledTimes(1);
    expect(() => persistImport(existing, imported, () => false))
      .toThrow('Import could not be saved. Your vault was not changed.');
    expect(existing).toEqual([{ id: 'existing' }]);
    expect(() => persistImport(existing, Array.from({ length: 5001 }, () => ({})), persist))
      .toThrow('This import would exceed the 5,000-entry limit.');
  });
});

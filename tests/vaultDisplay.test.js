const { getEntriesForVault } = require('../src/renderer/authFlow');
const {
  MODE_KEY,
  normalizeMode,
  searchEntries
} = require('../src/renderer/vaultDisplay');

describe('Vault display preferences and active-vault search', () => {
  test('defaults invalid display settings to Card view', () => {
    expect(MODE_KEY).toBe('vantalock_entry_display_mode');
    expect(normalizeMode('card')).toBe('card');
    expect(normalizeMode('list')).toBe('list');
    expect(normalizeMode('table')).toBe('table');
    expect(normalizeMode('unknown')).toBe('card');
  });

  test('searches entry titles, nicknames, and field values case-insensitively', () => {
    const entries = [
      {
        id: 'card-1',
        vault: 'financial',
        title: 'Travel Card',
        typeName: 'Payment Card',
        fields: { cardholder_name: 'Avery Example', card_number: '4000 1234 5678 9012' }
      },
      {
        id: 'login-1',
        vault: 'personal',
        title: 'Mail',
        nickname: 'Private inbox',
        typeName: 'Login',
        fields: { url: 'https://mail.example.test' }
      }
    ];

    expect(searchEntries(entries, 'PRIVATE')).toEqual([{
      id: 'login-1',
      title: 'Mail',
      vault: 'personal',
      typeName: 'Login'
    }]);
    expect(searchEntries(entries, '9012').map(entry => entry.id)).toEqual(['card-1']);
    expect(searchEntries(entries, '   ')).toEqual([]);
    expect(searchEntries(entries, 'https://mail')).toHaveLength(1);
  });

  test('a decoy-vault search cannot return or inspect real-vault entries', () => {
    const realEntries = [{
      id: 'real-secret',
      vault: 'financial',
      title: 'Real Private Reserve',
      fields: { password: 'real-secret-field-value' }
    }];
    const decoyEntries = [{
      id: 'decoy-entry',
      vault: 'financial',
      title: 'Harmless Display Account',
      fields: { username: 'decoy-only-value' }
    }];
    const createDecoyEntries = jest.fn(() => decoyEntries);
    const activeEntries = getEntriesForVault('decoy', realEntries, decoyEntries, createDecoyEntries);

    expect(searchEntries(activeEntries, 'real')).toEqual([]);
    expect(searchEntries(activeEntries, 'real-secret-field-value')).toEqual([]);
    expect(searchEntries(activeEntries, 'decoy-only-value')).toEqual([{
      id: 'decoy-entry',
      title: 'Harmless Display Account',
      vault: 'financial',
      typeName: 'Entry'
    }]);
    expect(createDecoyEntries).not.toHaveBeenCalled();
    expect(realEntries).toEqual([{
      id: 'real-secret',
      vault: 'financial',
      title: 'Real Private Reserve',
      fields: { password: 'real-secret-field-value' }
    }]);
  });
});

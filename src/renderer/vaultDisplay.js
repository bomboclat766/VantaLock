(function exposeVaultDisplay(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.VantaLockVaultDisplay = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createVaultDisplay() {
  const MODES = ['card', 'list', 'table'];
  const MODE_KEY = 'vantalock_entry_display_mode';

  function normalizeMode(mode) {
    return MODES.includes(mode) ? mode : 'card';
  }

  function getSearchableText(entry) {
    const values = [entry.title, entry.nickname];
    const addFieldValues = value => {
      if (typeof value === 'string' || typeof value === 'number') {
        values.push(String(value));
      } else if (Array.isArray(value)) {
        value.forEach(addFieldValues);
      } else if (value && typeof value === 'object') {
        Object.values(value).forEach(addFieldValues);
      }
    };
    addFieldValues(entry.fields);
    return values.filter(Boolean).join('\n').toLocaleLowerCase();
  }

  function searchEntries(activeEntries, query) {
    const normalizedQuery = typeof query === 'string' ? query.trim().toLocaleLowerCase() : '';
    if (!normalizedQuery || !Array.isArray(activeEntries)) return [];

    // Search only the caller-provided unlocked entries. Never persist or cache a plaintext index.
    return activeEntries
      .filter(entry => getSearchableText(entry).includes(normalizedQuery))
      .map(entry => ({
        id: String(entry.id),
        title: typeof entry.title === 'string' ? entry.title : '',
        vault: typeof entry.vault === 'string' ? entry.vault : '',
        typeName: typeof entry.typeName === 'string' ? entry.typeName : 'Entry'
      }));
  }

  return { MODES, MODE_KEY, normalizeMode, searchEntries };
});

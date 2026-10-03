(function exposeVaultImport(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.VantaLockVaultImport = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createVaultImport() {
  function persistImportedEntries(existingEntries, importedEntries, persistEntries) {
    if (!Array.isArray(existingEntries) || !Array.isArray(importedEntries)) {
      throw new TypeError('Vault entries must be arrays');
    }
    if (typeof persistEntries !== 'function') {
      throw new TypeError('A vault persistence function is required');
    }

    const combinedEntries = existingEntries.concat(importedEntries);
    if (persistEntries(combinedEntries) === false) {
      throw new Error('Imported entries could not be saved to the vault');
    }
    return combinedEntries;
  }

  return { persistImportedEntries };
});

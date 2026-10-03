const { persistImportedEntries } = require('../src/renderer/vaultImport');

describe('Vault entry import persistence', () => {
  test('merges imported legacy entries into the active vault and persists them', () => {
    const existingEntries = [{ id: 'existing-1', title: 'Existing entry' }];
    const importedEntries = [{ id: 'legacy-1', title: 'Migrated legacy entry' }];
    let storedEntries = [];

    const resultingEntries = persistImportedEntries(
      existingEntries,
      importedEntries,
      entries => {
        storedEntries = entries;
        return true;
      }
    );

    expect(resultingEntries).toEqual([...existingEntries, ...importedEntries]);
    expect(storedEntries).toEqual(resultingEntries);
    expect(storedEntries).toContainEqual(importedEntries[0]);
  });

  test('does not report an import as successful when vault persistence fails', () => {
    expect(() => persistImportedEntries([], [{ id: 'legacy-1' }], () => false))
      .toThrow('Imported entries could not be saved to the vault');
  });
});

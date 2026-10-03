// Password-manager import mapping runs locally and does not make network calls.
(function exposePasswordImportCore(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.VantaLockPasswordImportCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createPasswordImportCore() {
  const TARGETS = ['title', 'website', 'username', 'password', 'notes', 'ignore'];

  function normalizeHeader(header) {
    return String(header || '').trim().toLocaleLowerCase().replace(/[^a-z0-9]/g, '');
  }

  function guessTarget(header) {
    const normalized = normalizeHeader(header);
    if (['name', 'title', 'sitename', 'accountname', 'account'].includes(normalized)) return 'title';
    if (['url', 'website', 'loginuri', 'loginurl', 'uri', 'web'].includes(normalized)) return 'website';
    if (['username', 'login', 'email', 'loginemail', 'loginusername', 'loginname'].includes(normalized)) return 'username';
    if (['password', 'pass', 'loginpassword'].includes(normalized)) return 'password';
    if (['notes', 'note', 'extra', 'comments', 'comment'].includes(normalized)) return 'notes';
    return 'ignore';
  }

  function createHeaderMapping(headers, format = 'generic-csv') {
    const mapping = Object.create(null);
    const chromePreset = {
      name: 'title',
      url: 'website',
      username: 'username',
      password: 'password',
      note: 'notes'
    };
    headers.forEach(header => {
      const normalized = normalizeHeader(header);
      mapping[header] = format === 'chrome-csv' && chromePreset[normalized]
        ? chromePreset[normalized]
        : guessTarget(header);
    });
    return mapping;
  }

  function reuseMappingForMatchingHeaders(sourceHeaders, sourceMapping, targetHeaders) {
    if (sourceHeaders.length !== targetHeaders.length ||
        sourceHeaders.some((header, index) => header !== targetHeaders[index])) {
      return null;
    }
    const mapping = Object.create(null);
    targetHeaders.forEach(header => {
      mapping[header] = sourceMapping[header] || 'ignore';
    });
    return mapping;
  }

  function getMappedValue(row, mapping, target) {
    const source = Object.keys(mapping).find(header => mapping[header] === target);
    return source ? String(row[source] || '') : '';
  }

  function getTitle(row, mapping) {
    const title = getMappedValue(row, mapping, 'title').trim();
    if (title) return title;
    const website = getMappedValue(row, mapping, 'website').trim();
    if (!website) return '';
    try {
      return new URL(website.includes('://') ? website : `https://${website}`).hostname;
    } catch (_error) {
      return '';
    }
  }

  function buildPreview(parsed, mapping) {
    const entries = [];
    let emptyRowsSkipped = parsed.skippedItems
      ? parsed.skippedItems.filter(item => item.reason === 'Empty row').length
      : 0;
    const skippedItems = [];
    parsed.rows.forEach(row => {
      const title = getTitle(row, mapping);
      const password = getMappedValue(row, mapping, 'password');
      const username = getMappedValue(row, mapping, 'username');
      const website = getMappedValue(row, mapping, 'website');
      const notes = getMappedValue(row, mapping, 'notes');
      if (!title) {
        skippedItems.push({ reason: 'No title or valid website host' });
        return;
      }
      if (password) {
        entries.push({
          type: 'login',
          typeName: 'Login / Password',
          title,
          fields: {
            site_name: title,
            url: website,
            username,
            password
          },
          notes
        });
        return;
      }
      const content = [
        username ? `Username: ${username}` : '',
        website ? `Website: ${website}` : '',
        notes ? `Notes: ${notes}` : ''
      ].filter(Boolean).join('\n');
      entries.push({
        type: 'note',
        typeName: 'Secure Note',
        title,
        fields: { title, content }
      });
    });
    return { entries, emptyRowsSkipped, skippedItems };
  }

  function createVaultEntries(previewEntries, compartment, now = Date.now) {
    let lastId = 0;
    return previewEntries.map(entry => {
      const generatedId = Number(now());
      lastId = Math.max(generatedId, lastId + 1);
      const imported = {
        id: String(lastId),
        vault: compartment,
        type: entry.type,
        typeName: entry.typeName,
        title: entry.title,
        fields: { ...entry.fields },
        notes: entry.notes || '',
        createdAt: new Date().toISOString()
      };
      return imported;
    });
  }

  function persistImport(existingEntries, importedEntries, persistEntries, maxEntries = 5000) {
    if (!Array.isArray(existingEntries) || !Array.isArray(importedEntries)) {
      throw new TypeError('Vault entries must be arrays');
    }
    if (existingEntries.length + importedEntries.length > maxEntries) {
      throw new Error('This import would exceed the 5,000-entry limit.');
    }
    if (typeof persistEntries !== 'function') throw new TypeError('A persistence function is required');
    const combined = existingEntries.concat(importedEntries);
    if (persistEntries(combined) === false) {
      throw new Error('Import could not be saved. Your vault was not changed.');
    }
    return combined;
  }

  return {
    TARGETS,
    buildPreview,
    createHeaderMapping,
    createVaultEntries,
    guessTarget,
    persistImport,
    reuseMappingForMatchingHeaders
  };
});

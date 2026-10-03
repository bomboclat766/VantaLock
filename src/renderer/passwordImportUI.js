// Imported password data stays in this renderer's memory and is never sent over a network.
(function exposePasswordImportUI(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.VantaLockPasswordImportUI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createPasswordImportUI() {
  const TARGET_LABELS = {
    title: 'Title',
    website: 'Website',
    username: 'Username',
    password: 'Password',
    notes: 'Notes',
    ignore: 'Ignore'
  };
  const FORMAT_LABELS = {
    'generic-csv': 'Generic CSV',
    'chrome-csv': 'Chrome / Google Password Manager CSV',
    'bitwarden-json': 'Bitwarden (JSON)',
    'bitwarden-csv': 'Bitwarden (CSV)',
    'onepassword-1pux': '1Password (.1pux)',
    'onepassword-csv': '1Password (CSV)'
  };

  async function readFileBytes(file) {
    return new Uint8Array(await file.arrayBuffer());
  }

  function mount(options) {
    const { container, core, parseFile, getEntries, persistEntries, initialCompartment, isDecoy } = options;
    let files = [];
    let parsedFiles = [];
    let mappings = [];
    let formats = [];
    let previewEntries = [];
    let currentMappingIndex = 0;
    let compartment = initialCompartment === 'personal' ? initialCompartment : 'personal';
    let previewCounts = null;

    function clearImportData() {
      files = [];
      parsedFiles = [];
      mappings = [];
      formats = [];
      previewEntries = [];
      currentMappingIndex = 0;
      previewCounts = null;
    }

    function showLanding() {
      container.innerHTML = `
        <section class="external-import-card">
          <h3 class="setup-title">Import</h3>
          <p class="setup-desc">Restore a backup, or bring in a file from another password manager.</p>
          <div class="import-choice-grid">
            <button type="button" class="import-choice-card" data-import-choice="backup">
              <span class="import-choice-title">
                <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
                VantaLock backup
              </span>
              <span class="import-choice-subtitle">Restore a file you exported from VantaLock.</span>
            </button>
            <button type="button" class="import-choice-card import-choice-primary" data-import-choice="external">
              <span class="import-choice-title">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2h8l5 5v15H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><path d="M14 2v6h5M7 13h10M7 17h10"/></svg>
                Another password manager
              </span>
              <span class="import-choice-subtitle">Read on this device only. Nothing is uploaded.</span>
            </button>
          </div>
          <p class="import-supported-formats">Works with Chrome, Bitwarden, 1Password, KeePass, and any CSV.</p>
        </section>`;
      container.querySelector('[data-import-choice="backup"]').addEventListener('click', () => {
        options.onLegacyBackup(showLanding);
      });
      container.querySelector('[data-import-choice="external"]').addEventListener('click', showPicker);
    }

    function showPicker(errorMessage = '') {
      container.innerHTML = `
        <section class="external-import-card">
          <button type="button" class="import-back-link" data-action="back">Back</button>
          <h3 class="setup-title">Another password manager</h3>
          <p class="setup-desc">Choose CSV files to read locally. Nothing is saved until you confirm the import.</p>
          <label class="form-label" for="external-import-files">Select files</label>
          <input id="external-import-files" class="input-field import-file-input" type="file" accept=".csv,.json,.xml,.1pux" multiple />
          <ul class="import-file-list" aria-label="Selected files"></ul>
          <p class="import-error" role="alert"></p>
          <div class="import-footer">
            <span></span>
            <button type="button" class="btn-primary import-continue" ${files.length ? '' : 'disabled'}>Continue</button>
          </div>
        </section>`;
      const input = container.querySelector('#external-import-files');
      const list = container.querySelector('.import-file-list');
      const continueButton = container.querySelector('.import-continue');
      container.querySelector('[data-action="back"]').addEventListener('click', () => {
        clearImportData();
        showLanding();
      });
      container.querySelector('.import-error').textContent = errorMessage;
      function renderFiles() {
        list.replaceChildren();
        files.forEach((file, index) => {
          const item = document.createElement('li');
          const name = document.createElement('span');
          name.textContent = file.name;
          const remove = document.createElement('button');
          remove.type = 'button';
          remove.className = 'import-remove-file';
          remove.setAttribute('aria-label', `Remove ${file.name}`);
          remove.textContent = 'Remove';
          remove.addEventListener('click', () => {
            files.splice(index, 1);
            renderFiles();
          });
          item.append(name, remove);
          list.appendChild(item);
        });
        continueButton.disabled = files.length === 0;
      }
      input.addEventListener('change', () => {
        files = Array.from(input.files || []);
        renderFiles();
      });
      continueButton.addEventListener('click', parseChosenFiles);
      renderFiles();
    }

    async function parseChosenFiles() {
      const error = container.querySelector('.import-error');
      const continueButton = container.querySelector('.import-continue');
      continueButton.disabled = true;
      error.textContent = '';
      try {
        parsedFiles = await Promise.all(files.map(async file => ({
          name: file.name,
          parsed: await parseFile({ fileName: file.name, content: await readFileBytes(file) })
        })));
        formats = parsedFiles.map(file => file.parsed.format);
        mappings = parsedFiles.map((file, index) =>
          core.createHeaderMapping(file.parsed.headers, formats[index])
        );
        currentMappingIndex = 0;
        showMapping();
      } catch (failure) {
        error.textContent = failure && failure.message
          ? failure.message
          : 'The selected files could not be read.';
        continueButton.disabled = files.length === 0;
      }
    }

    function showMapping(errorMessage = '') {
      const file = parsedFiles[currentMappingIndex];
      const mapping = mappings[currentMappingIndex];
      container.innerHTML = `
        <section class="external-import-card">
          <button type="button" class="import-back-link" data-action="back">Back</button>
          <h3 class="setup-title">Match columns to VantaLock fields</h3>
          <p class="setup-desc import-file-heading"></p>
          <p class="import-detected-format">Detected: <span class="import-format-name"></span>
            <button type="button" class="import-format-change">Change</button>
            <select class="import-format-override hidden" aria-label="Override detected format">
              <option value="generic-csv">Generic CSV</option>
              <option value="chrome-csv">Chrome / Google Password Manager CSV</option>
              <option value="bitwarden-json">Bitwarden (JSON)</option>
              <option value="bitwarden-csv">Bitwarden (CSV)</option>
              <option value="onepassword-1pux">1Password (.1pux)</option>
              <option value="onepassword-csv">1Password (CSV)</option>
            </select>
          </p>
          <div class="import-mapping-headings"><span>CSV column</span><span></span><span>Saved as</span></div>
          <div class="import-mapping-grid"></div>
          <p class="import-warning" role="status"></p>
          <p class="import-error" role="alert"></p>
          <div class="import-footer">
            <span class="import-helper-text">Guessed from your headers. Change any of them.</span>
            <div><button type="button" class="btn-primary import-continue" data-action="continue">Continue</button>
              <button type="button" class="import-back-link" data-action="previous">Back</button></div>
          </div>
        </section>`;
      container.querySelector('.import-file-heading').textContent =
        `File ${currentMappingIndex + 1} of ${parsedFiles.length}: ${file.name}`;
      container.querySelector('.import-format-name').textContent =
        FORMAT_LABELS[formats[currentMappingIndex]] || FORMAT_LABELS['generic-csv'];
      container.querySelector('[data-action="back"]').addEventListener('click', () => {
        parsedFiles = [];
        mappings = [];
        showPicker();
      });
      const grid = container.querySelector('.import-mapping-grid');
      const formatOverride = container.querySelector('.import-format-override');
      container.querySelector('.import-format-change').addEventListener('click', () => {
        formatOverride.classList.toggle('hidden');
      });
      formatOverride.value = formats[currentMappingIndex];
      formatOverride.addEventListener('change', async () => {
        const requestedFormat = formatOverride.value;
        formatOverride.disabled = true;
        try {
          file.parsed = await parseFile({
            fileName: files[currentMappingIndex].name,
            content: await readFileBytes(files[currentMappingIndex]),
            formatOverride: requestedFormat
          });
          formats[currentMappingIndex] = file.parsed.format;
          mappings[currentMappingIndex] = core.createHeaderMapping(
            file.parsed.headers,
            file.parsed.format
          );
          showMapping();
        } catch (failure) {
          container.querySelector('.import-error').textContent = failure && failure.message
            ? failure.message
            : 'The selected format could not parse this file.';
          formatOverride.disabled = false;
          formatOverride.value = formats[currentMappingIndex];
        }
      });
      file.parsed.headers.forEach(header => {
        const source = document.createElement('span');
        source.className = 'import-source-field';
        source.textContent = header;
        const arrow = document.createElement('span');
        arrow.className = 'import-map-arrow';
        arrow.setAttribute('aria-hidden', 'true');
        arrow.textContent = '→';
        const select = document.createElement('select');
        select.className = 'import-map-select';
        select.setAttribute('aria-label', `Map ${header}`);
        Object.entries(TARGET_LABELS).forEach(([value, label]) => {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = label;
          select.appendChild(option);
        });
        select.value = mapping[header] || 'ignore';
        select.addEventListener('change', () => {
          mapping[header] = select.value;
          select.classList.toggle('is-ignored', select.value === 'ignore');
          updateMappingWarning();
        });
        select.classList.toggle('is-ignored', select.value === 'ignore');
        grid.append(source, arrow, select);
      });
      function updateMappingWarning() {
        const warning = container.querySelector('.import-warning');
        warning.textContent = Object.values(mapping).includes('password')
          ? ''
          : 'No Password column is mapped. Rows will be imported as Secure Notes.';
      }
      updateMappingWarning();
      container.querySelector('.import-error').textContent = errorMessage;
      container.querySelector('[data-action="previous"]').addEventListener('click', () => {
        if (currentMappingIndex > 0) {
          currentMappingIndex--;
          showMapping();
        } else {
          showPicker();
        }
      });
      container.querySelector('[data-action="continue"]').addEventListener('click', () => {
        if (currentMappingIndex + 1 < parsedFiles.length) {
          currentMappingIndex++;
          showMapping();
        } else {
          buildMergedPreview();
        }
      });
    }

    function buildMergedPreview() {
      const allEntries = [];
      let emptyRowsSkipped = 0;
      const skippedItems = [];
      parsedFiles.forEach((file, index) => {
        const preview = core.buildPreview(file.parsed, mappings[index]);
        allEntries.push(...preview.entries);
        emptyRowsSkipped += preview.emptyRowsSkipped;
        skippedItems.push(...preview.skippedItems);
        skippedItems.push(...file.parsed.skippedItems.filter(item => item.reason !== 'Empty row'));
      });
      previewEntries = allEntries;
      previewCounts = { emptyRowsSkipped, skippedItems };
      compartment = 'personal';
      showPreview();
    }

    function showPreview(errorMessage = '') {
      const loginCount = previewEntries.filter(entry => entry.type === 'login').length;
      const noteCount = previewEntries.length - loginCount;
      container.innerHTML = `
        <section class="external-import-card">
          <button type="button" class="import-back-link" data-action="back">Back</button>
          <h3 class="setup-title">Review import</h3>
          <div class="import-save-into"><span>Save into</span><button type="button" class="is-selected" data-compartment="personal">Personal</button></div>
          <div class="import-preview-list"></div>
          <p class="import-preview-counts"></p>
          <p class="import-preview-skips"></p>
          <p class="import-error" role="alert"></p>
          <div class="import-footer">
            <button type="button" class="import-cancel">Cancel</button>
            <button type="button" class="btn-primary import-confirm" ${previewEntries.length ? '' : 'disabled'}>Import ${previewEntries.length} entries</button>
          </div>
        </section>`;
      const list = container.querySelector('.import-preview-list');
      previewEntries.slice(0, 10).forEach(entry => {
        const row = document.createElement('div');
        row.className = 'import-preview-row';
        const title = document.createElement('span');
        title.textContent = entry.title;
        const username = document.createElement('span');
        username.textContent = entry.type === 'login' ? entry.fields.username : 'Secure Note';
        const maskedPassword = document.createElement('span');
        maskedPassword.className = 'import-preview-password';
        maskedPassword.textContent = entry.type === 'login' ? '••••••••' : '';
        row.append(title, username, maskedPassword);
        list.appendChild(row);
      });
      container.querySelector('.import-preview-counts').textContent =
        `${loginCount} logins, ${noteCount} secure notes ready, ${previewCounts.emptyRowsSkipped} empty rows skipped. Nothing is saved until you import.`;
      const otpCount = previewCounts.skippedItems.filter(item =>
        item.reason === 'One-time-code secret is not stored'
      ).length;
      const reasons = new Map();
      previewCounts.skippedItems.forEach(item => {
        if (item.reason === 'One-time-code secret is not stored') return;
        reasons.set(item.reason, (reasons.get(item.reason) || 0) + 1);
      });
      const skipLines = [];
      if (otpCount) {
        skipLines.push(`${otpCount} entries had one-time-code secrets that VantaLock doesn't store yet.`);
      }
      if (reasons.size) {
        skipLines.push(Array.from(reasons, ([reason, count]) => `${count} ${reason}`).join(' '));
      }
      const skipSummary = skipLines.join(' ');
      container.querySelector('.import-preview-skips').textContent = skipSummary;
      container.querySelector('.import-error').textContent = errorMessage;
      container.querySelector('[data-action="back"]').addEventListener('click', () => {
        currentMappingIndex = parsedFiles.length - 1;
        showMapping();
      });
      container.querySelector('.import-cancel').addEventListener('click', () => {
        clearImportData();
        showLanding();
      });
      container.querySelector('.import-confirm').addEventListener('click', confirmImport);
    }

    function confirmImport() {
      const button = container.querySelector('.import-confirm');
      const error = container.querySelector('.import-error');
      button.disabled = true;
      try {
        const importedEntries = core.createVaultEntries(previewEntries, compartment);
        core.persistImport(getEntries(), importedEntries, persistEntries, 5000);
        const count = importedEntries.length;
        clearImportData();
        container.innerHTML = `
          <section class="external-import-card">
            <h3 class="setup-title">Import complete</h3>
            <p class="setup-desc import-success"></p>
            <button type="button" class="import-back-link">Back to Import</button>
          </section>`;
        container.querySelector('.import-success').textContent = `Imported ${count} entries into Personal.`;
        container.querySelector('.import-back-link').addEventListener('click', showLanding);
      } catch (failure) {
        error.textContent = failure && failure.message ? failure.message : 'Import failed.';
        button.disabled = false;
      }
    }

    if (isDecoy) {
      container.innerHTML = '<div class="setup-card import-disabled-message">Import isn\'t available right now.</div>';
    } else {
      showLanding();
    }
    return { clear: clearImportData, showLanding };
  }

  return { mount };
});

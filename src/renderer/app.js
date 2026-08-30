const { calculatePasswordStrength } = require('../crypto/vaultCrypto');
const { generateRecoveryKey } = require('../crypto/recoveryKey');
const { activateLicenseKey } = require('../crypto/licenseActivation');

document.addEventListener('DOMContentLoaded', () => {
  // Theme Manager
  const themeSelect = document.getElementById('theme-select');
  if (themeSelect) {
    const savedTheme = localStorage.getItem('vantalock_theme') || 'theme-default';
    document.body.className = savedTheme;
    themeSelect.value = savedTheme;

    themeSelect.addEventListener('change', (e) => {
      const selected = e.target.value;
      document.body.className = selected;
      localStorage.setItem('vantalock_theme', selected);
    });
  }

  // Views & Modals Elements
  const splashOverlay = document.getElementById('splash-overlay');
  const setupViewContainer = document.getElementById('setup-view-container');
  const dashboardViewContainer = document.getElementById('dashboard-view-container');

  const onboardingContainer = document.getElementById('onboarding-container');
  const masterPasswordModal = document.getElementById('master-password-modal');
  const recoveryKeyModal = document.getElementById('recovery-key-modal');
  const addEntryModal = document.getElementById('add-entry-modal');

  const getStartedBtn = document.getElementById('get-started-btn');
  const mpInput = document.getElementById('mp-input');
  const mpConfirmInput = document.getElementById('mp-confirm-input');
  const strengthBar = document.getElementById('strength-bar');
  const strengthText = document.getElementById('strength-text');
  const mpErrorText = document.getElementById('mp-error-text');
  const mpForm = document.getElementById('master-password-form');

  const recoveryWordsGrid = document.getElementById('recovery-words-grid');
  const copyRkBtn = document.getElementById('copy-rk-btn');
  const printRkBtn = document.getElementById('print-rk-btn');
  const saveRkBtn = document.getElementById('save-rk-btn');
  const rkVerifyInputs = document.getElementById('rk-verify-inputs');
  const verifyRkBtn = document.getElementById('verify-rk-btn');
  const rkErrorText = document.getElementById('rk-error-text');

  const vaultTabs = document.querySelectorAll('.vault-tab-btn');
  const vaultTitle = document.getElementById('current-vault-title');
  const vaultDesc = document.getElementById('current-vault-desc');
  const addEntryBtn = document.getElementById('add-entry-btn');
  const closeEntryModalBtn = document.getElementById('close-entry-modal-btn');
  const typeChipsGrid = document.getElementById('type-chips-grid');
  const dynamicFieldsContainer = document.getElementById('dynamic-fields-container');
  const entryDynamicForm = document.getElementById('entry-dynamic-form');
  const entryListContainer = document.getElementById('entry-list-container');

  let activeRecoveryKeyWords = [];
  let verificationIndices = [];
  let activeVault = 'financial';
  let activeEntryType = null;
  let vaultEntries = [];

  const vaultMetadata = {
    financial: {
      title: 'Financial Vault',
      desc: 'Manage bank accounts, payment cards, crypto wallets, and loans.',
      types: [
        { id: 'bank', label: 'Bank Account', fields: ['Bank Name', 'Account Number', 'Routing Number'] },
        { id: 'card', label: 'Payment Card', fields: ['Card Name', 'Card Number', 'Expiry Date', 'CVV'] },
        { id: 'crypto', label: 'Crypto Wallet', fields: ['Wallet Name', 'Public Address', 'Private Key / Seed'] }
      ]
    },
    legal: {
      title: 'Legal Vault',
      desc: 'Store passport details, identification numbers, and legal contracts.',
      types: [
        { id: 'passport', label: 'Passport', fields: ['Country', 'Passport Number', 'Expiration Date'] },
        { id: 'ssn', label: 'Identity / SSN', fields: ['Full Name', 'SSN / ID Number'] },
        { id: 'contract', label: 'Legal Contract', fields: ['Document Title', 'Parties Involved', 'Key Terms'] }
      ]
    },
    personal: {
      title: 'Personal Vault',
      desc: 'Keep private logins, personal notes, medical info, and emergency instructions.',
      types: [
        { id: 'login', label: 'Login / Password', fields: ['Site/App Name', 'Username', 'Password'] },
        { id: 'note', label: 'Note', fields: ['Title', 'Freeform Text'] },
        { id: 'medical', label: 'Medical Info', fields: ['Type (Allergy/Condition)', 'Details'] },
        { id: 'emergency', label: 'Emergency Instruction', fields: ['Title', 'Instructions', 'Who to Notify'] }
      ]
    }
  };

  // Helper function to switch views cleanly
  function showScreen(screen) {
    if (screen === 'dashboard') {
      if (setupViewContainer) setupViewContainer.classList.add('hidden');
      if (dashboardViewContainer) dashboardViewContainer.classList.remove('hidden');
    } else {
      if (dashboardViewContainer) dashboardViewContainer.classList.add('hidden');
      if (setupViewContainer) setupViewContainer.classList.remove('hidden');

      if (onboardingContainer) onboardingContainer.classList.add('hidden');
      if (masterPasswordModal) masterPasswordModal.classList.add('hidden');
      if (recoveryKeyModal) recoveryKeyModal.classList.add('hidden');

      if (screen === 'onboarding') {
        if (onboardingContainer) onboardingContainer.classList.remove('hidden');
      } else if (screen === 'master-password') {
        if (masterPasswordModal) masterPasswordModal.classList.remove('hidden');
      } else if (screen === 'recovery-key') {
        if (recoveryKeyModal) recoveryKeyModal.classList.remove('hidden');
      }
    }
  }

  // Initial View Determination after splash dismiss
  let splashDismissed = false;
  function dismissSplash() {
    if (splashDismissed) return;
    splashDismissed = true;

    const navigateToNextScreen = () => {
      if (!localStorage.getItem('vantalock_onboarded')) {
        showScreen('onboarding');
      } else if (!localStorage.getItem('vantalock_vault_salt')) {
        showScreen('master-password');
      } else {
        showScreen('dashboard');
      }
    };

    if (splashOverlay) {
      splashOverlay.style.opacity = '0';
      splashOverlay.style.pointerEvents = 'none';
      setTimeout(() => {
        splashOverlay.style.display = 'none';
        navigateToNextScreen();
      }, 300);
    } else {
      navigateToNextScreen();
    }
  }

  setTimeout(dismissSplash, 1200);
  setTimeout(dismissSplash, 2500);

  if (splashOverlay) {
    splashOverlay.addEventListener('click', dismissSplash);
  }

  // Onboarding Screen Get Started Button
  if (getStartedBtn) {
    getStartedBtn.addEventListener('click', () => {
      localStorage.setItem('vantalock_onboarded', 'true');
      showScreen('master-password');
    });
  }

  // Master Password Form Strength Calculation
  if (mpInput) {
    mpInput.addEventListener('input', () => {
      const val = mpInput.value;
      const { score, label } = calculatePasswordStrength(val);
      const widthPct = val ? (score + 1) * 20 : 0;
      strengthBar.style.width = widthPct + '%';
      const colors = ['#ef4444', '#ef4444', '#f59e0b', '#10b981', '#10b981'];
      strengthBar.style.backgroundColor = colors[score] || '#1f1f1f';
      strengthText.textContent = `Strength: ${label.toUpperCase()}`;
    });
  }

  // Master Password Submission
  if (mpForm) {
    mpForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const pwd = mpInput.value;
      const confirmPwd = mpConfirmInput.value;

      if (pwd !== confirmPwd) {
        mpErrorText.style.display = 'block';
        return;
      }
      mpErrorText.style.display = 'none';

      const { generateSalt, deriveKey, createVerifier } = require('../crypto/vaultCrypto');
      const salt = generateSalt();
      const derivedKey = await deriveKey(pwd, salt);
      const verifier = createVerifier(derivedKey);

      localStorage.setItem('vantalock_vault_salt', salt.toString('hex'));
      localStorage.setItem('vantalock_vault_verifier', verifier);

      setupRecoveryKeyScreen();
    });
  }

  // 24-Word Recovery Phrase Screen
  function setupRecoveryKeyScreen() {
    const rawPhrase = generateRecoveryKey();
    activeRecoveryKeyWords = rawPhrase.trim().split(/\s+/);

    recoveryWordsGrid.innerHTML = '';
    activeRecoveryKeyWords.forEach((word, idx) => {
      const chip = document.createElement('div');
      chip.className = 'word-chip';
      chip.innerHTML = `<span class="word-num">${idx + 1}.</span> <span>${word}</span>`;
      recoveryWordsGrid.appendChild(chip);
    });

    const indices = [];
    while (indices.length < 3) {
      const r = Math.floor(Math.random() * 24);
      if (!indices.includes(r)) indices.push(r);
    }
    indices.sort((a, b) => a - b);
    verificationIndices = indices;

    rkVerifyInputs.innerHTML = '';
    indices.forEach((i) => {
      const inputWrap = document.createElement('div');
      inputWrap.style.flex = '1';
      inputWrap.innerHTML = `
        <label class="form-label">Word #${i + 1}</label>
        <input type="text" class="input-field rk-verify-input" data-index="${i}" placeholder="Word #${i + 1}" required />
      `;
      rkVerifyInputs.appendChild(inputWrap);
    });

    showScreen('recovery-key');
  }

  // Recovery Key Copy / Print / Save Actions
  if (copyRkBtn) {
    copyRkBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(activeRecoveryKeyWords.join(' '));
      copyRkBtn.textContent = 'Copied!';
      setTimeout(() => copyRkBtn.textContent = 'Copy', 2000);
    });
  }

  if (printRkBtn) {
    printRkBtn.addEventListener('click', () => {
      window.print();
    });
  }

  if (saveRkBtn) {
    saveRkBtn.addEventListener('click', () => {
      const blob = new Blob([activeRecoveryKeyWords.join(' ')], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'vantalock-recovery-phrase.txt';
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  // Verify Recovery Key Phrase
  if (verifyRkBtn) {
    verifyRkBtn.addEventListener('click', () => {
      const inputs = document.querySelectorAll('.rk-verify-input');
      let allCorrect = true;

      inputs.forEach(inp => {
        const wordIndex = parseInt(inp.getAttribute('data-index'), 10);
        const enteredVal = inp.value.trim().toLowerCase();
        if (enteredVal !== activeRecoveryKeyWords[wordIndex]) {
          allCorrect = false;
        }
      });

      if (!allCorrect) {
        rkErrorText.style.display = 'block';
        return;
      }

      rkErrorText.style.display = 'none';
      showScreen('dashboard');
    });
  }

  // Entry Modals & Dynamic Form Rendering
  if (addEntryBtn) {
    addEntryBtn.addEventListener('click', () => {
      openAddEntryModal();
    });
  }

  if (closeEntryModalBtn) {
    closeEntryModalBtn.addEventListener('click', () => {
      addEntryModal.classList.add('hidden');
    });
  }

  function openAddEntryModal() {
    typeChipsGrid.innerHTML = '';
    const availableTypes = vaultMetadata[activeVault].types;

    availableTypes.forEach((tConfig, idx) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `type-chip ${idx === 0 ? 'selected' : ''}`;
      chip.textContent = tConfig.label;
      chip.addEventListener('click', () => {
        document.querySelectorAll('.type-chip').forEach(c => c.classList.remove('selected'));
        chip.classList.add('selected');
        renderDynamicFormFields(tConfig);
      });
      typeChipsGrid.appendChild(chip);
    });

    if (availableTypes.length > 0) {
      renderDynamicFormFields(availableTypes[0]);
    }

    addEntryModal.classList.remove('hidden');
  }

  function renderDynamicFormFields(typeConfig) {
    activeEntryType = typeConfig;
    dynamicFieldsContainer.innerHTML = '';

    typeConfig.fields.forEach(fName => {
      const fKey = fName.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const fg = document.createElement('div');
      fg.className = 'form-group';
      fg.innerHTML = `
        <label class="form-label">${fName}</label>
        <input type="text" class="input-field dynamic-field-input" data-key="${fKey}" placeholder="Enter ${fName}..." required />
      `;
      dynamicFieldsContainer.appendChild(fg);
    });
  }

  if (entryDynamicForm) {
    entryDynamicForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = document.getElementById('entry-title-input').value;
      const notes = document.getElementById('entry-notes-input').value;

      const fieldValues = {};
      document.querySelectorAll('.dynamic-field-input').forEach(inp => {
        fieldValues[inp.getAttribute('data-key')] = inp.value;
      });

      const newEntry = {
        id: Date.now().toString(),
        vault: activeVault,
        type: activeEntryType.id,
        typeName: activeEntryType.label,
        title,
        notes,
        fields: fieldValues,
        createdAt: new Date().toISOString()
      };

      vaultEntries.push(newEntry);
      addEntryModal.classList.add('hidden');
      entryDynamicForm.reset();
      renderVaultEntries();
    });
  }

  function renderVaultEntries() {
    const currentVaultEntries = vaultEntries.filter(e => e.vault === activeVault);
    if (currentVaultEntries.length === 0) {
      entryListContainer.innerHTML = `
        <div class="empty-vault-card">
          <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <div class="empty-title">Vault is empty</div>
          <div class="empty-sub">No entries found in this vault yet. Click "+ Add Entry" to store your sensitive information.</div>
        </div>
      `;
      return;
    }

    entryListContainer.innerHTML = '';
    currentVaultEntries.forEach(entry => {
      const card = document.createElement('div');
      card.className = 'entry-card';

      let fieldsHtml = '';
      for (const [k, v] of Object.entries(entry.fields)) {
        fieldsHtml += `
          <div class="field-item">
            <span class="field-label">${k.replace(/_/g, ' ')}</span>
            <span class="field-value">${v}</span>
          </div>
        `;
      }

      card.innerHTML = `
        <div class="entry-header">
          <span class="entry-title">${entry.title}</span>
          <span class="entry-type-badge">${entry.typeName}</span>
        </div>
        <div class="entry-fields-grid">${fieldsHtml}</div>
        ${entry.notes ? `<div style="font-size:12px; color: var(--text-secondary); margin-top: 6px;"><strong>Notes:</strong> ${entry.notes}</div>` : ''}
        <div class="entry-actions">
          <button class="btn-danger delete-entry-btn" data-id="${entry.id}">Delete</button>
        </div>
      `;
      entryListContainer.appendChild(card);
    });

    document.querySelectorAll('.delete-entry-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        vaultEntries = vaultEntries.filter(e => e.id !== id);
        renderVaultEntries();
      });
    });
  }

  // Stats counter helper
  function updateSidebarStats() {
    const statVaultSize = document.getElementById('stat-vault-size');
    const statEntryCount = document.getElementById('stat-entry-count');
    const totalEntries = vaultEntries.length;
    if (statEntryCount) {
      statEntryCount.textContent = `Entries: ${totalEntries} total`;
    }
    if (statVaultSize) {
      const approxBytes = JSON.stringify(vaultEntries).length;
      const sizeKb = (approxBytes / 1024).toFixed(1);
      statVaultSize.textContent = `Vault Size: ${sizeKb} KB`;
    }
  }

  // Tool metadata definitions
  const toolMetadata = {
    security: {
      title: 'Security Center',
      desc: 'Change master password, re-confirm recovery seed, and configure auto-lock timeouts.'
    },
    seed: {
      title: 'Recovery Seed',
      desc: 'Re-display your 24-word recovery phrase. Gated behind master password confirmation.'
    },
    export: {
      title: 'Backup & Export',
      desc: 'Export your encrypted local JSON vault backup.'
    },
    import: {
      title: 'Import Vault',
      desc: 'Import and decrypt an existing JSON vault backup.'
    },
    activity: {
      title: 'Activity Log',
      desc: 'Read-only log of unlocks, entry modifications, and export/import operations.'
    },
    about: {
      title: 'About VantaLock',
      desc: 'App Version: 1.0.17 | License: Activated | Zero-Cloud Encryption'
    }
  };

  const toolTabs = document.querySelectorAll('.tool-tab-btn');

  vaultTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      vaultTabs.forEach(t => t.classList.remove('active'));
      toolTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      activeVault = tab.getAttribute('data-vault');
      if (vaultMetadata[activeVault]) {
        vaultTitle.textContent = vaultMetadata[activeVault].title;
        vaultDesc.textContent = vaultMetadata[activeVault].desc;
      }
      renderVaultEntries();
    });
  });

  toolTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      vaultTabs.forEach(t => t.classList.remove('active'));
      toolTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const toolKey = tab.getAttribute('data-tool');
      if (toolMetadata[toolKey]) {
        vaultTitle.textContent = toolMetadata[toolKey].title;
        vaultDesc.textContent = toolMetadata[toolKey].desc;
      }

      entryListContainer.innerHTML = `
        <div class="empty-vault-card">
          <div class="empty-title">${toolMetadata[toolKey] ? toolMetadata[toolKey].title : 'Tool'} Placeholder</div>
          <div class="empty-sub">${toolMetadata[toolKey] ? toolMetadata[toolKey].desc : 'Functionality placeholder.'}</div>
        </div>
      `;
    });
  });

  updateSidebarStats();
});

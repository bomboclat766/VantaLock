const { calculatePasswordStrength } = require('../crypto/vaultCrypto');
const { generateRecoveryKey } = require('../crypto/recoveryKey');
const { activateLicenseKey } = require('../crypto/licenseActivation');

document.addEventListener('DOMContentLoaded', () => {
  const splashOverlay = document.getElementById('splash-overlay');
  const activationModal = document.getElementById('activation-modal');
  const onboardingContainer = document.getElementById('onboarding-container');
  const masterPasswordModal = document.getElementById('master-password-modal');
  const recoveryKeyModal = document.getElementById('recovery-key-modal');
  const addEntryModal = document.getElementById('add-entry-modal');

  const licenseInput = document.getElementById('license-input');
  const activationErrorText = document.getElementById('activation-error-text');
  const activationForm = document.getElementById('activation-form');

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
        { id: 'bank_account', label: 'Bank Account', fields: ['Bank Name', 'Account Number', 'Account Type', 'Branch'] },
        { id: 'card', label: 'Card', fields: ['Card Nickname', 'Card Number', 'Expiry', 'CVV', 'PIN'] },
        { id: 'crypto_wallet', label: 'Crypto Wallet', fields: ['Wallet Name', 'Seed Phrase', 'Wallet Address'] },
        { id: 'loan', label: 'Loan / Investment', fields: ['Institution', 'Account/Reference Number'] }
      ]
    },
    legal: {
      title: 'Legal Vault',
      desc: 'Secure identity documents, signed contracts, and insurance policies.',
      types: [
        { id: 'id_document', label: 'ID Document', fields: ['Document Type (Passport/ID/License)', 'Number', 'Issue Date', 'Expiry Date'] },
        { id: 'contract', label: 'Contract / Agreement', fields: ['Title', 'Parties Involved', 'Date Signed'] },
        { id: 'insurance', label: 'Insurance Policy', fields: ['Provider', 'Policy Number', 'Coverage Type', 'Expiry Date'] }
      ]
    },
    personal: {
      title: 'Personal Vault',
      desc: 'Store logins, passwords, private notes, medical data, and emergency instructions.',
      types: [
        { id: 'login', label: 'Login / Password', fields: ['Site/App Name', 'Username', 'Password'] },
        { id: 'note', label: 'Note', fields: ['Title', 'Freeform Text'] },
        { id: 'medical', label: 'Medical Info', fields: ['Type (Allergy/Condition/Prescription)', 'Details'] },
        { id: 'emergency', label: 'Emergency Instruction', fields: ['Title', 'Instructions', 'Who to Notify'] }
      ]
    }
  };

  // Splash animation timer with click-to-dismiss fallback and safety timeout
  let splashDismissed = false;
  function dismissSplash() {
    if (splashDismissed) return;
    splashDismissed = true;
    if (splashOverlay) {
      splashOverlay.style.opacity = '0';
      splashOverlay.style.pointerEvents = 'none';
      setTimeout(() => {
        splashOverlay.style.display = 'none';
        if (!localStorage.getItem('vantalock_activated')) {
          if (activationModal) activationModal.style.display = 'flex';
        } else if (!localStorage.getItem('vantalock_onboarded')) {
          if (onboardingContainer) onboardingContainer.style.display = 'flex';
        } else if (!localStorage.getItem('vantalock_vault_salt')) {
          if (masterPasswordModal) masterPasswordModal.style.display = 'flex';
        }
      }, 400);
    }
  }

  // Automatic dismiss timer (1.5s) with safety fallback timeout (3s)
  setTimeout(dismissSplash, 1500);
  setTimeout(dismissSplash, 3000);

  if (splashOverlay) {
    splashOverlay.addEventListener('click', dismissSplash);
  }

  // Phase 8: License Activation Handler
  if (activationForm) {
    activationForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const key = licenseInput.value.trim();
      const result = await activateLicenseKey(key);

      if (result.activated) {
        localStorage.setItem('vantalock_activated', 'true');
        activationModal.style.display = 'none';
        if (!localStorage.getItem('vantalock_onboarded')) {
          onboardingContainer.style.display = 'flex';
        } else if (!localStorage.getItem('vantalock_vault_salt')) {
          masterPasswordModal.style.display = 'flex';
        }
      } else {
        activationErrorText.textContent = result.error || 'Activation failed.';
        activationErrorText.style.display = 'block';
      }
    });
  }

  if (getStartedBtn) {
    getStartedBtn.addEventListener('click', () => {
      localStorage.setItem('vantalock_onboarded', 'true');
      onboardingContainer.style.display = 'none';
      if (!localStorage.getItem('vantalock_vault_salt')) {
        masterPasswordModal.style.display = 'flex';
      }
    });
  }

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

      masterPasswordModal.style.display = 'none';
      setupRecoveryKeyScreen();
    });
  }

  function setupRecoveryKeyScreen() {
    const rawPhrase = generateRecoveryKey();
    activeRecoveryKeyWords = rawPhrase.split(' ');

    recoveryWordsGrid.innerHTML = '';
    activeRecoveryKeyWords.forEach((word, idx) => {
      const chip = document.createElement('div');
      chip.className = 'word-chip';
      chip.innerHTML = `<span class="word-num">${idx + 1}.</span>${word}`;
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

    recoveryKeyModal.style.display = 'flex';
  }

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
      recoveryKeyModal.style.display = 'none';
    });
  }

  if (addEntryBtn) {
    addEntryBtn.addEventListener('click', () => {
      openAddEntryModal();
    });
  }

  if (closeEntryModalBtn) {
    closeEntryModalBtn.addEventListener('click', () => {
      addEntryModal.style.display = 'none';
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

    addEntryModal.style.display = 'flex';
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
      addEntryModal.style.display = 'none';
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

  vaultTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      vaultTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      activeVault = tab.getAttribute('data-vault');
      if (vaultMetadata[activeVault]) {
        vaultTitle.textContent = vaultMetadata[activeVault].title;
        vaultDesc.textContent = vaultMetadata[activeVault].desc;
      }
      renderVaultEntries();
    });
  });
});

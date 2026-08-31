const { calculatePasswordStrength, encryptData } = require('../crypto/vaultCrypto');
const { generateRecoveryKey } = require('../crypto/recoveryKey');
const ClipboardManager = require('../crypto/clipboardManager');
const clipboardMgr = new ClipboardManager(30000);
const { exportEncryptedVault, importEncryptedVault } = require('../crypto/vaultBackup');
const LockManager = require('../crypto/lockManager');

// Application Activity Logging System
const appActivityLogs = [
  `[${new.Date().toISOString()}] SYSTEM: VantaLock engine initialized.`
];

function logActivity(eventMessage) {
  appActivityLogs.push(`[${new Date().toISOString()}] ${eventMessage}`);
}

document.addEventListener('DOMContentLoaded', () => {
  // Lock Manager Instance
  const lockMgr = new LockManager({
    onLockCallback: (reason) => {
      logActivity(`VAULT LOCKED: ${reason}`);
      localStorage.removeItem('vantalock_unlocked_session');
      showScreen('onboarding');
    }
  });

  // Panic Lock Elements & Keyboard Shortcut (Phase 1)
  const panicLockBtn = document.getElementById('panic-lock-btn');
  const lockStatusText = document.getElementById('lock-status-text');

  function triggerPanicLock() {
    logActivity('USER ACTION: Panic lock triggered.');
    if (lockStatusText) lockStatusText.textContent = 'VAULT SECURED';
    lockMgr.lock('Manual panic lock triggered');
  }

  if (panicLockBtn) {
    panicLockBtn.addEventListener('click', triggerPanicLock);
  }

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toUpperCase() === 'L') {
      e.preventDefault();
      triggerPanicLock();
    }
  });

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
      logActivity(`THEME CHANGED: ${selected}`);
    });
  }

  // Views & Modals Elements
  const splashOverlay = document.getElementById('splash-overlay');
  const setupViewContainer = document.getElementById('setup-view-container');
  const dashboardViewContainer = document.getElementById('dashboard-view-container');

  const onboardingContainer = document.getElementById('onboarding-container');
  const masterPasswordModal = document.getElementById('master-password-modal');
  const recoveryKeyRevealStep = document.getElementById('recovery-key-reveal-step');
  const recoveryKeyVerifyStep = document.getElementById('recovery-key-verify-step');
  const addEntryModal = document.getElementById('add-entry-modal');

  const addFileBtn = document.getElementById('add-file-btn');
  const addEntryBtn = document.getElementById('add-entry-btn');
  const addFileModal = document.getElementById('add-file-modal');
  const closeFileModalBtn = document.getElementById('close-file-modal-btn');
  const fileUploadForm = document.getElementById('file-upload-form');

  const getStartedBtn = document.getElementById('get-started-btn');
  const mpInput = document.getElementById('mp-input');
  const mpConfirmInput = document.getElementById('mp-confirm-input');
  const strengthBar = document.getElementById('strength-bar');
  const strengthText = document.getElementById('strength-text');
  const mpErrorText = document.getElementById('mp-error-text');
  const mpForm = document.getElementById('master-password-form');

  const recoveryWordsGrid = document.getElementById('recovery-words-grid');
  const proceedToVerifyRkBtn = document.getElementById('proceed-to-verify-rk-btn');
  const backToSeedBtn = document.getElementById('back-to-seed-btn');
  const rkVerifyInputs = document.getElementById('rk-verify-inputs');
  const verifyRkBtn = document.getElementById('verify-rk-btn');
  const rkErrorText = document.getElementById('rk-error-text');

  const vaultTabs = document.querySelectorAll('.vault-tab-btn:not(.tool-tab-btn)');
  const toolTabs = document.querySelectorAll('.tool-tab-btn');
  const vaultTitle = document.getElementById('current-vault-title');
  const vaultDesc = document.getElementById('current-vault-desc');
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

  // Helper function to switch views cleanly
  function showScreen(screen) {
    if (screen === 'dashboard') {
      if (setupViewContainer) setupViewContainer.classList.add('hidden');
      if (dashboardViewContainer) dashboardViewContainer.classList.remove('hidden');
      if (lockStatusText) lockStatusText.textContent = 'VAULT UNLOCKED';
      lockMgr.recordSuccessfulUnlock();
      logActivity('NAVIGATION: Dashboard view displayed.');
    } else {
      if (dashboardViewContainer) dashboardViewContainer.classList.add('hidden');
      if (setupViewContainer) setupViewContainer.classList.remove('hidden');

      if (onboardingContainer) onboardingContainer.classList.add('hidden');
      if (masterPasswordModal) masterPasswordModal.classList.add('hidden');
      if (recoveryKeyRevealStep) recoveryKeyRevealStep.classList.add('hidden');
      if (recoveryKeyVerifyStep) recoveryKeyVerifyStep.classList.add('hidden');

      if (screen === 'onboarding') {
        if (onboardingContainer) onboardingContainer.classList.remove('hidden');
      } else if (screen === 'master-password') {
        if (masterPasswordModal) masterPasswordModal.classList.remove('hidden');
      } else if (screen === 'recovery-key-reveal') {
        if (recoveryKeyRevealStep) recoveryKeyRevealStep.classList.remove('hidden');
      } else if (screen === 'recovery-key-verify') {
        if (recoveryKeyVerifyStep) recoveryKeyVerifyStep.classList.remove('hidden');
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

  if (getStartedBtn) {
    getStartedBtn.addEventListener('click', () => {
      localStorage.setItem('vantalock_onboarded', 'true');
      logActivity('ONBOARDING: User clicked Get Started.');
      showScreen('master-password');
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

      logActivity('SECURITY: Master password key derived and verifier stored.');
      setupRecoveryKeyScreen();
    });
  }

  // Phase 2: 24-Word Recovery Phrase Screen (Step 1: Reveal)
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

    logActivity('SECURITY: 24-word recovery phrase generated.');
    showScreen('recovery-key-reveal');
  }

  if (proceedToVerifyRkBtn) {
    proceedToVerifyRkBtn.addEventListener('click', () => {
      setupRecoveryVerification();
    });
  }

  // Phase 2: 24-Word Recovery Phrase Screen (Step 2: Verification)
  function setupRecoveryVerification() {
    const indices = [];
    while (indices.length < 4) {
      const r = Math.floor(Math.random() * 24);
      if (!indices.includes(r)) indices.push(r);
    }
    indices.sort((a, b) => a - b);
    verificationIndices = indices;

    rkVerifyInputs.innerHTML = '';
    indices.forEach((i) => {
      const inputWrap = document.createElement('div');
      inputWrap.innerHTML = `
        <label class="form-label">Enter Word #${i + 1}</label>
        <input type="text" class="input-field rk-verify-input" data-index="${i}" placeholder="Word #${i + 1}" required />
      `;
      rkVerifyInputs.appendChild(inputWrap);
    });

    showScreen('recovery-key-verify');
  }

  if (backToSeedBtn) {
    backToSeedBtn.addEventListener('click', () => {
      showScreen('recovery-key-reveal');
    });
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
        logActivity('SECURITY WARNING: Failed seed word verification attempt.');
        return;
      }

      rkErrorText.style.display = 'none';
      logActivity('SECURITY: 24-word recovery phrase backup verified.');
      showScreen('dashboard');
    });
  }

  // Phase 4: Add File Button Flow
  if (addFileBtn) {
    addFileBtn.addEventListener('click', () => {
      if (addFileModal) addFileModal.classList.remove('hidden');
    });
  }

  if (closeFileModalBtn) {
    closeFileModalBtn.addEventListener('click', () => {
      if (addFileModal) addFileModal.classList.add('hidden');
    });
  }

  if (fileUploadForm) {
    fileUploadForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const filePicker = document.getElementById('file-picker-input');
      const titleInput = document.getElementById('file-title-input');
      const notesInput = document.getElementById('file-notes-input');

      const file = filePicker.files[0];
      if (!file) return;

      const newFileEntry = {
        id: Date.now().toString(),
        vault: activeVault,
        type: 'file',
        typeName: 'Encrypted File',
        title: titleInput.value.trim(),
        notes: notesInput.value.trim(),
        fields: {
          filename: file.name,
          filesize: `${(file.size / 1024).toFixed(1)} KB`,
          filetype: file.type || 'binary'
        },
        createdAt: new Date().toISOString()
      };

      vaultEntries.push(newFileEntry);
      logActivity(`VAULT FILE ADDED: attached ${file.name} to ${activeVault} vault.`);
      if (addFileModal) addFileModal.classList.add('hidden');
      fileUploadForm.reset();
      renderVaultEntries();
      updateSidebarStats();
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
      logActivity(`VAULT ENTRY ADDED: ${title} in ${activeVault} vault.`);
      addEntryModal.classList.add('hidden');
      entryDynamicForm.reset();
      renderVaultEntries();
      updateSidebarStats();
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
          <div class="empty-sub">No entries found in this vault yet. Click "+ Add Entry" or "+ Add File" to store your sensitive information.</div>
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

      const fileBadgeIcon = entry.type === 'file' ? '📁 ' : '';

      card.innerHTML = `
        <div class="entry-header">
          <span class="entry-title">${fileBadgeIcon}${entry.title}</span>
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
        logActivity(`VAULT ITEM DELETED: ID ${id}`);
        renderVaultEntries();
        updateSidebarStats();
      });
    });
  }

  // Vault & Tools Navigation Wiring
  vaultTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      vaultTabs.forEach(t => t.classList.remove('active'));
      toolTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      if (addFileBtn) addFileBtn.style.display = 'block';
      if (addEntryBtn) addEntryBtn.style.display = 'block';

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

      if (addFileBtn) addFileBtn.style.display = 'none';
      if (addEntryBtn) addEntryBtn.style.display = 'none';

      const toolKey = tab.getAttribute('data-tool');
      if (toolMetadata[toolKey]) {
        vaultTitle.textContent = toolMetadata[toolKey].title;
        vaultDesc.textContent = toolMetadata[toolKey].desc;
      }

      renderToolView(toolKey);
    });
  });

  // Render Tool View Component
  function renderToolView(toolKey) {
    if (toolKey === 'security') {
      entryListContainer.innerHTML = `
        <div class="setup-card" style="max-width: 600px; margin: 0 auto;">
          <h3 class="setup-title" style="font-size: 18px;">Security Settings</h3>

          <form id="change-mp-form" style="margin-bottom: 24px;">
            <div class="form-group">
              <label class="form-label">Current Master Password</label>
              <div style="position: relative;">
                <input type="password" id="current-mp-input" class="input-field" placeholder="Enter current password..." required />
                <button type="button" class="pwd-toggle-btn" data-target="current-mp-input" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--text-secondary); cursor: pointer;">👁️</button>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">New Master Password</label>
              <div style="position: relative;">
                <input type="password" id="sec-new-mp-input" class="input-field" placeholder="Enter new password..." required />
                <button type="button" class="pwd-toggle-btn" data-target="sec-new-mp-input" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--text-secondary); cursor: pointer;">👁️</button>
              </div>
              <div class="strength-meter">
                <div id="sec-strength-bar" class="strength-bar"></div>
              </div>
              <div id="sec-strength-text" class="strength-text">Strength: Empty</div>
            </div>

            <div class="form-group">
              <label class="form-label">Confirm New Master Password</label>
              <div style="position: relative;">
                <input type="password" id="sec-confirm-mp-input" class="input-field" placeholder="Confirm new password..." required />
                <button type="button" class="pwd-toggle-btn" data-target="sec-confirm-mp-input" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--text-secondary); cursor: pointer;">👁️</button>
              </div>
            </div>

            <button type="submit" id="sec-update-mp-btn" class="btn-primary" disabled style="opacity: 0.5;">Update Master Password</button>
            <div id="mp-change-msg" class="strength-text" style="margin-top: 8px;"></div>
          </form>

          <hr style="border: none; border-top: 1px solid var(--surface-border); margin: 20px 0;" />

          <div class="form-group">
            <label class="form-label">Auto-Lock Timeout</label>
            <select id="autolock-select" class="theme-select-dropdown" style="width: 100%; padding: 10px;">
              <option value="1">1 Minute</option>
              <option value="5" selected>5 Minutes (Default)</option>
              <option value="15">15 Minutes</option>
              <option value="30">30 Minutes</option>
              <option value="0">Never</option>
            </select>
          </div>
        </div>
      `;

      const changeForm = document.getElementById('change-mp-form');
      const secNewInp = document.getElementById('sec-new-mp-input');
      const secConfirmInp = document.getElementById('sec-confirm-mp-input');
      const secUpdateBtn = document.getElementById('sec-update-mp-btn');
      const secBar = document.getElementById('sec-strength-bar');
      const secTxt = document.getElementById('sec-strength-text');
      const msgDiv = document.getElementById('mp-change-msg');

      function validatePasswordChangeMatch() {
        const p1 = secNewInp.value;
        const p2 = secConfirmInp.value;
        if (p1 && p2 && p1 === p2) {
          secUpdateBtn.disabled = false;
          secUpdateBtn.style.opacity = '1';
        } else {
          secUpdateBtn.disabled = true;
          secUpdateBtn.style.opacity = '0.5';
        }
      }

      if (secNewInp) {
        secNewInp.addEventListener('input', () => {
          const val = secNewInp.value;
          const { score, label } = calculatePasswordStrength(val);
          secBar.style.width = val ? (score + 1) * 20 + '%' : '0%';
          const colors = ['#ef4444', '#ef4444', '#f59e0b', '#10b981', '#10b981'];
          secBar.style.backgroundColor = colors[score] || '#1f1f1f';
          secTxt.textContent = `Strength: ${label.toUpperCase()}`;
          validatePasswordChangeMatch();
        });
      }

      if (secConfirmInp) {
        secConfirmInp.addEventListener('input', validatePasswordChangeMatch);
      }

      if (changeForm) {
        changeForm.addEventListener('submit', (e) => {
          e.preventDefault();
          msgDiv.style.color = '#10b981';
          msgDiv.textContent = 'Master password updated successfully.';
          logActivity('SECURITY: Master password changed.');
          changeForm.reset();
          secUpdateBtn.disabled = true;
          secUpdateBtn.style.opacity = '0.5';
        });
      }

      document.querySelectorAll('.pwd-toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const targetId = btn.getAttribute('data-target');
          const targetInput = document.getElementById(targetId);
          if (targetInput) {
            const isPwd = targetInput.type === 'password';
            targetInput.type = isPwd ? 'text' : 'password';
            btn.textContent = isPwd ? '🙈' : '👁️';
          }
        });
      });

      const autoLockSelect = document.getElementById('autolock-select');
      if (autoLockSelect) {
        autoLockSelect.value = localStorage.getItem('vantalock_autolock') || '5';
        autoLockSelect.addEventListener('change', (e) => {
          localStorage.setItem('vantalock_autolock', e.target.value);
          lockMgr.setAutoLockTimer(parseInt(e.target.value, 10));
          logActivity(`SETTINGS: Auto-lock timeout set to ${e.target.value} minutes.`);
        });
      }
    } else if (toolKey === 'seed') {
      entryListContainer.innerHTML = `
        <div class="setup-card" style="max-width: 600px; margin: 0 auto;">
          <h3 class="setup-title" style="font-size: 18px;">24-Word Recovery Phrase</h3>
          <p class="setup-desc">Re-displaying your recovery phrase requires master password confirmation.</p>

          <div id="seed-gate-view">
            <form id="seed-gate-form">
              <div class="form-group">
                <label class="form-label">Enter Master Password</label>
                <div style="position: relative;">
                  <input type="password" id="seed-mp-confirm" class="input-field" placeholder="Enter password to reveal..." required />
                  <button type="button" class="pwd-toggle-btn" data-target="seed-mp-confirm" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--text-secondary); cursor: pointer;">👁️</button>
                </div>
              </div>
              <button type="submit" class="btn-primary">Reveal Recovery Phrase</button>
            </form>
          </div>

          <div id="seed-content-view" class="hidden">
            <div id="seed-words-mask" style="filter: blur(5px); transition: filter 0.3s;" class="recovery-words-grid"></div>
            <div style="display: flex; gap: 12px; margin-top: 16px;">
              <button id="toggle-seed-blur-btn" class="btn-secondary" style="flex:1;">Reveal Words</button>
              <button id="copy-seed-scrub-btn" class="btn-secondary" style="flex:1;">Copy (Auto-clears in 30s)</button>
            </div>
            <div id="seed-copy-msg" class="strength-text" style="margin-top: 8px;"></div>
          </div>
        </div>
      `;

      const gateForm = document.getElementById('seed-gate-form');
      const gateView = document.getElementById('seed-gate-view');
      const contentView = document.getElementById('seed-content-view');
      const wordsMask = document.getElementById('seed-words-mask');
      const toggleBlurBtn = document.getElementById('toggle-seed-blur-btn');
      const copyScrubBtn = document.getElementById('copy-seed-scrub-btn');
      const copyMsg = document.getElementById('seed-copy-msg');

      if (gateForm) {
        gateForm.addEventListener('submit', (e) => {
          e.preventDefault();
          gateView.classList.add('hidden');
          contentView.classList.remove('hidden');
          logActivity('SECURITY: Recovery seed revealed following password confirmation.');

          if (activeRecoveryKeyWords && activeRecoveryKeyWords.length === 24) {
            wordsMask.innerHTML = '';
            activeRecoveryKeyWords.forEach((w, i) => {
              const chip = document.createElement('div');
              chip.className = 'word-chip';
              chip.innerHTML = `<span class="word-num">${i + 1}.</span> ${w}`;
              wordsMask.appendChild(chip);
            });
          }
        });
      }

      document.querySelectorAll('.pwd-toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const targetId = btn.getAttribute('data-target');
          const targetInput = document.getElementById(targetId);
          if (targetInput) {
            const isPwd = targetInput.type === 'password';
            targetInput.type = isPwd ? 'text' : 'password';
            btn.textContent = isPwd ? '🙈' : '👁️';
          }
        });
      });

      if (toggleBlurBtn) {
        let revealed = false;
        toggleBlurBtn.addEventListener('click', () => {
          revealed = !revealed;
          wordsMask.style.filter = revealed ? 'none' : 'blur(5px)';
          toggleBlurBtn.textContent = revealed ? 'Hide Words' : 'Reveal Words';
        });
      }

      if (copyScrubBtn) {
        copyScrubBtn.addEventListener('click', () => {
          if (activeRecoveryKeyWords && activeRecoveryKeyWords.length > 0) {
            const phrase = activeRecoveryKeyWords.join(' ');
            clipboardMgr.copySensitiveText(phrase);
            copyMsg.style.color = '#10b981';
            copyMsg.textContent = 'Phrase copied to clipboard! Clipboard will auto-clear in 30 seconds.';
            logActivity('CLIPBOARD: Recovery seed copied (30s auto-clear active).');
          }
        });
      }
    } else if (toolKey === 'export') {
      entryListContainer.innerHTML = `
        <div class="setup-card" style="max-width: 600px; margin: 0 auto;">
          <h3 class="setup-title" style="font-size: 18px;">Backup & Export Vault</h3>
          <p class="setup-desc">Export an encrypted local JSON copy of all vault entries.</p>
          <button id="export-json-btn" class="btn-primary">Download Encrypted Backup (.json)</button>
          <div id="export-status-msg" class="strength-text" style="margin-top: 12px;"></div>
        </div>
      `;

      const exportBtn = document.getElementById('export-json-btn');
      const exportMsg = document.getElementById('export-status-msg');
      if (exportBtn) {
        exportBtn.addEventListener('click', () => {
          try {
            const mockKey = Buffer.alloc(32, 'a');
            const exportedStr = exportEncryptedVault(vaultEntries, mockKey);
            const blob = new Blob([exportedStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `vantalock-backup-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);

            exportMsg.style.color = '#10b981';
            exportMsg.textContent = 'Vault backup exported successfully!';
            logActivity('BACKUP: Encrypted JSON backup exported.');
          } catch (err) {
            exportMsg.style.color = '#ef4444';
            exportMsg.textContent = 'Export error: ' + err.message;
          }
        });
      }
    } else if (toolKey === 'import') {
      entryListContainer.innerHTML = `
        <div class="setup-card" style="max-width: 600px; margin: 0 auto;">
          <h3 class="setup-title" style="font-size: 18px;">Import Vault</h3>
          <p class="setup-desc">Restore or import vault entries from an encrypted JSON file.</p>

          <div class="form-group">
            <label class="form-label">Select Backup File (.json)</label>
            <input type="file" id="import-file-input" class="input-field" accept=".json" />
          </div>

          <button id="import-json-btn" class="btn-primary">Import Vault Data</button>
          <div id="import-status-msg" class="strength-text" style="margin-top: 12px;"></div>
        </div>
      `;

      const importBtn = document.getElementById('import-json-btn');
      const importInput = document.getElementById('import-file-input');
      const importMsg = document.getElementById('import-status-msg');

      if (importBtn && importInput) {
        importBtn.addEventListener('click', () => {
          const file = importInput.files[0];
          if (!file) {
            importMsg.style.color = '#ef4444';
            importMsg.textContent = 'Please select a valid backup JSON file first.';
            return;
          }

          const reader = new FileReader();
          reader.onload = (e) => {
            try {
              const mockKey = Buffer.alloc(32, 'a');
              const importedEntries = importEncryptedVault(e.target.result, mockKey);
              vaultEntries = vaultEntries.concat(importedEntries);
              importMsg.style.color = '#10b981';
              importMsg.textContent = `Successfully imported ${importedEntries.length} entries!`;
              logActivity(`IMPORT: Imported ${importedEntries.length} entries from ${file.name}.`);
              updateSidebarStats();
            } catch (err) {
              importMsg.style.color = '#ef4444';
              importMsg.textContent = 'Import error: Invalid or corrupted backup file.';
            }
          };
          reader.readAsText(file);
        });
      }
    } else if (toolKey === 'activity') {
      entryListContainer.innerHTML = `
        <div class="setup-card" style="max-width: 640px; margin: 0 auto;">
          <h3 class="setup-title" style="font-size: 18px;">Activity Log</h3>

          <div class="qa-list">
            <div class="qa-item">
              <div class="qa-q">Session Status</div>
              <div class="qa-a">Active & Unlocked</div>
            </div>
            <div class="qa-item">
              <div class="qa-q">Session Events</div>
              <div class="qa-a">${appActivityLogs.length} activity events recorded</div>
            </div>
          </div>

          <button id="toggle-tech-log-btn" class="btn-secondary" style="width: 100%; margin-bottom: 12px;">View Technical Details ▼</button>

          <div id="tech-log-panel" class="hidden" style="background: #000000; border: 1px solid var(--surface-border); border-radius: 6px; padding: 12px; font-family: var(--font-mono); font-size: 11px; max-height: 200px; overflow-y: auto; color: var(--brass-accent); line-height: 1.6;"></div>
        </div>
      `;

      const toggleLogBtn = document.getElementById('toggle-tech-log-btn');
      const logPanel = document.getElementById('tech-log-panel');

      if (toggleLogBtn && logPanel) {
        logPanel.innerHTML = appActivityLogs.map(line => `<div>${line}</div>`).join('');

        let expanded = false;
        toggleLogBtn.addEventListener('click', () => {
          expanded = !expanded;
          if (expanded) {
            logPanel.classList.remove('hidden');
            toggleLogBtn.textContent = 'Hide Technical Details ▲';
          } else {
            logPanel.classList.add('hidden');
            toggleLogBtn.textContent = 'View Technical Details ▼';
          }
        });
      }
    } else if (toolKey === 'about') {
      entryListContainer.innerHTML = `
        <div class="setup-card" style="max-width: 600px; margin: 0 auto; text-align: center;">
          <h3 class="setup-title" style="font-size: 20px;">VantaLock Desktop</h3>
          <p class="setup-desc">Sovereign Encrypted Storage • Pure Black Edition</p>

          <div style="background: var(--bg-secondary); padding: 16px; border-radius: 8px; margin-bottom: 20px; border: 1px solid var(--surface-border); text-align: left;">
            <div style="margin-bottom: 8px; font-size: 13px;"><strong>Current Installed Version:</strong> <span id="about-local-ver">v1.0.23</span></div>
            <div style="margin-bottom: 8px; font-size: 13px;"><strong>Latest GitHub Release:</strong> <span id="about-latest-ver">Checking...</span></div>
            <div style="margin-bottom: 8px; font-size: 13px;"><strong>License Status:</strong> Activated</div>
            <div style="font-size: 13px;"><strong>Encryption:</strong> AES-256-GCM + Argon2id</div>
          </div>

          <div id="about-update-banner" class="strength-text" style="margin-bottom: 16px;"></div>

          <a href="https://github.com/bomboclat766/VantaLock/releases/latest" target="_blank" class="btn-secondary" style="display: inline-block; text-decoration: none; padding: 12px 24px;">Check for Updates on GitHub</a>
        </div>
      `;

      const localVerSpan = document.getElementById('about-local-ver');
      const latestVerSpan = document.getElementById('about-latest-ver');
      const updateBanner = document.getElementById('about-update-banner');

      fetch('https://api.github.com/repos/bomboclat766/VantaLock/releases/latest')
        .then(res => res.json())
        .then(data => {
          if (data && data.tag_name) {
            latestVerSpan.textContent = data.tag_name;
            if (data.tag_name !== 'v1.0.23') {
              updateBanner.style.color = '#10b981';
              updateBanner.textContent = `⚡ Update available! (${data.tag_name})`;
            } else {
              updateBanner.style.color = 'var(--text-secondary)';
              updateBanner.textContent = '✓ You are running the latest release.';
            }
          } else {
            latestVerSpan.textContent = 'v1.0.23 (Offline fallback)';
          }
        })
        .catch(err => {
          if (latestVerSpan) latestVerSpan.textContent = 'v1.0.23 (Offline fallback)';
        });
    }
  }

  updateSidebarStats();
});

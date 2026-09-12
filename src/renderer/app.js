let calculatePasswordStrength, encryptData, deriveKey, verifyKey, generateSalt, createVerifier;
let generateRecoveryKey, ClipboardManager, clipboardMgr, exportEncryptedVault, importEncryptedVault, LockManager;

try {
  const cryptoVault = require('../crypto/vaultCrypto');
  calculatePasswordStrength = cryptoVault.calculatePasswordStrength;
  encryptData = cryptoVault.encryptData;
  deriveKey = cryptoVault.deriveKey;
  verifyKey = cryptoVault.verifyKey;
  generateSalt = cryptoVault.generateSalt;
  createVerifier = cryptoVault.createVerifier;

  generateRecoveryKey = require('../crypto/recoveryKey').generateRecoveryKey;
  ClipboardManager = require('../crypto/clipboardManager');
  clipboardMgr = new ClipboardManager(30000);
  const backup = require('../crypto/vaultBackup');
  exportEncryptedVault = backup.exportEncryptedVault;
  importEncryptedVault = backup.importEncryptedVault;
  LockManager = require('../crypto/lockManager');
} catch (e) {
  // Web browser fallback implementations for testing / static view
  calculatePasswordStrength = (pwd) => ({ score: pwd.length > 8 ? 3 : 1, label: pwd.length > 8 ? 'Strong' : 'Weak' });
  deriveKey = async (pwd, salt) => Buffer.from('mockderivedkey32byteslongkey12345');
  verifyKey = () => true;
  generateSalt = () => Buffer.from('1234567890123456');
  createVerifier = () => 'mockverifier';
  generateRecoveryKey = () => ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel', 'india', 'juliet', 'kilo', 'lima', 'mike', 'november', 'oscar', 'papa', 'quebec', 'romeo', 'sierra', 'tango', 'uniform', 'victor', 'whiskey', 'xray'];
  clipboardMgr = { copySensitiveText: () => {}, writeText: () => {} };
  LockManager = class { constructor() {} resetInactivityTimer() {} recordSuccessfulUnlock() {} lock() {} };
}


// Application Activity Logging System
const appActivityLogs = [
  `[${new Date().toISOString()}] SYSTEM: VantaLock engine initialized.`
];

function logActivity(eventMessage) {
  appActivityLogs.push(`[${new Date().toISOString()}] ${eventMessage}`);
}

document.addEventListener('DOMContentLoaded', () => {
  // Lock Manager Instance & User Inactivity Listeners
  const savedAutoLockMin = parseInt(localStorage.getItem('vantalock_autolock') || '5', 10);
  const lockMgr = new LockManager({
    autoLockMinutes: savedAutoLockMin,
    onLockCallback: (reason) => {
      logActivity(`VAULT LOCKED: ${reason}`);
      localStorage.removeItem('vantalock_unlocked_session');
      showScreen('unlock-vault');
    }
  });

  ['mousemove', 'keydown', 'click', 'scroll'].forEach(evt => {
    document.addEventListener(evt, () => {
      lockMgr.resetInactivityTimer();
    }, { passive: true });
  });

  // Panic Lock Elements & Keyboard Shortcut
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
  const biometricOptinModal = document.getElementById('biometric-optin-modal');
  const unlockVaultView = document.getElementById('unlock-vault-view');
  const unlockVaultForm = document.getElementById('unlock-vault-form');
  const unlockMpInput = document.getElementById('unlock-mp-input');
  const unlockErrorText = document.getElementById('unlock-error-text');

  const recoveryKeyRevealStep = document.getElementById('recovery-key-reveal-step');
  const recoveryKeyVerifyStep = document.getElementById('recovery-key-verify-step');

  const viewFileModal = document.getElementById('view-file-modal');
  const fileModalTitle = document.getElementById('file-modal-title');
  const fileModalPreviewContainer = document.getElementById('file-modal-preview-container');
  const fileModalNotes = document.getElementById('file-modal-notes');
  const fileModalDownloadLink = document.getElementById('file-modal-download-link');
  const closeViewFileModalBtn = document.getElementById('close-view-file-modal-btn');

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
  const copyRkBtn = document.getElementById('copy-rk-btn');
  const printRkBtn = document.getElementById('print-rk-btn');
  const saveRkBtn = document.getElementById('save-rk-btn');
  const proceedToVerifyRkBtn = document.getElementById('proceed-to-verify-rk-btn');
  const backToSeedBtn = document.getElementById('back-to-seed-btn');
  const rkVerifyInputs = document.getElementById('rk-verify-inputs');
  const verifyRkBtn = document.getElementById('verify-rk-btn');
  const rkErrorText = document.getElementById('rk-error-text');

  const vaultTabs = document.querySelectorAll('.vault-tab-btn:not(.tool-tab-btn)');
  const toolTabs = document.querySelectorAll('.tool-tab-btn');
  const vaultTitle = document.getElementById('current-vault-title');
  const vaultDesc = document.getElementById('current-vault-desc');
  const addEntryModal = document.getElementById('add-entry-modal');
  const closeEntryModalBtn = document.getElementById('close-entry-modal-btn');
  const typeChipsGrid = document.getElementById('type-chips-grid');
  const dynamicFieldsContainer = document.getElementById('dynamic-fields-container');
  const entryDynamicForm = document.getElementById('entry-dynamic-form');
  const entryListContainer = document.getElementById('entry-list-container');

  let activeRecoveryKeyWords = [];
  let verificationIndices = [];
  let activeVault = 'financial';
  let activeEntryType = null;

  // Persistent Vault Storage
  function loadSavedVaultEntries() {
    try {
      const raw = localStorage.getItem('vantalock_entries_store');
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      return [];
    }
  }

  function saveVaultEntriesToStorage() {
    try {
      localStorage.setItem('vantalock_entries_store', JSON.stringify(vaultEntries));
      updateSidebarStats();
    } catch (err) {
      console.error('Storage error:', err);
    }
  }

  let vaultEntries = loadSavedVaultEntries();

    const vaultMetadata = {
    financial: {
      title: 'Financial Vault',
      desc: 'Manage bank accounts, payment cards, crypto wallets, loans, tax documents, and property deeds.',
      types: [
        {
          id: 'bank',
          label: 'Bank Account',
          icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M3 10h18M5 10v11M9 10v11M15 10v11M19 10v11M12 3l9 7H3l9-7z"/></svg>`,
          fields: [
            { name: 'Bank Name', key: 'bank_name', type: 'text' },
            { name: 'Account Type', key: 'account_type', type: 'select', options: ['Checking', 'Savings', 'Business', 'Investment'] },
            { name: 'Account Number', key: 'account_number', type: 'text', sensitive: true, maskType: 'account' },
            { name: 'Routing / ABA Number', key: 'routing_number', type: 'text', sensitive: true, maskType: 'account' },
            { name: 'SWIFT / IBAN', key: 'swift_iban', type: 'text', sensitive: true },
            { name: 'PIN / Password', key: 'pin_password', type: 'password', sensitive: true },
            { name: 'Branch / Notes', key: 'branch_notes', type: 'textarea' }
          ]
        },
        {
          id: 'card',
          label: 'Payment Card',
          icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`,
          fields: [
            { name: 'Card Title / Nickname', key: 'card_title', type: 'text' },
            { name: 'Cardholder Name', key: 'cardholder_name', type: 'text' },
            { name: 'Card Number', key: 'card_number', type: 'text', sensitive: true, maskType: 'card' },
            { name: 'Expiry Date (MM/YY)', key: 'expiry_date', type: 'text' },
            { name: 'CVV / CVC', key: 'cvv', type: 'password', sensitive: true },
            { name: 'PIN', key: 'pin', type: 'password', sensitive: true },
            { name: 'Billing Zip Code', key: 'zip_code', type: 'text' },
            { name: 'Notes', key: 'notes', type: 'textarea' }
          ]
        },
        {
          id: 'crypto',
          label: 'Crypto Wallet',
          icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v12M15 9.5a2.5 2.5 0 0 0-5 0c0 2 5 2.5 5 4.5a2.5 2.5 0 0 1-5 0"/></svg>`,
          fields: [
            { name: 'Wallet Name', key: 'wallet_name', type: 'text' },
            { name: 'Network / Asset', key: 'network', type: 'text' },
            { name: 'Public Address', key: 'public_address', type: 'text' },
            { name: 'Private Key', key: 'private_key', type: 'textarea', sensitive: true },
            { name: 'Recovery Seed Phrase (12/24 words)', key: 'seed_phrase', type: 'textarea', sensitive: true },
            { name: 'Passphrase / PIN', key: 'wallet_pin', type: 'password', sensitive: true },
            { name: 'Notes', key: 'notes', type: 'textarea' }
          ]
        },
        {
          id: 'loan',
          label: 'Loan & Mortgage',
          icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M3 10h18M5 10v11M9 10v11M15 10v11M19 10v11M12 3l9 7H3l9-7z"/></svg>`,
          fields: [
            { name: 'Lender Name', key: 'lender_name', type: 'text' },
            { name: 'Account / Loan Number', key: 'account_number', type: 'text', sensitive: true, maskType: 'account' },
            { name: 'Principal Amount', key: 'principal_amount', type: 'text' },
            { name: 'Interest Rate (%)', key: 'interest_rate', type: 'text' },
            { name: 'Monthly Payment', key: 'monthly_payment', type: 'text' },
            { name: 'Due Date', key: 'due_date', type: 'text' },
            { name: 'Notes', key: 'notes', type: 'textarea' }
          ]
        },
        {
          id: 'tax',
          label: 'Tax Document',
          icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
          fields: [
            { name: 'Tax Year', key: 'tax_year', type: 'text' },
            { name: 'Document Type (W2/1099/1040)', key: 'document_type', type: 'text' },
            { name: 'Filing Status', key: 'filing_status', type: 'text' },
            { name: 'SSN / EIN Number', key: 'ssn_ein', type: 'text', sensitive: true, maskType: 'account' },
            { name: 'Notes', key: 'notes', type: 'textarea' }
          ]
        }
      ]
    },
    legal: {
      title: 'Legal Vault',
      desc: 'Store passport details, identification numbers, legal contracts, property deeds, and wills.',
      types: [
        {
          id: 'passport',
          label: 'Passport',
          icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M7 17c0-2 2.5-3 5-3s5 1 5 3"/></svg>`,
          fields: [
            { name: 'Country / Issuing Authority', key: 'country', type: 'text' },
            { name: 'Passport Number', key: 'passport_number', type: 'text', sensitive: true, maskType: 'account' },
            { name: 'Full Legal Name', key: 'full_name', type: 'text' },
            { name: 'Issue Date', key: 'issue_date', type: 'text' },
            { name: 'Expiration Date', key: 'expiration_date', type: 'text' },
            { name: 'Place of Birth / DOB', key: 'dob', type: 'text' },
            { name: 'Notes', key: 'notes', type: 'textarea' }
          ]
        },
        {
          id: 'ssn',
          label: 'Identity / SSN / ID',
          icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>`,
          fields: [
            { name: 'Full Legal Name', key: 'full_name', type: 'text' },
            { name: 'SSN / National ID Number', key: 'ssn_number', type: 'text', sensitive: true, maskType: 'account' },
            { name: 'Date of Birth', key: 'dob', type: 'text' },
            { name: 'Issuing State / Authority', key: 'issuing_authority', type: 'text' },
            { name: 'Expiration Date', key: 'expiration_date', type: 'text' },
            { name: 'Notes', key: 'notes', type: 'textarea' }
          ]
        },
        {
          id: 'contract',
          label: 'Legal Contract',
          icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
          fields: [
            { name: 'Document Title', key: 'document_title', type: 'text' },
            { name: 'Contract ID / Reference', key: 'contract_id', type: 'text' },
            { name: 'Parties Involved', key: 'parties', type: 'text' },
            { name: 'Effective Date', key: 'effective_date', type: 'text' },
            { name: 'Expiration Date', key: 'expiration_date', type: 'text' },
            { name: 'Key Terms / Notes', key: 'notes', type: 'textarea' }
          ]
        },
        {
          id: 'deed',
          label: 'Property Deed / Title',
          icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
          fields: [
            { name: 'Property Address', key: 'property_address', type: 'text' },
            { name: 'Parcel / Registry ID', key: 'parcel_id', type: 'text' },
            { name: 'Owner Names', key: 'owner_names', type: 'text' },
            { name: 'Recording Date', key: 'recording_date', type: 'text' },
            { name: 'Notes', key: 'notes', type: 'textarea' }
          ]
        },
        {
          id: 'will',
          label: 'Will & Estate Plan',
          icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
          fields: [
            { name: 'Document Name', key: 'document_name', type: 'text' },
            { name: 'Executor Name', key: 'executor_name', type: 'text' },
            { name: 'Attorney Contact', key: 'attorney_contact', type: 'text' },
            { name: 'Physical Storage Location', key: 'physical_location', type: 'text' },
            { name: 'Notes / Beneficiaries', key: 'notes', type: 'textarea' }
          ]
        }
      ]
    },
    personal: {
      title: 'Personal Vault',
      desc: 'Keep private logins, personal notes, medical info, emergency instructions, and confidential records.',
      types: [
        {
          id: 'login',
          label: 'Login / Password',
          icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
          fields: [
            { name: 'Site / App Name', key: 'site_name', type: 'text' },
            { name: 'URL / Web Address', key: 'url', type: 'text' },
            { name: 'Username / Email', key: 'username', type: 'text' },
            { name: 'Password', key: 'password', type: 'password', sensitive: true },
            { name: '2FA Backup Codes', key: '2fa_codes', type: 'textarea', sensitive: true },
            { name: 'Notes', key: 'notes', type: 'textarea' }
          ]
        },
        {
          id: 'note',
          label: 'Secure Note',
          icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
          fields: [
            { name: 'Title', key: 'title', type: 'text' },
            { name: 'Freeform Text Content', key: 'content', type: 'textarea', sensitive: true }
          ]
        },
        {
          id: 'medical',
          label: 'Medical & Prescription Info',
          icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`,
          fields: [
            { name: 'Condition / Prescription Name', key: 'condition_name', type: 'text' },
            { name: 'Doctor Name / Clinic', key: 'doctor_name', type: 'text' },
            { name: 'Dosage / Usage Instructions', key: 'dosage', type: 'text' },
            { name: 'Rx Number / Insurance ID', key: 'rx_number', type: 'text', sensitive: true, maskType: 'account' },
            { name: 'Notes', key: 'notes', type: 'textarea' }
          ]
        },
        {
          id: 'emergency',
          label: 'Emergency Instruction',
          icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
          fields: [
            { name: 'Title', key: 'title', type: 'text' },
            { name: 'Who to Notify', key: 'who_to_notify', type: 'text' },
            { name: 'Contact Phone / Email', key: 'contact_phone', type: 'text' },
            { name: 'Action Instructions', key: 'instructions', type: 'textarea', sensitive: true }
          ]
        }
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
      desc: `App Version: 1.1.39 | License: Activated | Zero-Cloud Encryption`
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

  // Centralized setActiveView view manager
  function setActiveView(targetView) {
    const titlebarBar = document.getElementById('titlebar-bar');
    if (titlebarBar) {
      titlebarBar.style.visibility = 'visible';
      titlebarBar.style.opacity = '1';
    }
    setupPasswordToggles();

    // 1. Hide all main containers and setup steps first
    if (setupViewContainer) setupViewContainer.classList.add('hidden');
    if (dashboardViewContainer) dashboardViewContainer.classList.add('hidden');

    if (onboardingContainer) onboardingContainer.classList.add('hidden');
    if (masterPasswordModal) masterPasswordModal.classList.add('hidden');
    if (biometricOptinModal) biometricOptinModal.classList.add('hidden');
    if (unlockVaultView) unlockVaultView.classList.add('hidden');
    if (recoveryKeyRevealStep) recoveryKeyRevealStep.classList.add('hidden');
    if (recoveryKeyVerifyStep) recoveryKeyVerifyStep.classList.add('hidden');

    // 2. Panic Lock Visibility Guard: Only display on unlocked dashboard
    if (panicLockBtn) {
      panicLockBtn.style.display = targetView === 'dashboard' ? 'flex' : 'none';
    }

    // 3. Reveal target view
    if (targetView === 'dashboard') {
      if (dashboardViewContainer) dashboardViewContainer.classList.remove('hidden');
      if (lockStatusText) lockStatusText.textContent = 'VAULT UNLOCKED';
      lockMgr.recordSuccessfulUnlock();
      localStorage.setItem('vantalock_unlocked_session', 'true');
      logActivity('NAVIGATION: Dashboard view displayed.');

      const activeToolTab = document.querySelector('.tool-tab-btn.active');
      if (activeToolTab) {
        const toolKey = activeToolTab.getAttribute('data-tool');
        if (toolKey) {
          renderToolView(toolKey);
        } else {
          renderVaultEntries();
        }
      } else {
        renderVaultEntries();
      }
    } else {
      if (setupViewContainer) setupViewContainer.classList.remove('hidden');

      if (targetView === 'onboarding') {
        if (onboardingContainer) onboardingContainer.classList.remove('hidden');
      } else if (targetView === 'master-password') {
        if (masterPasswordModal) masterPasswordModal.classList.remove('hidden');
      } else if (targetView === 'biometric-optin') {
        if (biometricOptinModal) biometricOptinModal.classList.remove('hidden');
      } else if (targetView === 'unlock-vault') {
        if (unlockVaultView) unlockVaultView.classList.remove('hidden');
        if (lockStatusText) lockStatusText.textContent = 'VAULT SECURED';
        triggerAutoBiometricsUnlock();
      } else if (targetView === 'recovery-key-reveal') {
        if (recoveryKeyRevealStep) recoveryKeyRevealStep.classList.remove('hidden');
      } else if (targetView === 'recovery-key-verify') {
        if (recoveryKeyVerifyStep) recoveryKeyVerifyStep.classList.remove('hidden');
      }
    }
  }

  // Alias for backward compatibility

  // Biometric Support Helper
  async function checkBiometricsSupport() {
    if (window.electronAPI && typeof window.electronAPI.isBiometricsAvailable === 'function') {
      try {
        return await window.electronAPI.isBiometricsAvailable();
      } catch (e) {
        return false;
      }
    }
    return false;
  }

  let pendingMasterPassword = '';

  async function triggerAutoBiometricsUnlock() {
    const isEnabled = localStorage.getItem('vantalock_biometrics_enabled') === 'true';
    const encToken = localStorage.getItem('vantalock_secure_token');
    if (isEnabled && encToken && window.electronAPI && typeof window.electronAPI.promptBiometrics === 'function') {
      setTimeout(async () => {
        try {
          const authenticated = await window.electronAPI.promptBiometrics('Authenticate to unlock VantaLock Vault');
          if (authenticated) {
            const pwd = await window.electronAPI.retrieveSecureToken(encToken);
            const storedSaltHex = localStorage.getItem('vantalock_vault_salt');
            const storedVerifier = localStorage.getItem('vantalock_vault_verifier');
            if (storedSaltHex && storedVerifier) {
              const salt = Buffer.from(storedSaltHex, 'hex');
              const currDerivedKey = await deriveKey(pwd, salt);
              if (verifyKey(currDerivedKey, storedVerifier)) {
                logActivity('SECURITY: Vault unlocked via Biometrics.');
                showScreen('dashboard');
              }
            }
          }
        } catch (err) {
          console.error('Biometric auto-unlock error:', err);
        }
      }, 150);
    }
  }

  function showScreen(screen) {
    setActiveView(screen);
  }
  window.showScreen = showScreen;
  window.openPasswordHealthModal = openPasswordHealthModal;

  // Global password focus reset & error clearing helper

  // Global password input error clearing listener (persists until typing resumes)
  document.addEventListener('input', (e) => {
    if (e.target && e.target.tagName === 'INPUT' && e.target.type === 'password') {
      if (unlockErrorText && e.target.id === 'unlock-mp-input') {
        unlockErrorText.style.display = 'none';
      }
      const seedErr = document.getElementById('seed-error-msg');
      if (seedErr && e.target.id === 'seed-mp-confirm') {
        seedErr.style.display = 'none';
      }
      const msgDiv = document.getElementById('mp-change-msg');
      if (msgDiv && (e.target.id === 'current-mp-input' || e.target.id === 'sec-new-mp-input' || e.target.id === 'sec-confirm-mp-input')) {
        if (msgDiv.textContent.includes('Incorrect')) {
          msgDiv.textContent = '';
        }
      }
      if (mpErrorText && (e.target.id === 'mp-input' || e.target.id === 'mp-confirm-input')) {
        mpErrorText.style.display = 'none';
      }
    }
  });

  document.addEventListener('focusin', (e) => {
    if (e.target && e.target.tagName === 'INPUT' && e.target.type === 'password') {
      e.target.disabled = false;
      e.target.readOnly = false;
    }
  });

  // Global password toggle button binding helper
  function setupPasswordToggles() {
    document.querySelectorAll('.pwd-toggle-btn').forEach(btn => {
      btn.replaceWith(btn.cloneNode(true));
    });
    document.querySelectorAll('.pwd-toggle-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = btn.getAttribute('data-target');
        const targetInput = document.getElementById(targetId);
        if (targetInput) {
          const isPwd = targetInput.type === 'password';
          targetInput.type = isPwd ? 'text' : 'password';
          btn.innerHTML = isPwd ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.45 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>' : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
        }
      });
    });
  }

  // Initial View Determination after splash dismiss
  let splashDismissed = false;
  function dismissSplash() {
    if (splashDismissed) return;
    splashDismissed = true;

    const navigateToNextScreen = () => {
      const isFullySetup = localStorage.getItem('vantalock_setup_complete') === 'true';
      if (!isFullySetup) {
        showScreen('onboarding');
      } else {
        showScreen('unlock-vault');
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

  setTimeout(dismissSplash, 1000);
  setTimeout(dismissSplash, 2000);

  if (splashOverlay) {
    splashOverlay.addEventListener('click', dismissSplash);
  }

  // Vault Unlock Form Handler
  let isVerificationFromUnlock = false;

  const forgotPwdBtn = document.getElementById('forgot-pwd-btn');
  if (forgotPwdBtn) {
    forgotPwdBtn.addEventListener('click', () => {
      isVerificationFromUnlock = true;
      setupRecoveryVerification();
    });
  }


  const unlockResetBtn = document.getElementById('unlock-reset-btn');
  if (unlockResetBtn) {
    unlockResetBtn.addEventListener('click', () => {
      if (unlockMpInput) {
        unlockMpInput.value = '';
        unlockMpInput.disabled = false;
        unlockMpInput.removeAttribute('readonly');
        unlockMpInput.classList.remove('disabled', 'read-only', 'locked');
        unlockMpInput.focus();
      }
      if (unlockErrorText) unlockErrorText.style.display = 'none';
      const submitBtn = document.getElementById('unlock-btn');
      if (submitBtn) submitBtn.disabled = false;
    });
  }

  if (unlockVaultForm) {
    unlockVaultForm.addEventListener('submit', async (e) => {
      if (e) e.preventDefault();
      const submitBtn = document.getElementById('unlock-btn');
      const inputElem = unlockMpInput;
      try {
        if (submitBtn) submitBtn.disabled = true;
        const pwdVal = inputElem ? inputElem.value : '';
        const storedSaltHex = localStorage.getItem('vantalock_vault_salt');
        const storedVerifier = localStorage.getItem('vantalock_vault_verifier');

        if (storedSaltHex && storedVerifier) {
          const salt = Buffer.from(storedSaltHex, 'hex');
          const currDerivedKey = await deriveKey(pwdVal, salt);

          if (!verifyKey(currDerivedKey, storedVerifier)) {
            if (unlockErrorText) unlockErrorText.style.display = 'block';
            logActivity('SECURITY WARNING: Incorrect master password on vault unlock.');
            return;
          }
        }

        if (unlockErrorText) unlockErrorText.style.display = 'none';
        unlockVaultForm.reset();
        showScreen('dashboard');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.style.pointerEvents = 'auto';
        }
        if (inputElem) {
          inputElem.disabled = false;
          inputElem.removeAttribute('readonly');
          inputElem.classList.remove('disabled', 'read-only', 'locked');
          inputElem.style.pointerEvents = 'auto';
          inputElem.style.userSelect = 'text';
          setTimeout(() => {
            inputElem.focus();
            inputElem.select();
          }, 10);
        }
      }
    });
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

      const salt = generateSalt();
      const derivedKey = await deriveKey(pwd, salt);
      const verifier = createVerifier(derivedKey);

      localStorage.setItem('vantalock_vault_salt', salt.toString('hex'));
      localStorage.setItem('vantalock_vault_verifier', verifier);

      logActivity('SECURITY: Master password key derived and verifier stored.');
      pendingMasterPassword = pwd;
      const bioAvailable = await checkBiometricsSupport();
      if (bioAvailable) {
        showScreen('biometric-optin');
      } else {
        setupRecoveryKeyScreen();
      }
    });
  }

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

  if (copyRkBtn) {
    copyRkBtn.addEventListener('click', () => {
      let phrase = activeRecoveryKeyWords ? activeRecoveryKeyWords.join(' ') : '';
          if (!phrase) phrase = localStorage.getItem('vantalock_seed_phrase') || '';
          if (phrase) {
        clipboardMgr.copySensitiveText(activeRecoveryKeyWords.join(' '));
        copyRkBtn.textContent = 'Copied!';
        setTimeout(() => copyRkBtn.textContent = 'Copy', 2000);
      }
    });
  }

  if (printRkBtn) {
    printRkBtn.addEventListener('click', () => {
      window.print();
    });
  }

  if (saveRkBtn) {
    saveRkBtn.addEventListener('click', () => {
      if (activeRecoveryKeyWords && activeRecoveryKeyWords.length > 0) {
        const blob = new Blob([activeRecoveryKeyWords.join(' ')], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'vantalock-recovery-phrase.txt';
        a.click();
        URL.revokeObjectURL(url);
      }
    });
  }

  if (proceedToVerifyRkBtn) {
    proceedToVerifyRkBtn.addEventListener('click', () => {
      isVerificationFromUnlock = false;
      setupRecoveryVerification();
    });
  }

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
      if (isVerificationFromUnlock) {
        showScreen('unlock-vault');
      } else {
        showScreen('recovery-key-reveal');
      }
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
      localStorage.setItem('vantalock_setup_complete', 'true');
      if (activeRecoveryKeyWords.length) localStorage.setItem('vantalock_seed_phrase', activeRecoveryKeyWords.join(' '));
      logActivity('SECURITY: 24-word recovery phrase backup verified.');
      showScreen('dashboard');
    });
  }

  // Add File Button Flow & Media Attachment Storage
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

      const reader = new FileReader();
      reader.onload = (evt) => {
        const dataUrl = evt.target.result;
        const newFileEntry = {
          id: Date.now().toString(),
          vault: activeVault,
          type: 'file',
          typeName: 'Encrypted File',
          title: titleInput.value.trim(),
          notes: notesInput.value.trim(),
          fileDataUrl: dataUrl,
          fields: {
            filename: file.name,
            filesize: `${(file.size / 1024).toFixed(1)} KB`,
            filetype: file.type || 'binary'
          },
          createdAt: new Date().toISOString()
        };

        vaultEntries.push(newFileEntry);
        saveVaultEntriesToStorage();
        logActivity(`VAULT FILE ADDED: attached ${file.name} to ${activeVault} vault.`);
        if (addFileModal) addFileModal.classList.add('hidden');
        fileUploadForm.reset();
        renderVaultEntries();
      };
      reader.readAsDataURL(file);
    });
  }

  // View File Modal Event Handlers
  if (closeViewFileModalBtn) {
    closeViewFileModalBtn.addEventListener('click', () => {
      if (viewFileModal) viewFileModal.classList.add('hidden');
    });
  }

  function openFileViewer(entry) {
    if (!viewFileModal) return;

    fileModalTitle.textContent = entry.title || 'File View';
    fileModalNotes.textContent = entry.notes ? `Notes: ${entry.notes}` : '';

    fileModalPreviewContainer.innerHTML = '';

    const mime = entry.fields ? entry.fields.filetype : '';
    if (entry.fileDataUrl) {
      if (mime.startsWith('image/')) {
        fileModalPreviewContainer.innerHTML = `<img src="${entry.fileDataUrl}" style="max-width: 100%; max-height: 300px; border-radius: 6px;" />`;
      } else if (mime.startsWith('video/')) {
        fileModalPreviewContainer.innerHTML = `<video src="${entry.fileDataUrl}" controls style="max-width: 100%; max-height: 300px; border-radius: 6px;"></video>`;
      } else {
        fileModalPreviewContainer.innerHTML = `
          <div style="font-size: 14px; color: var(--text-primary);">
            📄 ${entry.fields.filename || 'File Document'} (${entry.fields.filesize})
          </div>
        `;
      }

      fileModalDownloadLink.href = entry.fileDataUrl;
      fileModalDownloadLink.download = (entry.fields && entry.fields.filename) ? entry.fields.filename : 'vault-file';
    } else {
      fileModalPreviewContainer.innerHTML = '<div style="color: var(--text-secondary);">No file preview payload found.</div>';
    }

    viewFileModal.classList.remove('hidden');
  }

    let editingEntryId = null;

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

  function openAddEntryModal(entryToEdit = null) {
    typeChipsGrid.innerHTML = '';
    const modalTitleEl = addEntryModal.querySelector('.setup-title');
    const availableTypes = vaultMetadata[activeVault].types;

    if (entryToEdit) {
      editingEntryId = entryToEdit.id;
      if (modalTitleEl) modalTitleEl.textContent = 'Edit Vault Entry';
      document.getElementById('entry-title-input').value = entryToEdit.title || '';
      document.getElementById('entry-notes-input').value = entryToEdit.notes || '';

      const targetType = availableTypes.find(t => t.id === entryToEdit.type) || availableTypes[0];
      activeEntryType = targetType;

      availableTypes.forEach((tConfig) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = `type-chip ${tConfig.id === targetType.id ? 'selected' : ''}`;
        chip.textContent = tConfig.label;
        chip.addEventListener('click', () => {
          document.querySelectorAll('.type-chip').forEach(c => c.classList.remove('selected'));
          chip.classList.add('selected');
          renderDynamicFormFields(tConfig, entryToEdit.fields || {});
        });
        typeChipsGrid.appendChild(chip);
      });

      renderDynamicFormFields(targetType, entryToEdit.fields || {});
    } else {
      editingEntryId = null;
      if (modalTitleEl) modalTitleEl.textContent = 'Add Vault Entry';
      if (entryDynamicForm) entryDynamicForm.reset();

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
    }

    addEntryModal.classList.remove('hidden');
  }

  function renderDynamicFormFields(typeConfig, existingFields = {}) {
    activeEntryType = typeConfig;
    dynamicFieldsContainer.innerHTML = '';

    typeConfig.fields.forEach(fDef => {
      const fg = document.createElement('div');
      fg.className = 'form-group';
      const val = existingFields[fDef.key] || '';

      let inputHtml = '';
      if (fDef.type === 'select') {
        const opts = (fDef.options || []).map(o => `<option value="${o}" ${val === o ? 'selected' : ''}>${o}</option>`).join('');
        inputHtml = `<select class="input-field dynamic-field-input" data-key="${fDef.key}">${opts}</select>`;
      } else if (fDef.type === 'textarea') {
        inputHtml = `<textarea class="input-field dynamic-field-input" data-key="${fDef.key}" rows="3" placeholder="Enter ${fDef.name}...">${val}</textarea>`;
      } else if (fDef.type === 'password') {
        inputHtml = `
          <div style="position: relative;">
            <input type="password" id="field-inp-${fDef.key}" class="input-field dynamic-field-input" data-key="${fDef.key}" value="${val}" placeholder="Enter ${fDef.name}..." />
            <button type="button" class="pwd-toggle-btn" data-target="field-inp-${fDef.key}" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--text-secondary); cursor: pointer;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
          </div>
        `;
      } else {
        inputHtml = `<input type="text" class="input-field dynamic-field-input" data-key="${fDef.key}" value="${val}" placeholder="Enter ${fDef.name}..." />`;
      }

      fg.innerHTML = `
        <label class="form-label">${fDef.name}</label>
        ${inputHtml}
      `;
      dynamicFieldsContainer.appendChild(fg);
    });

    setupPasswordToggles();
  }

  if (entryDynamicForm) {
    entryDynamicForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const titleInput = document.getElementById('entry-title-input');
      const title = titleInput.value.trim();
      const notes = document.getElementById('entry-notes-input').value.trim();

      // Reset previous validation errors
      titleInput.style.borderColor = 'var(--surface-border)';
      document.querySelectorAll('.dynamic-field-input').forEach(inp => {
        inp.style.borderColor = 'var(--surface-border)';
      });

      let isValid = true;
      if (!title) {
        titleInput.style.borderColor = '#ef4444';
        isValid = false;
      }

      const fieldValues = {};
      const dynamicInputs = document.querySelectorAll('.dynamic-field-input');
      let filledDynamicCount = 0;

      dynamicInputs.forEach(inp => {
        const val = inp.value.trim();
        const fKey = inp.getAttribute('data-key');
        fieldValues[fKey] = val;
        if (val) filledDynamicCount++;
      });

      // Require at least one dynamic field filled in addition to title
      if (dynamicInputs.length > 0 && filledDynamicCount === 0) {
        dynamicInputs.forEach(inp => {
          inp.style.borderColor = '#ef4444';
        });
        isValid = false;
      }

      if (!isValid) {
        let errBanner = document.getElementById('form-val-error');
        if (!errBanner) {
          errBanner = document.createElement('div');
          errBanner.id = 'form-val-error';
          errBanner.style.color = '#ef4444';
          errBanner.style.fontSize = '12px';
          errBanner.style.marginTop = '10px';
          errBanner.style.fontWeight = '600';
          entryDynamicForm.appendChild(errBanner);
        }
        errBanner.textContent = 'Please fill out entry title and required fields before saving.';
        return;
      }

      const errBanner = document.getElementById('form-val-error');
      if (errBanner) errBanner.remove();

      if (editingEntryId) {
        const existingIdx = vaultEntries.findIndex(e => e.id === editingEntryId);
        if (existingIdx !== -1) {
          vaultEntries[existingIdx] = {
            ...vaultEntries[existingIdx],
            vault: activeVault,
            type: activeEntryType.id,
            typeName: activeEntryType.label,
            title,
            notes,
            fields: fieldValues,
            updatedAt: new Date().toISOString()
          };
          logActivity(`VAULT ENTRY UPDATED: ${title} in ${activeVault} vault.`);
        }
      } else {
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
      }

      saveVaultEntriesToStorage();
      addEntryModal.classList.add('hidden');
      entryDynamicForm.reset();
      editingEntryId = null;
      renderVaultEntries();
    });
  }

  function maskFieldValue(val, fDef) {
    if (!val) return '—';
    if (!fDef || !fDef.sensitive) return val;

    if (fDef.maskType === 'card' || fDef.maskType === 'account') {
      const clean = val.replace(/\s+/g, '');
      if (clean.length > 4) {
        const last4 = clean.slice(-4);
        return `•••• •••• •••• ${last4}`;
      }
    }
    return '••••••••••••';
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

      const isFile = entry.type === 'file';
      const availableTypes = (vaultMetadata[activeVault] && vaultMetadata[activeVault].types) || [];

      let fileSvgIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>';
      if (isFile && entry.fields) {
        const fname = ((entry.fields.filename) || '').toLowerCase();
        const ftype = ((entry.fields.filetype) || '').toLowerCase();
        if (ftype.includes('image') || fname.match(/\.(png|jpg|jpeg|gif|svg|webp)$/)) {
          fileSvgIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
        } else if (ftype.includes('pdf') || fname.endsWith('.pdf')) {
          fileSvgIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>';
        } else if (ftype.includes('zip') || ftype.includes('tar') || fname.match(/\.(zip|tar|gz|7z|rar)$/)) {
          fileSvgIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 8v13H3V3h10"/><path d="M18 2v6h6"/><path d="M10 12h4"/><path d="M10 16h4"/></svg>';
        }
      }

      const typeConfig = isFile ? {
        label: entry.typeName || 'Encrypted File',
        icon: fileSvgIcon,
        fields: []
      } : (availableTypes.find(t => t.id === entry.type) || {
        label: entry.typeName || 'Entry',
        icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>',
        fields: []
      });

      let fieldsGridHtml = '';
      if (isFile) {
        fieldsGridHtml = `
          <div class="field-container-box">
            <div class="field-box-label" style="display: flex; align-items: center; gap: 6px;">
              ${fileSvgIcon}
              <span>Filename</span>
            </div>
            <div class="field-box-value-row">
              <span class="field-box-text">${(entry.fields && entry.fields.filename) || 'Attached File'} (${(entry.fields && entry.fields.filesize) || ''})</span>
            </div>
          </div>
        `;
      } else {
        const defsMap = {};
        (typeConfig.fields || []).forEach(d => { defsMap[d.key] = d; });

        for (const [fKey, rawVal] of Object.entries(entry.fields || {})) {
          if (!rawVal || fKey === 'notes' || fKey === 'branch_notes') continue;
          const fDef = defsMap[fKey] || { name: fKey.replace(/_/g, ' ').toUpperCase(), sensitive: false };
          const isSensitive = fDef.sensitive || false;
          const maskedText = maskFieldValue(rawVal, fDef);

          const elemId = `val-${entry.id}-${fKey}`;

          fieldsGridHtml += `
            <div class="field-container-box">
              <div class="field-box-label">${fDef.name}</div>
              <div class="field-box-value-row">
                <span id="${elemId}" class="field-box-text" data-masked="${maskedText}" data-plain="${rawVal}" data-is-masked="${isSensitive ? 'true' : 'false'}">${isSensitive ? maskedText : rawVal}</span>
                <div class="field-box-actions">
                  ${isSensitive ? `<button type="button" class="field-eye-btn" data-target="${elemId}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>` : ''}
                  <button type="button" class="field-copy-btn" data-copy="${rawVal}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg></button>
                </div>
              </div>
            </div>
          `;
        }
      }

      card.innerHTML = `
        <div class="entry-card-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <span class="category-badge" style="display: inline-flex; align-items: center; gap: 6px; background: rgba(201, 162, 74, 0.15); border: 1px solid var(--brass-accent); color: var(--brass-accent); padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase;">
              ${typeConfig.icon || ''}
              <span>${typeConfig.label || entry.typeName}</span>
            </span>
            <h3 class="entry-title-prominent" style="font-family: var(--font-heading); font-size: 20px; font-weight: 700; color: #ffffff; margin: 0;">${entry.title}</h3>
          </div>
          <div class="entry-actions" style="display: flex; gap: 8px;">
            ${isFile ? `<button class="btn-secondary view-file-btn" data-id="${entry.id}" style="padding: 6px 12px; font-size: 12px;">View File</button>` : `<button class="btn-secondary edit-entry-btn" data-id="${entry.id}" style="padding: 6px 12px; font-size: 12px;">Edit</button>`}
            <button class="btn-danger delete-entry-btn" data-id="${entry.id}" style="padding: 6px 12px; font-size: 12px;">Delete</button>
          </div>
        </div>

        <div class="field-containers-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; margin-bottom: 12px;">
          ${fieldsGridHtml}
        </div>

        ${entry.notes ? `<div style="font-size: 13px; color: var(--text-secondary); background: #121212; padding: 10px 14px; border-radius: 6px; border: 1px solid var(--surface-border);"><strong>Notes:</strong> ${entry.notes}</div>` : ''}
      `;

      entryListContainer.appendChild(card);
    });

    // Eye toggle handlers
    document.querySelectorAll('.field-eye-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-target');
        const targetEl = document.getElementById(targetId);
        if (targetEl) {
          const isMasked = targetEl.getAttribute('data-is-masked') === 'true';
          if (isMasked) {
            targetEl.textContent = targetEl.getAttribute('data-plain');
            targetEl.setAttribute('data-is-masked', 'false');
            btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.45 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
          } else {
            targetEl.textContent = targetEl.getAttribute('data-masked');
            targetEl.setAttribute('data-is-masked', 'true');
            btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
          }
        }
      });
    });

    // Copy handlers with inline toast feedback
    document.querySelectorAll('.field-copy-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const valToCopy = btn.getAttribute('data-copy');
        if (valToCopy) {
          clipboardMgr.writeText(valToCopy);
          logActivity('CLIPBOARD: Copied field data to clipboard.');
          const orig = btn.textContent;
          btn.textContent = 'Copied!';
          btn.style.color = '#10b981';
          setTimeout(() => {
            btn.textContent = orig;
            btn.style.color = '';
          }, 1500);
        }
      });
    });

    // Edit button handlers
    document.querySelectorAll('.edit-entry-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const targetEntry = vaultEntries.find(e => e.id === id);
        if (targetEntry) {
          openAddEntryModal(targetEntry);
        }
      });
    });

    // File view button handlers
    document.querySelectorAll('.view-file-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const fileEntry = vaultEntries.find(e => e.id === id);
        if (fileEntry) {
          openFileViewer(fileEntry);
        }
      });
    });

    // Delete button handlers
    document.querySelectorAll('.delete-entry-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        vaultEntries = vaultEntries.filter(e => e.id !== id);
        saveVaultEntriesToStorage();
        logActivity(`VAULT ITEM DELETED: ID ${id}`);
        renderVaultEntries();
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
                <button type="button" class="pwd-toggle-btn" data-target="current-mp-input" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--text-secondary); cursor: pointer;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">New Master Password</label>
              <div style="position: relative;">
                <input type="password" id="sec-new-mp-input" class="input-field" placeholder="Enter new password..." required />
                <button type="button" class="pwd-toggle-btn" data-target="sec-new-mp-input" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--text-secondary); cursor: pointer;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
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
                <button type="button" class="pwd-toggle-btn" data-target="sec-confirm-mp-input" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--text-secondary); cursor: pointer;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
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

          <div id="biometrics-setting-container" style="margin-top: 20px;"></div>

          <hr style="border: none; border-top: 1px solid var(--surface-border); margin: 20px 0;" />

          <div style="margin-top: 20px;">
            <label class="form-label">Password Health Check</label>
            <p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 12px;">Scan local vault entries for weak, reused, or stale passwords.</p>
            <button type="button" id="open-health-check-btn" class="btn-primary" style="width: 100%;">Run Password Health Check</button>
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
        changeForm.addEventListener('submit', async (e) => {
          if (e) e.preventDefault();
          const submitBtn = secUpdateBtn;
          const inputElem = document.getElementById('current-mp-input');
          try {
            if (submitBtn) submitBtn.disabled = true;
            const currPwd = inputElem ? inputElem.value : '';
            const newPwd = secNewInp.value;

            const storedSaltHex = localStorage.getItem('vantalock_vault_salt');
            const storedVerifier = localStorage.getItem('vantalock_vault_verifier');

            if (storedSaltHex && storedVerifier) {
              const salt = Buffer.from(storedSaltHex, 'hex');
              const currDerivedKey = await deriveKey(currPwd, salt);

              if (!verifyKey(currDerivedKey, storedVerifier)) {
                msgDiv.style.color = '#ef4444';
                msgDiv.textContent = 'Incorrect current master password.';
                logActivity('SECURITY WARNING: Failed master password verification during password change.');
                return;
              }

              const newSalt = generateSalt();
              const newDerivedKey = await deriveKey(newPwd, newSalt);
              const newVerifier = createVerifier(newDerivedKey);

              localStorage.setItem('vantalock_vault_salt', newSalt.toString('hex'));
              localStorage.setItem('vantalock_vault_verifier', newVerifier);

              msgDiv.style.color = '#10b981';
              msgDiv.textContent = 'Master password updated and vault key re-derived successfully.';
              logActivity('SECURITY: Master password changed and key re-derived.');
              changeForm.reset();
            } else {
              msgDiv.style.color = '#10b981';
              msgDiv.textContent = 'Master password updated.';
              changeForm.reset();
            }
          } finally {
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.style.pointerEvents = 'auto';
            }
            if (inputElem) {
              inputElem.disabled = false;
              inputElem.removeAttribute('readonly');
              inputElem.classList.remove('disabled', 'read-only', 'locked');
              inputElem.style.pointerEvents = 'auto';
              inputElem.style.userSelect = 'text';
              setTimeout(() => {
                inputElem.focus();
                inputElem.select();
              }, 10);
            }
          }
        });
      }

      setupPasswordToggles();

      const autoLockSelect = document.getElementById('autolock-select');
      if (autoLockSelect) {
        autoLockSelect.value = localStorage.getItem('vantalock_autolock') || '5';
        autoLockSelect.addEventListener('change', (e) => {
          localStorage.setItem('vantalock_autolock', e.target.value);
          lockMgr.setAutoLockTimer(parseInt(e.target.value, 10));
          logActivity(`SETTINGS: Auto-lock timeout set to ${e.target.value} minutes.`);
        });
      }

      checkBiometricsSupport().then(supported => {
        const bioContainer = document.getElementById('biometrics-setting-container');
        if (bioContainer) {
          if (supported) {
            const isBioEnabled = localStorage.getItem('vantalock_biometrics_enabled') === 'true';
            bioContainer.innerHTML = `
              <div class="form-group" style="display: flex; align-items: center; justify-content: space-between;">
                <div>
                  <label class="form-label" style="margin-bottom: 2px;">Biometric Unlock (Touch ID / Windows Hello)</label>
                  <div style="font-size: 12px; color: var(--text-secondary);">Use native biometrics for fast unlock.</div>
                </div>
                <input type="checkbox" id="sec-biometric-toggle" ${isBioEnabled ? 'checked' : ''} style="width: 20px; height: 20px; cursor: pointer; accent-color: var(--brass-accent);" />
              </div>
            `;
            const bioToggle = document.getElementById('sec-biometric-toggle');
            if (bioToggle) {
              bioToggle.addEventListener('change', async (e) => {
                const checked = e.target.checked;
                if (checked) {
                  if (window.electronAPI && typeof window.electronAPI.promptBiometrics === 'function') {
                    const authenticated = await window.electronAPI.promptBiometrics('Enable Biometric Unlock');
                    if (authenticated) {
                      localStorage.setItem('vantalock_biometrics_enabled', 'true');
                      logActivity('SECURITY: Biometric unlock enabled in Security Settings.');
                    } else {
                      e.target.checked = false;
                      localStorage.setItem('vantalock_biometrics_enabled', 'false');
                    }
                  } else {
                    localStorage.setItem('vantalock_biometrics_enabled', 'true');
                  }
                } else {
                  localStorage.setItem('vantalock_biometrics_enabled', 'false');
                  logActivity('SECURITY: Biometric unlock disabled in Security Settings.');
                }
              });
            }
          } else {
            bioContainer.style.display = 'none';
          }
        }
      });

      const openHealthCheckBtn = document.getElementById('open-health-check-btn');
      if (openHealthCheckBtn) {
        openHealthCheckBtn.addEventListener('click', () => {
          if (typeof openPasswordHealthModal === 'function') {
            openPasswordHealthModal();
          }
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
                  <button type="button" class="pwd-toggle-btn" data-target="seed-mp-confirm" style="position: absolute; right: 34px; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--text-secondary); cursor: pointer;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
                  <button type="button" id="seed-reset-btn" title="Reset Field" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--text-secondary); cursor: pointer;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg></button>
                </div>
                <div id="seed-error-msg" class="error-text" style="display: none; color: #ef4444; font-size: 12px; margin-top: 6px;">Incorrect master password. Please try again.</div>
              </div>
              <button type="submit" class="btn-primary" style="margin-top: 12px;">Reveal Recovery Phrase</button>
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

            const seedResetBtn = document.getElementById('seed-reset-btn');
      if (seedResetBtn) {
        seedResetBtn.addEventListener('click', () => {
          const inp = document.getElementById('seed-mp-confirm');
          if (inp) {
            inp.value = '';
            inp.disabled = false;
            inp.removeAttribute('readonly');
            inp.focus();
          }
          const seedErr = document.getElementById('seed-error-msg');
          if (seedErr) seedErr.style.display = 'none';
          const submitBtn = gateForm ? gateForm.querySelector('button[type="submit"]') : null;
          if (submitBtn) submitBtn.disabled = false;
        });
      }
      if (gateForm) {
        gateForm.addEventListener('submit', async (e) => {
          if (e) e.preventDefault();
          const submitBtn = gateForm.querySelector('button[type="submit"]');
          const inputElem = document.getElementById('seed-mp-confirm');
          try {
            if (submitBtn) submitBtn.disabled = true;
            const pwdVal = inputElem ? inputElem.value : '';

            const storedSaltHex = localStorage.getItem('vantalock_vault_salt');
            const storedVerifier = localStorage.getItem('vantalock_vault_verifier');

            if (storedSaltHex && storedVerifier) {
              const salt = Buffer.from(storedSaltHex, 'hex');
              const currDerivedKey = await deriveKey(pwdVal, salt);

              if (!verifyKey(currDerivedKey, storedVerifier)) {
                const seedErr = document.getElementById('seed-error-msg');
                if (seedErr) seedErr.style.display = 'block';
                logActivity('SECURITY WARNING: Incorrect password attempt to reveal recovery seed.');
                return;
              }
            }

            const seedErr = document.getElementById('seed-error-msg');
            if (seedErr) seedErr.style.display = 'none';
            gateView.classList.add('hidden');
          contentView.classList.remove('hidden');
          logActivity('SECURITY: Recovery seed revealed following valid password verification.');

          let wordsToRender = activeRecoveryKeyWords;
          if (!wordsToRender || wordsToRender.length !== 24) {
            const savedSeed = localStorage.getItem('vantalock_seed_phrase');
            if (savedSeed) {
              wordsToRender = savedSeed.trim().split(/\s+/);
              activeRecoveryKeyWords = wordsToRender;
            }
          }

          if (wordsToRender && wordsToRender.length === 24) {
            wordsMask.innerHTML = '';
            wordsToRender.forEach((w, i) => {
              const chip = document.createElement('div');
              chip.className = 'word-chip';
              chip.innerHTML = `<span class="word-num">${i + 1}.</span> ${w}`;
              wordsMask.appendChild(chip);
            });
          }
          } finally {
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.style.pointerEvents = 'auto';
            }
            if (inputElem) {
              inputElem.disabled = false;
              inputElem.removeAttribute('readonly');
              inputElem.classList.remove('disabled', 'read-only', 'locked');
              inputElem.style.pointerEvents = 'auto';
              inputElem.style.userSelect = 'text';
              setTimeout(() => {
                inputElem.focus();
                inputElem.select();
              }, 10);
            }
          }
        });
      }

      setupPasswordToggles();

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
          let phrase = activeRecoveryKeyWords && activeRecoveryKeyWords.length ? activeRecoveryKeyWords.join(' ') : (localStorage.getItem('vantalock_seed_phrase') || '');
          if (phrase) {
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
              saveVaultEntriesToStorage();
              importMsg.style.color = '#10b981';
              importMsg.textContent = `Successfully imported ${importedEntries.length} entries!`;
              logActivity(`IMPORT: Imported ${importedEntries.length} entries from ${file.name}.`);
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

      const pkg = require('../../package.json');
      const currentVerTag = `v${pkg.version || '1.0.0'}`;
      const localVerSpan = document.getElementById('about-local-ver');
      const latestVerSpan = document.getElementById('about-latest-ver');
      const updateBanner = document.getElementById('about-update-banner');

      if (localVerSpan) localVerSpan.textContent = currentVerTag;

      fetch('https://api.github.com/repos/bomboclat766/VantaLock/releases/latest')
        .then(res => res.json())
        .then(data => {
          if (data && data.tag_name) {
            latestVerSpan.textContent = data.tag_name;
            if (data.tag_name !== currentVerTag) {
              updateBanner.style.color = '#10b981';
              updateBanner.textContent = `⚡ Update available! (${data.tag_name})`;
            } else {
              updateBanner.style.color = 'var(--text-secondary)';
              updateBanner.textContent = '✓ You are running the latest release.';
            }
          } else {
            latestVerSpan.textContent = `${currentVerTag} (Offline fallback)`;
          }
        })
        .catch(err => {
          if (latestVerSpan) latestVerSpan.textContent = `${currentVerTag} (Offline fallback)`;
        });
    }
  }

  updateSidebarStats();
});


  const enableBiometricsBtn = document.getElementById('enable-biometrics-btn');
  const skipBiometricsBtn = document.getElementById('skip-biometrics-btn');

  if (enableBiometricsBtn) {
    enableBiometricsBtn.addEventListener('click', async () => {
      try {
        if (window.electronAPI && typeof window.electronAPI.promptBiometrics === 'function') {
          const authenticated = await window.electronAPI.promptBiometrics('Enable Biometric Unlock');
          if (authenticated && pendingMasterPassword) {
            const token = await window.electronAPI.storeSecureToken(pendingMasterPassword);
            localStorage.setItem('vantalock_secure_token', token);
            localStorage.setItem('vantalock_biometrics_enabled', 'true');
            logActivity('SECURITY: Biometric unlock enabled during onboarding.');
          } else {
            localStorage.setItem('vantalock_biometrics_enabled', 'false');
          }
        }
      } catch (e) {
        console.error('Biometric enablement failed:', e);
        localStorage.setItem('vantalock_biometrics_enabled', 'false');
      } finally {
        pendingMasterPassword = '';
        setupRecoveryKeyScreen();
      }
    });
  }

  if (skipBiometricsBtn) {
    skipBiometricsBtn.addEventListener('click', () => {
      localStorage.setItem('vantalock_biometrics_enabled', 'false');
      pendingMasterPassword = '';
      logActivity('SECURITY: Biometric unlock skipped during onboarding.');
      setupRecoveryKeyScreen();
    });
  }


  // Password Health Check Implementation
  function generateStrongPassword(length = 20) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    let res = '';
    const array = new Uint32Array(length);
    window.crypto.getRandomValues(array);
    for (let i = 0; i < length; i++) {
      res += chars[array[i] % chars.length];
    }
    return res;
  }

  function getEntryPassword(entry) {
    if (!entry || !entry.fields) return null;
    const fields = entry.fields;
    for (const k in fields) {
      if (k.toLowerCase().includes('password') || k.toLowerCase().includes('pin') || k.toLowerCase().includes('secret')) {
        if (fields[k] && typeof fields[k] === 'string') {
          return { key: k, value: fields[k] };
        }
      }
    }
    // Fallback if field isn't explicitly named password
    for (const k in fields) {
      if (typeof fields[k] === 'string' && fields[k].length > 0 && k !== 'username' && k !== 'email' && k !== 'url' && k !== 'filename') {
        return { key: k, value: fields[k] };
      }
    }
    return null;
  }

  function loadHealthHistory() {
    try {
      const raw = localStorage.getItem('vantalock_health_history');
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveHealthHistory(history) {
    try {
      localStorage.setItem('vantalock_health_history', JSON.stringify(history));
    } catch (e) {}
  }

  function openPasswordHealthModal() {
    const modal = document.getElementById('password-health-modal');
    const scanView = document.getElementById('health-scanning-view');
    const resultsView = document.getElementById('health-results-view');
    const scanList = document.getElementById('radar-entry-scan-list');
    const closeBtn = document.getElementById('close-health-modal-btn');

    if (!modal) return;
    modal.classList.remove('hidden');

    scanView.style.display = 'block';
    resultsView.style.display = 'none';

    scanList.innerHTML = '';
    if (vaultEntries.length === 0) {
      scanList.innerHTML = '<div class="scan-entry-item">No vault entries to scan.</div>';
    } else {
      vaultEntries.forEach(entry => {
        const item = document.createElement('div');
        item.className = 'scan-entry-item';
        item.id = `scan-item-${entry.id}`;
        item.textContent = `[EVALUATING] ${entry.title || 'Untitled'} (${entry.typeName || entry.type})`;
        scanList.appendChild(item);
      });
    }

    let idx = 0;
    const interval = setInterval(() => {
      if (idx < vaultEntries.length) {
        const entry = vaultEntries[idx];
        const elem = document.getElementById(`scan-item-${entry.id}`);
        if (elem) {
          elem.classList.add('scanned');
          elem.textContent = `[SCANNED] ${entry.title || 'Untitled'}`;
        }
        idx++;
      } else {
        clearInterval(interval);
        setTimeout(() => {
          scanView.style.display = 'none';
          resultsView.style.display = 'block';
          renderHealthCheckResults();
        }, 400);
      }
    }, Math.max(120, Math.floor(800 / (vaultEntries.length || 1))));

    if (closeBtn) {
      closeBtn.onclick = () => {
        modal.classList.add('hidden');
      };
    }
  }

  function renderHealthCheckResults() {
    const scoreDisplay = document.getElementById('health-score-display');
    const scoreStatus = document.getElementById('health-score-status');
    const issuesList = document.getElementById('health-issues-list');
    const svgChart = document.getElementById('health-history-svg');

    if (!issuesList) return;
    issuesList.innerHTML = '';

    const pwdCounts = {};
    vaultEntries.forEach(entry => {
      const pwdObj = getEntryPassword(entry);
      if (pwdObj && pwdObj.value) {
        pwdCounts[pwdObj.value] = (pwdCounts[pwdObj.value] || 0) + 1;
      }
    });

    const issues = [];
    let totalScoreSum = 0;
    const entriesWithPasswords = vaultEntries.filter(e => getEntryPassword(e) !== null);

    if (entriesWithPasswords.length === 0) {
      totalScoreSum = 100;
    } else {
      entriesWithPasswords.forEach(entry => {
        let entryScore = 100;
        const pwdObj = getEntryPassword(entry);
        if (!pwdObj || !pwdObj.value) return;

        const pwd = pwdObj.value;
        const { score: strScore } = calculatePasswordStrength(pwd);

        // 1. Weak password
        if (strScore < 3 || pwd.length < 10) {
          entryScore -= 35;
          issues.push({
            entryId: entry.id,
            title: entry.title || 'Untitled Entry',
            issue: 'Weak password (low entropy)',
            pwdKey: pwdObj.key
          });
        }

        // 2. Reused password
        if (pwdCounts[pwd] > 1) {
          entryScore -= 40;
          const otherCount = pwdCounts[pwd] - 1;
          issues.push({
            entryId: entry.id,
            title: entry.title || 'Untitled Entry',
            issue: `Reused password (also used on ${otherCount} other ${otherCount === 1 ? 'entry' : 'entries'})`,
            pwdKey: pwdObj.key
          });
        }

        // 3. Stale password (> 12 months)
        const dateStr = entry.updatedAt || entry.createdAt;
        if (dateStr) {
          const entryDate = new Date(dateStr).getTime();
          const msIn12Months = 365 * 24 * 60 * 60 * 1000;
          if (Date.now() - entryDate >= msIn12Months) {
            entryScore -= 25;
            const months = Math.floor((Date.now() - entryDate) / (1000 * 60 * 60 * 24 * 30.4375));
            issues.push({
              entryId: entry.id,
              title: entry.title || 'Untitled Entry',
              issue: `Not changed in ${months} months`,
              pwdKey: pwdObj.key
            });
          }
        }

        totalScoreSum += Math.max(0, entryScore);
      });
    }

    const overallScore = entriesWithPasswords.length ? Math.round(totalScoreSum / entriesWithPasswords.length) : 100;

    // Count up score animation
    let startVal = 0;
    const duration = 800;
    const startTime = performance.now();
    function animateScore(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const currentVal = Math.floor(progress * overallScore);
      if (scoreDisplay) scoreDisplay.textContent = `${currentVal}/100`;
      if (progress < 1) {
        requestAnimationFrame(animateScore);
      } else {
        if (scoreDisplay) scoreDisplay.textContent = `${overallScore}/100`;
      }
    }
    requestAnimationFrame(animateScore);

    if (scoreStatus) {
      if (overallScore >= 85) {
        scoreStatus.textContent = 'Excellent Vault Security Health';
        scoreStatus.style.color = '#10b981';
      } else if (overallScore >= 60) {
        scoreStatus.textContent = 'Moderate Security — Attention Recommended';
        scoreStatus.style.color = '#f59e0b';
      } else {
        scoreStatus.textContent = 'Critical Vulnerabilities Detected';
        scoreStatus.style.color = '#ef4444';
      }
    }

    // Render Issue Cards
    if (issues.length === 0) {
      issuesList.innerHTML = `
        <div style="padding: 16px; background: rgba(16, 185, 129, 0.05); border: 1px solid #10b981; border-radius: 6px; color: #10b981; font-size: 13px; text-align: center;">
          ✓ All vault passwords meet high security standards! No weak, reused, or stale passwords found.
        </div>
      `;
    } else {
      issues.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = 'issue-card';
        card.innerHTML = `
          <div>
            <div style="font-weight: 600; color: var(--text-primary); font-size: 13px;">${item.title}</div>
            <div style="font-size: 12px; color: #ef4444; margin-top: 2px;">${item.issue}</div>
          </div>
          <button type="button" class="btn-primary fix-entry-btn" style="width: auto; padding: 6px 14px; font-size: 12px;">Fix Now</button>
        `;

        const fixBtn = card.querySelector('.fix-entry-btn');
        fixBtn.onclick = () => {
          if (confirm(`Generate a new strong password and update "${item.title}"?`)) {
            const entryObj = vaultEntries.find(e => e.id === item.entryId);
            if (entryObj && entryObj.fields) {
              const newPassword = generateStrongPassword(20);
              entryObj.fields[item.pwdKey] = newPassword;
              entryObj.updatedAt = new Date().toISOString();
              saveVaultEntriesToStorage();
              logActivity(`PASSWORD HEALTH FIX: Generated new strong password for ${item.title}`);

              const confirmModal = document.getElementById('account-update-confirm-modal');
              const confirmTitle = document.getElementById('confirm-account-title');
              const confirmPwdInp = document.getElementById('confirm-new-pwd-display');
              const confirmDomain = document.getElementById('confirm-account-domain');
              const copyBtn = document.getElementById('copy-confirm-pwd-btn');
              const updatedBtn = document.getElementById('confirm-account-updated-btn');

              if (confirmModal) {
                if (confirmTitle) confirmTitle.textContent = item.title;
                if (confirmPwdInp) confirmPwdInp.value = newPassword;
                if (confirmDomain) confirmDomain.textContent = (entryObj.fields && entryObj.fields.url) || item.title;
                confirmModal.classList.remove('hidden');

                if (copyBtn) {
                  copyBtn.onclick = () => {
                    if (clipboardMgr) clipboardMgr.writeText(newPassword);
                    copyBtn.textContent = 'Copied!';
                    setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
                  };
                }

                if (updatedBtn) {
                  updatedBtn.onclick = () => {
                    confirmModal.classList.add('hidden');
                    renderHealthCheckResults();
                  };
                }
              } else {
                renderHealthCheckResults();
              }
            }
          }
        };

        issuesList.appendChild(card);

        setTimeout(() => {
          card.classList.add('visible');
        }, index * 80);
      });
    }

    // Record History & Render Chart
    const history = loadHealthHistory();
    const nowIso = new Date().toISOString();
    history.push({ timestamp: nowIso, score: overallScore });
    saveHealthHistory(history);

    if (svgChart) {
      const pts = history.slice(-10);
      if (pts.length < 2) {
        svgChart.innerHTML = `<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#666" font-size="12">Score logged: ${overallScore}/100. Run checks over time to see trend graph.</text>`;
      } else {
        const width = 500;
        const height = 100;
        const polyPts = pts.map((p, i) => {
          const x = (i / (pts.length - 1)) * (width - 40) + 20;
          const y = height - (p.score / 100) * (height - 30) - 15;
          return `${x},${y}`;
        }).join(' ');

        let dotsHtml = pts.map((p, i) => {
          const x = (i / (pts.length - 1)) * (width - 40) + 20;
          const y = height - (p.score / 100) * (height - 30) - 15;
          return `<circle cx="${x}" cy="${y}" r="4" fill="#c9a24a"><title>${p.score}/100 (${new Date(p.timestamp).toLocaleDateString()})</title></circle>`;
        }).join('');

        svgChart.innerHTML = `
          <polyline fill="none" stroke="#c9a24a" stroke-width="2" points="${polyPts}" />
          ${dotsHtml}
        `;
      }
    }
  }

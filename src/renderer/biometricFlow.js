(function exposeBiometricFlow(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.VantaLockBiometricFlow = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createBiometricFlow() {
  const ENABLED_KEY = 'vantalock_biometrics_enabled';
  const TOKEN_KEY = 'vantalock_secure_token';

  async function enableBiometricUnlock({ api, storage, password, salt, verifier }) {
    const validPassword = await api.verifyMasterPassword({ password, salt, verifier });
    if (!validPassword) return false;

    const authenticated = await api.promptBiometrics('Enable Touch ID Unlock');
    if (!authenticated) return false;

    const encryptedToken = await api.storeSecureToken(password);
    storage.setItem(TOKEN_KEY, encryptedToken);
    storage.setItem(ENABLED_KEY, 'true');
    return true;
  }

  async function rotateBiometricSecret({ api, storage, password }) {
    if (storage.getItem(ENABLED_KEY) !== 'true') return false;
    const encryptedToken = await api.storeSecureToken(password);
    storage.setItem(TOKEN_KEY, encryptedToken);
    return true;
  }

  function disableBiometricUnlock(storage) {
    storage.removeItem(TOKEN_KEY);
    storage.setItem(ENABLED_KEY, 'false');
  }

  async function unlockWithBiometrics({ api, storage, resetFailedAttempts }) {
    if (storage.getItem(ENABLED_KEY) !== 'true') return false;

    const encryptedToken = storage.getItem(TOKEN_KEY);
    const salt = storage.getItem('vantalock_vault_salt');
    const verifier = storage.getItem('vantalock_vault_verifier');
    if (!encryptedToken || !salt || !verifier) return false;

    const password = await api.unlockWithBiometrics(encryptedToken);
    if (typeof password !== 'string' || password.length === 0) return false;
    const validPassword = await api.verifyMasterPassword({ password, salt, verifier });
    if (!validPassword) return false;

    resetFailedAttempts();
    await api.lockManagerSuccess();
    return true;
  }

  return {
    enableBiometricUnlock,
    rotateBiometricSecret,
    disableBiometricUnlock,
    unlockWithBiometrics
  };
});

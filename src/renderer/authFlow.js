(function exposeAuthFlow(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.VantaLockAuthFlow = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createAuthFlow() {
  async function authenticatePassword({
    password,
    salt,
    verifier,
    decoyPasswords,
    verifyMasterPassword,
    recordFailedAttempt,
    resetFailedAttempts
  }) {
    if (decoyPasswords.some(entry => entry.password === password)) {
      resetFailedAttempts();
      return { accepted: true, vaultType: 'decoy' };
    }

    let accepted = false;
    try {
      if (salt && verifier) {
        accepted = await verifyMasterPassword({ password, salt, verifier });
      }
    } catch (error) {
      recordFailedAttempt();
      return { accepted: false, vaultType: null, error };
    }

    if (!accepted) {
      recordFailedAttempt();
      return { accepted: false, vaultType: null };
    }

    resetFailedAttempts();
    return { accepted: true, vaultType: 'real' };
  }

  return { authenticatePassword };
});
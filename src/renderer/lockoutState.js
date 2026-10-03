(function exposeLockoutState(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.VantaLockLockoutState = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createLockoutStateModule() {
  function createLockoutState(storage, onThresholdReached, onExpired = () => {}) {
    function getSettings() {
      const threshold = Number.parseInt(storage.getItem('vantalock_lockout_threshold') || '5', 10);
      const durationMinutes = Number.parseInt(storage.getItem('vantalock_lockout_duration') || '5', 10);
      return {
        threshold: Number.isFinite(threshold) && threshold > 0 ? threshold : 5,
        durationMinutes: Number.isFinite(durationMinutes) && durationMinutes > 0 ? durationMinutes : 5
      };
    }

    function getFailedAttemptCount() {
      const count = Number.parseInt(storage.getItem('vantalock_failed_attempts') || '0', 10);
      return Number.isFinite(count) && count >= 0 ? count : 0;
    }

    function recordFailedAttempt() {
      const count = getFailedAttemptCount() + 1;
      const settings = getSettings();
      storage.setItem('vantalock_failed_attempts', String(count));
      if (count >= settings.threshold) {
        const durationMs = settings.durationMinutes * 60 * 1000;
        storage.setItem('vantalock_lockout_expires_at', String(Date.now() + durationMs));
        storage.setItem('vantalock_lockout_total_ms', String(durationMs));
        onThresholdReached();
      }
      return count;
    }

    function resetFailedAttempts() {
      storage.setItem('vantalock_failed_attempts', '0');
      storage.removeItem('vantalock_lockout_expires_at');
      storage.removeItem('vantalock_lockout_total_ms');
    }

    function expireIfElapsed(now = Date.now()) {
      const expiresAt = Number.parseInt(storage.getItem('vantalock_lockout_expires_at') || '0', 10);
      if (!Number.isFinite(expiresAt) || expiresAt <= 0 || now < expiresAt) return false;
      resetFailedAttempts();
      onExpired();
      return true;
    }

    return { getSettings, getFailedAttemptCount, recordFailedAttempt, resetFailedAttempts, expireIfElapsed };
  }

  return { createLockoutState };
});
/**
 * Lock & Security State Manager (Phase 5 & 6)
 * Handles auto-lock timers, lid-close/sleep detection, Advanced Locking Mode, and failed login attempt logging.
 */

class LockManager {
  constructor(options = {}) {
    this.autoLockMinutes = options.autoLockMinutes || 5; // default 5 min
    this.advancedLockingMode = options.advancedLockingMode || false;
    this.isLocked = true;
    this.failedAttempts = [];
    this.consecutiveFailures = 0;
    this.inactivityTimer = null;
    this.onLockCallback = options.onLockCallback || (() => {});
  }

  setAutoLockTimer(minutes) {
    this.autoLockMinutes = minutes;
    this.resetInactivityTimer();
  }

  setAdvancedLockingMode(enabled) {
    this.advancedLockingMode = enabled;
  }

  resetInactivityTimer() {
    if (this.inactivityTimer) clearTimeout(this.inactivityTimer);

    if (this.autoLockMinutes > 0 && !this.isLocked) {
      this.inactivityTimer = setTimeout(() => {
        this.lock('Auto-lock timeout reached');
      }, this.autoLockMinutes * 60 * 1000);
    }
  }

  lock(reason = 'User locked vault') {
    this.isLocked = true;
    if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
    this.onLockCallback(reason);
  }

  recordFailedAttempt() {
    this.consecutiveFailures += 1;
    this.failedAttempts.push({
      timestamp: new Date().toISOString(),
      attemptNumber: this.consecutiveFailures
    });

    // Exponential backoff throttling calculation (seconds)
    if (this.consecutiveFailures >= 5) {
      return Math.pow(2, this.consecutiveFailures - 5) * 5; // 5s, 10s, 20s...
    }
    return 0;
  }

  recordSuccessfulUnlock() {
    this.isLocked = false;
    this.consecutiveFailures = 0;
    this.resetInactivityTimer();
  }

  getFailedAttemptLog() {
    return this.failedAttempts;
  }
}

module.exports = LockManager;

const LockManager = require('../src/crypto/lockManager');

describe('Lock Manager, Advanced Locking Mode & Throttling (Phase 5 & 6)', () => {
  jest.useFakeTimers();

  test('auto-lock triggers after configured inactivity minutes', () => {
    let lockedReason = null;
    const lockMgr = new LockManager({
      autoLockMinutes: 1,
      onLockCallback: (reason) => { lockedReason = reason; }
    });

    lockMgr.recordSuccessfulUnlock();
    expect(lockMgr.isLocked).toBe(false);

    jest.advanceTimersByTime(60 * 1000);
    expect(lockMgr.isLocked).toBe(true);
    expect(lockedReason).toContain('Auto-lock timeout');
  });

  test('recordFailedAttempt logs attempts and calculates exponential backoff after 5 failures', () => {
    const lockMgr = new LockManager();
    expect(lockMgr.recordFailedAttempt()).toBe(0);
    expect(lockMgr.recordFailedAttempt()).toBe(0);
    expect(lockMgr.recordFailedAttempt()).toBe(0);
    expect(lockMgr.recordFailedAttempt()).toBe(0);
    expect(lockMgr.recordFailedAttempt()).toBe(5); // 5th failure: 5 sec delay
    expect(lockMgr.recordFailedAttempt()).toBe(10); // 6th failure: 10 sec delay

    expect(lockMgr.getFailedAttemptLog().length).toBe(6);
  });
});

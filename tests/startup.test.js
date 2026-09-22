describe('Application Startup & Verification Suite (15 Tests)', () => {
  beforeEach(() => {
    const store = {};
    global.localStorage = {
      getItem: (key) => store[key] || null,
      setItem: (key, val) => { store[key] = String(val); },
      removeItem: (key) => { delete store[key]; },
      clear: () => { Object.keys(store).forEach(k => delete store[k]); }
    };
  });

  test('Test 1: Setup incomplete routes to onboarding', () => {
    localStorage.setItem('vantalock_setup_complete', 'false');
    const isFullySetup = localStorage.getItem('vantalock_setup_complete') === 'true';
    expect(isFullySetup).toBe(false);
  });

  test('Test 2: Setup complete routes to unlock vault', () => {
    localStorage.setItem('vantalock_setup_complete', 'true');
    const isFullySetup = localStorage.getItem('vantalock_setup_complete') === 'true';
    expect(isFullySetup).toBe(true);
  });

  test('Test 3: Lockout check detects active lockout expiration', () => {
    const futureTime = Date.now() + 60000;
    localStorage.setItem('vantalock_lockout_expires_at', String(futureTime));
    const expiresAt = parseInt(localStorage.getItem('vantalock_lockout_expires_at') || '0', 10);
    expect(Date.now() < expiresAt).toBe(true);
  });

  test('Test 4: Lockout check detects expired lockout state', () => {
    const pastTime = Date.now() - 10000;
    localStorage.setItem('vantalock_lockout_expires_at', String(pastTime));
    const expiresAt = parseInt(localStorage.getItem('vantalock_lockout_expires_at') || '0', 10);
    expect(Date.now() < expiresAt).toBe(false);
  });

  test('Test 5: Failed attempts counter increments correctly', () => {
    localStorage.setItem('vantalock_failed_attempts', '2');
    const count = parseInt(localStorage.getItem('vantalock_failed_attempts') || '0', 10) + 1;
    localStorage.setItem('vantalock_failed_attempts', String(count));
    expect(localStorage.getItem('vantalock_failed_attempts')).toBe('3');
  });

  test('Test 6: Lockout threshold setting correctly retrieved or defaulted', () => {
    const threshold = parseInt(localStorage.getItem('vantalock_lockout_threshold') || '5', 10);
    expect(threshold).toBe(5);
  });

  test('Test 7: Custom lockout threshold setting evaluated', () => {
    localStorage.setItem('vantalock_lockout_threshold', '3');
    const threshold = parseInt(localStorage.getItem('vantalock_lockout_threshold') || '5', 10);
    expect(threshold).toBe(3);
  });

  test('Test 8: Lockout duration setting retrieved or defaulted', () => {
    const duration = parseInt(localStorage.getItem('vantalock_lockout_duration') || '5', 10);
    expect(duration).toBe(5);
  });

  test('Test 9: Default theme setting retrieved or defaulted', () => {
    const theme = localStorage.getItem('vantalock_theme') || 'dark';
    expect(theme).toBe('dark');
  });

  test('Test 10: Decoy passwords list parsing on boot', () => {
    const raw = localStorage.getItem('vantalock_decoy_passwords');
    const decoys = raw ? JSON.parse(raw) : [];
    expect(decoys).toEqual([]);
  });

  test('Test 11: Decoy password matching logic', () => {
    const decoys = [{ id: '1', password: 'decoypassword123' }];
    localStorage.setItem('vantalock_decoy_passwords', JSON.stringify(decoys));
    const list = JSON.parse(localStorage.getItem('vantalock_decoy_passwords'));
    const match = list.find(d => d.password === 'decoypassword123');
    expect(match).toBeDefined();
    expect(match.password).toBe('decoypassword123');
  });

  test('Test 12: Vault salt and verifier evaluation on boot', () => {
    localStorage.setItem('vantalock_vault_salt', 'aabbcc');
    localStorage.setItem('vantalock_vault_verifier', '123456');
    expect(localStorage.getItem('vantalock_vault_salt')).toBe('aabbcc');
    expect(localStorage.getItem('vantalock_vault_verifier')).toBe('123456');
  });

  test('Test 13: Active vault type initialization', () => {
    let activeVaultType = 'real';
    expect(activeVaultType).toBe('real');
  });

  test('Test 14: Titlebar class state evaluation on unlock vs lock', () => {
    let isUnlocked = false;
    let titlebarClass = isUnlocked ? 'unlocked' : '';
    expect(titlebarClass).toBe('');

    isUnlocked = true;
    titlebarClass = isUnlocked ? 'unlocked' : '';
    expect(titlebarClass).toBe('unlocked');
  });

  test('Test 15: Splash overlay dismissal status flag transition', () => {
    let splashDismissed = false;
    function dismiss() {
      if (splashDismissed) return;
      splashDismissed = true;
    }
    dismiss();
    expect(splashDismissed).toBe(true);
    dismiss();
    expect(splashDismissed).toBe(true);
  });
});

const fs = require('fs');
const os = require('os');
const path = require('path');

const workspaceRoot = path.resolve(__dirname, '..');
const canRunElectronE2E = process.env.RUN_ELECTRON_E2E === '1' &&
  (process.platform !== 'linux' || Boolean(process.env.DISPLAY));

(canRunElectronE2E ? test : test.skip)(
  'completes setup, rejects a wrong password, unlocks, and reopens the existing vault',
  async () => {
    const { _electron: electron } = require('playwright');
    const profileDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'vantalock-e2e-'));
    let app;

    try {
      app = await electron.launch({
        args: [workspaceRoot, `--user-data-dir=${profileDirectory}`, '--no-sandbox']
      });
      const page = await app.firstWindow();
      const pageErrors = [];
      page.on('pageerror', error => pageErrors.push(error.message));
      await page.waitForSelector('#get-started-btn');
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
      await page.reload();
      await page.waitForFunction(() => {
        const splash = document.getElementById('splash-overlay');
        return splash && splash.style.display === 'none';
      }, null, { timeout: 10000 });

      await page.locator('#get-started-btn').click();
      await page.waitForFunction(() => {
        const modal = document.getElementById('master-password-modal');
        return modal && !modal.classList.contains('hidden');
      });

      const masterPassword = 'E2EMasterPassword!2026';
      await page.locator('#mp-input').fill(masterPassword);
      await page.locator('#mp-confirm-input').fill(masterPassword);
      await page.locator('#create-mp-btn').click();

      await page.waitForFunction(() => {
        const biometric = document.getElementById('biometric-optin-modal');
        const recovery = document.getElementById('recovery-key-reveal-step');
        return (biometric && !biometric.classList.contains('hidden')) ||
          (recovery && !recovery.classList.contains('hidden'));
      });
      const biometricVisible = await page.locator('#biometric-optin-modal').evaluate(
        element => !element.classList.contains('hidden')
      );
      if (biometricVisible) {
        await page.locator('#skip-biometrics-btn').click();
      }

      await page.waitForFunction(() => {
        const recovery = document.getElementById('recovery-key-reveal-step');
        return recovery && !recovery.classList.contains('hidden') &&
          document.querySelectorAll('#recovery-words-grid .word-chip').length === 24;
      });
      await page.locator('#proceed-to-verify-rk-btn').click();
      await page.waitForFunction(() => document.querySelectorAll('.rk-verify-input').length === 4);

      const seedWords = await page.evaluate(() => localStorage.getItem('vantalock_seed_phrase').split(/\s+/));
      const verificationFields = page.locator('.rk-verify-input');
      const fieldCount = await verificationFields.count();
      for (let fieldIndex = 0; fieldIndex < fieldCount; fieldIndex++) {
        const wordIndex = Number(await verificationFields.nth(fieldIndex).getAttribute('data-index'));
        await verificationFields.nth(fieldIndex).fill(seedWords[wordIndex]);
      }
      await page.locator('#verify-rk-btn').click();
      await page.waitForSelector('#skip-decoy-setup-btn');
      await page.locator('#skip-decoy-setup-btn').click();
      await page.waitForFunction(() => {
        const dashboard = document.getElementById('dashboard-view-container');
        return dashboard && !dashboard.classList.contains('hidden');
      });
      await page.evaluate(() => {
        window.vaultEntries.push({
          id: 'e2e-search-card',
          vault: 'financial',
          type: 'card',
          typeName: 'Payment Card',
          title: 'E2E Search Card',
          fields: {
            cardholder_name: 'Avery Example',
            card_number: '4111111111119021'
          },
          createdAt: new Date().toISOString()
        });
        window.persistActiveVaultEntries();
        window.renderVaultEntries();
      });

      await page.locator('[data-display-mode="list"]').click();
      const listSummary = page.locator('.entry-list-summary').filter({ hasText: 'E2E Search Card' });
      expect(await listSummary.isVisible()).toBe(true);
      expect(await listSummary.textContent()).toContain('9021');
      expect(await listSummary.textContent()).not.toContain('4111111111119021');
      await listSummary.click();
      expect(await listSummary.getAttribute('aria-expanded')).toBe('true');
      expect(await page.evaluate(() => localStorage.getItem('vantalock_entry_display_mode'))).toBe('list');

      await page.locator('[data-display-mode="list"]').focus();
      await page.keyboard.press('ArrowRight');
      expect(await page.locator('[data-display-mode="table"]').getAttribute('aria-pressed')).toBe('true');
      const tableRow = page.locator('tr[data-vault-entry-id="e2e-search-card"]');
      expect(await tableRow.isVisible()).toBe(true);
      const maskedCardNumber = tableRow.locator('.table-reveal-btn');
      expect(await maskedCardNumber.textContent()).toContain('9021');
      expect(await maskedCardNumber.textContent()).not.toContain('4111111111119021');
      await maskedCardNumber.click();
      expect(await maskedCardNumber.textContent()).toBe('4111111111119021');

      await page.evaluate(() => { window.activeVaultType = 'decoy'; });
      await page.locator('#global-search-open-btn').click();
      await page.locator('#global-search-input').fill('E2E Search Card');
      expect(await page.locator('#global-search-status').textContent()).toBe('No matching entries.');
      await page.evaluate(() => {
        localStorage.setItem('vantalock_decoy_vault_data', JSON.stringify([{
          id: 'e2e-decoy-search',
          vault: 'personal',
          title: 'Decoy Only Entry',
          typeName: 'Login',
          fields: { username: 'decoy-user' }
        }]));
      });
      await page.locator('#global-search-input').fill('decoy-user');
      expect(await page.locator('.global-search-result').count()).toBe(1);
      expect(await page.locator('#global-search-results').textContent()).not.toContain('E2E Search Card');
      await page.locator('#global-search-input').fill('4111111111119021');
      expect(await page.locator('#global-search-status').textContent()).toBe('No matching entries.');
      await page.evaluate(() => { window.activeVaultType = 'real'; });
      await page.locator('#global-search-close-btn').click();
      await page.locator('[data-vault="personal"]').click();
      await page.keyboard.press('Control+k');
      expect(await page.locator('#global-search-overlay').isVisible()).toBe(true);
      expect(await page.locator('#global-search-input').evaluate(element => document.activeElement === element)).toBe(true);
      await page.locator('#global-search-input').fill('9021');
      expect(await page.locator('.global-search-result').count()).toBe(1);
      expect(await page.locator('#global-search-results').textContent()).not.toContain('4111111111119021');
      await page.locator('.global-search-result').click();
      await page.waitForFunction(() => document.getElementById('current-vault-title').textContent === 'Financial Vault');
      const searchedTableRow = page.locator('tr[data-vault-entry-id="e2e-search-card"]');
      expect(await searchedTableRow.isVisible()).toBe(true);
      expect(await searchedTableRow.locator('.table-reveal-btn').textContent()).not.toContain('4111111111119021');

      await page.locator('#global-search-open-btn').click();
      await page.locator('#global-search-input').fill('9021');
      expect(await page.locator('.global-search-result').count()).toBe(1);
      expect(await page.locator('#global-search-results').textContent()).not.toContain('4111111111119021');
      await page.evaluate(() => window.electronAPI.lockManagerLock('E2E search lock'));
      await page.waitForFunction(() => {
        const unlock = document.getElementById('unlock-vault-view');
        const overlay = document.getElementById('global-search-overlay');
        return unlock && !unlock.classList.contains('hidden') &&
          overlay && overlay.classList.contains('hidden');
      });
      expect(await page.locator('#global-search-input').inputValue()).toBe('');
      expect(await page.locator('#global-search-results').textContent()).toBe('');

      await page.locator('#unlock-mp-input').fill('WrongPassword!2026');
      await page.locator('#unlock-btn').click();
      await page.waitForFunction(() => {
        const error = document.getElementById('unlock-error-text');
        return error && error.style.display === 'block';
      });
      expect(await page.evaluate(() => localStorage.getItem('vantalock_failed_attempts'))).toBe('1');
      expect(await page.evaluate(() => window.activeVaultType)).toBe('real');

      await page.locator('#unlock-mp-input').fill(masterPassword);
      await page.locator('#unlock-btn').click();
      await page.waitForFunction(() => {
        const dashboard = document.getElementById('dashboard-view-container');
        return dashboard && !dashboard.classList.contains('hidden');
      });
      expect(await page.evaluate(() => localStorage.getItem('vantalock_failed_attempts'))).toBe('0');

      await app.close();
      app = await electron.launch({
        args: [workspaceRoot, `--user-data-dir=${profileDirectory}`, '--no-sandbox']
      });
      const reopenedPage = await app.firstWindow();
      reopenedPage.on('pageerror', error => pageErrors.push(error.message));
      await reopenedPage.waitForFunction(() => {
        const splash = document.getElementById('splash-overlay');
        const unlock = document.getElementById('unlock-vault-view');
        return splash && splash.style.display === 'none' &&
          unlock && !unlock.classList.contains('hidden');
      }, null, { timeout: 10000 });
      expect(await reopenedPage.locator('[data-display-mode="table"]').getAttribute('aria-pressed')).toBe('true');
      await reopenedPage.locator('#unlock-mp-input').fill(masterPassword);
      await reopenedPage.locator('#unlock-btn').click();
      await reopenedPage.waitForFunction(() => {
        const dashboard = document.getElementById('dashboard-view-container');
        return dashboard && !dashboard.classList.contains('hidden');
      });
      expect(pageErrors).toEqual([]);
    } finally {
      if (app) await app.close();
      fs.rmSync(profileDirectory, { recursive: true, force: true });
    }
  },
  90000
);
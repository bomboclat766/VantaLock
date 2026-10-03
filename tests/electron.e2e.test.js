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

      await page.locator('#panic-lock-btn').click();
      await page.waitForFunction(() => {
        const unlock = document.getElementById('unlock-vault-view');
        return unlock && !unlock.classList.contains('hidden');
      });
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
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
      const headerLayout = await page.evaluate(() => {
        const right = document.querySelector('.titlebar-right');
        const header = document.getElementById('titlebar-bar').getBoundingClientRect();
        const items = Array.from(right.children).map(element => {
          const rect = element.getBoundingClientRect();
          return {
            id: element.id || element.className,
            left: rect.left,
            right: rect.right,
            top: rect.top,
            bottom: rect.bottom,
            visible: rect.width > 0 && rect.height > 0
          };
        });
        const lock = document.getElementById('panic-lock-btn');
        const lockRect = lock.getBoundingClientRect();
        const lockText = lock.querySelector('span').getBoundingClientRect();
        return {
          items,
          header: { left: header.left, right: header.right, top: header.top, bottom: header.bottom },
          lockTextFits: lock.scrollWidth <= lock.clientWidth &&
            lockText.left >= lockRect.left && lockText.right <= lockRect.right,
          lockVerticallyCentered: Math.abs(
            (lockRect.top + lockRect.bottom) / 2 - (header.top + header.bottom) / 2
          ) <= 1
        };
      });
      expect(headerLayout.items.map(item => item.id)).toEqual([
        'theme-selector-wrap',
        'entry-display-modes',
        'global-search-open-btn',
        'panic-lock-btn',
        'status-indicator'
      ]);
      expect(headerLayout.items.every(item => item.visible)).toBe(true);
      expect(headerLayout.items.map(item => item.left)).toEqual(
        [...headerLayout.items.map(item => item.left)].sort((a, b) => a - b)
      );
      expect(headerLayout.items.at(-1).right).toBeLessThanOrEqual(headerLayout.header.right);
      expect(headerLayout.lockTextFits).toBe(true);
      expect(headerLayout.lockVerticallyCentered).toBe(true);

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
        window.vaultEntries.push(
          {
            id: 'e2e-bank-icon',
            vault: 'financial',
            type: 'bank',
            typeName: 'Bank Account',
            title: 'Bank Icon Entry',
            fields: {}
          },
          {
            id: 'e2e-loan-icon',
            vault: 'financial',
            type: 'loan',
            typeName: 'Loan & Mortgage',
            title: 'Loan Icon Entry',
            fields: {}
          },
          {
            id: 'e2e-id-icon',
            vault: 'legal',
            type: 'ssn',
            typeName: 'Identity / SSN / ID',
            title: 'Identity Icon Entry',
            fields: {}
          },
          {
            id: 'e2e-imported-bank-icon',
            vault: 'financial',
            type: 'bank_account',
            typeName: 'Bank Account',
            title: 'Imported Bank Icon Entry',
            fields: {}
          },
          {
            id: 'e2e-card-icon',
            vault: 'financial',
            type: 'card',
            typeName: 'Payment Card',
            title: 'Card Icon Entry',
            fields: {}
          },
          {
            id: 'e2e-crypto-icon',
            vault: 'financial',
            type: 'crypto',
            typeName: 'Crypto Wallet',
            title: 'Crypto Icon Entry',
            fields: {}
          },
          {
            id: 'e2e-tax-icon',
            vault: 'financial',
            type: 'tax',
            typeName: 'Tax Document',
            title: 'Tax Icon Entry',
            fields: {}
          },
          {
            id: 'e2e-passport-icon',
            vault: 'legal',
            type: 'passport',
            typeName: 'Passport',
            title: 'Passport Icon Entry',
            fields: {}
          },
          {
            id: 'e2e-contract-icon',
            vault: 'legal',
            type: 'contract',
            typeName: 'Legal Contract',
            title: 'Contract Icon Entry',
            fields: {}
          },
          {
            id: 'e2e-deed-icon',
            vault: 'legal',
            type: 'deed',
            typeName: 'Property Deed / Title',
            title: 'Deed Icon Entry',
            fields: {}
          },
          {
            id: 'e2e-will-icon',
            vault: 'legal',
            type: 'will',
            typeName: 'Will & Estate Plan',
            title: 'Will Icon Entry',
            fields: {}
          },
          {
            id: 'e2e-login-icon',
            vault: 'personal',
            type: 'login',
            typeName: 'Login / Password',
            title: 'Login Icon Entry',
            fields: {}
          },
          {
            id: 'e2e-note-icon',
            vault: 'personal',
            type: 'note',
            typeName: 'Secure Note',
            title: 'Note Icon Entry',
            fields: {}
          },
          {
            id: 'e2e-medical-icon',
            vault: 'personal',
            type: 'medical',
            typeName: 'Medical & Prescription Info',
            title: 'Medical Icon Entry',
            fields: {}
          },
          {
            id: 'e2e-emergency-icon',
            vault: 'personal',
            type: 'emergency',
            typeName: 'Emergency Instruction',
            title: 'Emergency Icon Entry',
            fields: {}
          },
          {
            id: 'e2e-file-icon',
            vault: 'personal',
            type: 'file',
            typeName: 'Encrypted File',
            title: 'File Icon Entry',
            fields: { filename: 'scan.pdf', filetype: 'application/pdf' }
          },
          {
            id: 'e2e-custom-icon',
            vault: 'personal',
            type: 'custom_imported_type',
            typeName: 'Imported Custom Entry',
            title: 'Custom Type Icon Entry',
            fields: {}
          }
        );
        window.persistActiveVaultEntries();
        window.renderVaultEntries();
      });

      await page.locator('[data-display-mode="list"]').click();
      const bankIcon = await page.locator('[data-vault-entry-id="e2e-bank-icon"] .entry-list-icon svg').evaluate(element => element.outerHTML);
      const loanIcon = await page.locator('[data-vault-entry-id="e2e-loan-icon"] .entry-list-icon svg').evaluate(element => element.outerHTML);
      const importedBankIcon = await page.locator('[data-vault-entry-id="e2e-imported-bank-icon"] .entry-list-icon svg').evaluate(element => element.outerHTML);
      expect(bankIcon).not.toBe(loanIcon);
      expect(importedBankIcon).toBe(bankIcon);
      const iconCases = [
        ['financial', 'e2e-bank-icon'],
        ['financial', 'e2e-card-icon'],
        ['financial', 'e2e-crypto-icon'],
        ['financial', 'e2e-loan-icon'],
        ['financial', 'e2e-tax-icon'],
        ['legal', 'e2e-passport-icon'],
        ['legal', 'e2e-id-icon'],
        ['legal', 'e2e-contract-icon'],
        ['legal', 'e2e-deed-icon'],
        ['legal', 'e2e-will-icon'],
        ['personal', 'e2e-login-icon'],
        ['personal', 'e2e-note-icon'],
        ['personal', 'e2e-medical-icon'],
        ['personal', 'e2e-emergency-icon'],
        ['personal', 'e2e-file-icon'],
        ['personal', 'e2e-custom-icon']
      ];
      const renderedIcons = [];
      let selectedCompartment = 'financial';
      for (const [compartment, entryId] of iconCases) {
        if (compartment !== selectedCompartment) {
          await page.locator(`[data-vault="${compartment}"]`).click();
          selectedCompartment = compartment;
        }
        const icon = page.locator(`[data-vault-entry-id="${entryId}"] .entry-list-icon svg`);
        expect(await icon.count()).toBe(1);
        const svg = await icon.evaluate(element => element.outerHTML);
        expect(svg).toContain('<svg');
        const rendered = await icon.evaluate(element => {
          const bounds = element.getBoundingClientRect();
          const shapes = Array.from(
            element.querySelectorAll('path, rect, circle, line, polyline, polygon, ellipse')
          );
          const hasPaintedShape = shapes.some(shape => {
            const style = getComputedStyle(shape);
            return (style.stroke !== 'none' && Number.parseFloat(style.strokeWidth) > 0) ||
              style.fill !== 'none';
          });
          const clone = element.cloneNode(true);
          clone.setAttribute('width', '48');
          clone.setAttribute('height', '48');
          clone.style.color = getComputedStyle(element).color;
          clone.style.stroke = getComputedStyle(element).stroke;
          clone.style.strokeWidth = getComputedStyle(element).strokeWidth;
          clone.style.fill = getComputedStyle(element).fill;
          const cloneShapes = Array.from(
            clone.querySelectorAll('path, rect, circle, line, polyline, polygon, ellipse')
          );
          cloneShapes.forEach((shape, index) => {
            const style = getComputedStyle(shapes[index]);
            shape.style.stroke = style.stroke;
            shape.style.strokeWidth = style.strokeWidth;
            shape.style.fill = style.fill;
          });
          const svgUrl = URL.createObjectURL(new Blob(
            [new XMLSerializer().serializeToString(clone)],
            { type: 'image/svg+xml' }
          ));
          return new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => {
              const canvas = document.createElement('canvas');
              canvas.width = 48;
              canvas.height = 48;
              const context = canvas.getContext('2d');
              context.drawImage(image, 0, 0);
              const pixels = context.getImageData(0, 0, 48, 48).data;
              let paintedPixelCount = 0;
              for (let index = 3; index < pixels.length; index += 4) {
                if (pixels[index] > 0) paintedPixelCount++;
              }
              URL.revokeObjectURL(svgUrl);
              resolve({
                width: bounds.width,
                height: bounds.height,
                hasPaintedShape,
                paintedPixelCount
              });
            };
            image.onerror = () => {
              URL.revokeObjectURL(svgUrl);
              reject(new Error('Entry SVG could not be rasterized'));
            };
            image.src = svgUrl;
          });
        });
        expect(rendered.width).toBeGreaterThan(0);
        expect(rendered.height).toBeGreaterThan(0);
        expect(rendered.hasPaintedShape).toBe(true);
        expect(rendered.paintedPixelCount).toBeGreaterThan(0);
        renderedIcons.push({ entryId, svg });
      }
      const duplicateIcons = renderedIcons.flatMap((icon, index) => {
        const firstIndex = renderedIcons.findIndex(candidate => candidate.svg === icon.svg);
        return firstIndex !== index
          ? [{ first: renderedIcons[firstIndex].entryId, duplicate: icon.entryId }]
          : [];
      });
      expect(duplicateIcons).toEqual([]);

      await page.locator('[data-display-mode="card"]').click();
      const cardRenderedIcons = [];
      selectedCompartment = 'personal';
      for (const [compartment, entryId] of iconCases) {
        if (compartment !== selectedCompartment) {
          await page.locator(`[data-vault="${compartment}"]`).click();
          selectedCompartment = compartment;
        }
        const icon = page.locator(`[data-vault-entry-id="${entryId}"] .category-badge svg`);
        const iconCount = await icon.count();
        if (iconCount !== 1) throw new Error(`Expected one Card view SVG for ${entryId}, found ${iconCount}`);
        const svg = await icon.evaluate(element => element.outerHTML);
        expect(svg).toContain('<svg');
        const rendered = await icon.evaluate(element => {
          const bounds = element.getBoundingClientRect();
          const shapes = Array.from(
            element.querySelectorAll('path, rect, circle, line, polyline, polygon, ellipse')
          );
          const hasPaintedShape = shapes.some(shape => {
            const style = getComputedStyle(shape);
            return (style.stroke !== 'none' && Number.parseFloat(style.strokeWidth) > 0) ||
              style.fill !== 'none';
          });
          const clone = element.cloneNode(true);
          clone.setAttribute('width', '48');
          clone.setAttribute('height', '48');
          clone.style.color = getComputedStyle(element).color;
          clone.style.stroke = getComputedStyle(element).stroke;
          clone.style.strokeWidth = getComputedStyle(element).strokeWidth;
          clone.style.fill = getComputedStyle(element).fill;
          const cloneShapes = Array.from(
            clone.querySelectorAll('path, rect, circle, line, polyline, polygon, ellipse')
          );
          cloneShapes.forEach((shape, index) => {
            const style = getComputedStyle(shapes[index]);
            shape.style.stroke = style.stroke;
            shape.style.strokeWidth = style.strokeWidth;
            shape.style.fill = style.fill;
          });
          const svgUrl = URL.createObjectURL(new Blob(
            [new XMLSerializer().serializeToString(clone)],
            { type: 'image/svg+xml' }
          ));
          return new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => {
              const canvas = document.createElement('canvas');
              canvas.width = 48;
              canvas.height = 48;
              const context = canvas.getContext('2d');
              context.drawImage(image, 0, 0);
              const pixels = context.getImageData(0, 0, 48, 48).data;
              let paintedPixelCount = 0;
              for (let index = 3; index < pixels.length; index += 4) {
                if (pixels[index] > 0) paintedPixelCount++;
              }
              URL.revokeObjectURL(svgUrl);
              resolve({
                width: bounds.width,
                height: bounds.height,
                hasPaintedShape,
                paintedPixelCount
              });
            };
            image.onerror = () => {
              URL.revokeObjectURL(svgUrl);
              reject(new Error('Entry SVG could not be rasterized'));
            };
            image.src = svgUrl;
          });
        });
        expect(rendered.width).toBeGreaterThan(0);
        expect(rendered.height).toBeGreaterThan(0);
        expect(rendered.hasPaintedShape).toBe(true);
        expect(rendered.paintedPixelCount).toBeGreaterThan(0);
        cardRenderedIcons.push({ entryId, svg });
      }
      const duplicateCardIcons = cardRenderedIcons.flatMap((icon, index) => {
        const firstIndex = cardRenderedIcons.findIndex(candidate => candidate.svg === icon.svg);
        return firstIndex !== index
          ? [{ first: cardRenderedIcons[firstIndex].entryId, duplicate: icon.entryId }]
          : [];
      });
      expect(duplicateCardIcons).toEqual([]);
      await page.locator('[data-vault="financial"]').click();
      const cardBankIcon = cardRenderedIcons.find(icon => icon.entryId === 'e2e-bank-icon');
      const cardImportedBankIcon = await page.locator('[data-vault-entry-id="e2e-imported-bank-icon"] .category-badge svg')
        .evaluate(element => element.outerHTML);
      expect(cardImportedBankIcon).toBe(cardBankIcon.svg);

      await page.locator('[data-display-mode="list"]').click();

      const listSummary = page.locator('.entry-list-summary').filter({ hasText: 'E2E Search Card' });
      expect(await listSummary.isVisible()).toBe(true);
      expect(await listSummary.textContent()).toContain('9021');
      expect(await listSummary.textContent()).not.toContain('4111111111119021');
      await listSummary.click();
      expect(await listSummary.getAttribute('aria-expanded')).toBe('true');
      const expandedStyle = await listSummary.evaluate(element => {
        const item = element.closest('.entry-list-item');
        const style = getComputedStyle(item);
        return { overflow: style.overflow, zIndex: style.zIndex };
      });
      expect(expandedStyle.overflow).toBe('visible');
      expect(expandedStyle.zIndex).toBe('1');
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
      await page.evaluate(() => {
        localStorage.setItem('vantalock_lockout_threshold', '1');
        localStorage.setItem('vantalock_lockout_duration', '1');
        window.__e2eLockoutNow = 1000000;
        window.__e2eOriginalDateNow = Date.now;
        Date.now = () => window.__e2eLockoutNow;
      });
      await page.locator('#unlock-btn').click();
      await page.waitForFunction(() => {
        const modal = document.getElementById('lockout-modal-overlay');
        return modal && modal.style.display === 'flex';
      });
      expect(await page.evaluate(() => localStorage.getItem('vantalock_failed_attempts'))).toBe('1');
      expect(await page.evaluate(() => window.activeVaultType)).toBe('real');
      await page.evaluate(() => {
        window.__e2eLockoutNow =
          Number(localStorage.getItem('vantalock_lockout_expires_at')) + 1;
      });
      await page.waitForFunction(() => {
        const modal = document.getElementById('lockout-modal-overlay');
        const unlock = document.getElementById('unlock-vault-view');
        const dashboard = document.getElementById('dashboard-view-container');
        return modal && modal.style.display === 'none' &&
          unlock && !unlock.classList.contains('hidden') &&
          dashboard && dashboard.classList.contains('hidden');
      });
      expect(await page.evaluate(() => localStorage.getItem('vantalock_failed_attempts'))).toBe('0');
      await page.evaluate(() => {
        Date.now = window.__e2eOriginalDateNow;
        delete window.__e2eOriginalDateNow;
        delete window.__e2eLockoutNow;
      });

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
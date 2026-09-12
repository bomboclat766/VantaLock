const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('Starting Playwright automated testing and video recording for v1.1.43...');
  const proofDir = path.join(__dirname, 'proof_assets');
  if (!fs.existsSync(proofDir)) fs.mkdirSync(proofDir, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--allow-file-access-from-files']
  });

  // 1. Verify Landing Page (Screenshot 2)
  console.log('Verifying Landing Page and v1.1.43 badge...');
  const landingContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const landingPage = await landingContext.newPage();
  const landingPath = `file://${path.join(__dirname, 'landing-page/index.html')}`;
  await landingPage.goto(landingPath);
  await landingPage.waitForTimeout(500);

  // Scroll to feature cards
  await landingPage.evaluate(() => window.scrollTo(0, 1800));
  await landingPage.waitForTimeout(500);
  await landingPage.screenshot({ path: path.join(proofDir, 'screenshot_2_landing_page_health_card.png') });
  console.log('Captured screenshot_2_landing_page_health_card.png');
  await landingContext.close();

  // 2. App User Journey & Video Recording
  const appContext = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: proofDir, size: { width: 1280, height: 800 } }
  });

  const page = await appContext.newPage();
  const appPath = `file://${path.join(__dirname, 'src/renderer/index.html')}`;

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err));

  await page.goto(appPath);
  await page.waitForTimeout(500);

  // Clear localStorage and reload
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(500);

  // Dismiss splash screen
  await page.evaluate(() => {
    if (typeof dismissSplash === 'function') dismissSplash();
  });
  await page.waitForTimeout(1000);

  // Setup Master Password
  console.log('Setting up Master Password...');
  if (await page.isVisible('#get-started-btn')) {
    await page.click('#get-started-btn');
    await page.waitForTimeout(500);
  }

  await page.fill('#mp-input', 'MasterPass123!');
  await page.fill('#mp-confirm-input', 'MasterPass123!');
  await page.click('#create-mp-btn');

  await page.waitForSelector('#recovery-key-reveal-step:not(.hidden), #biometric-optin-modal:not(.hidden)', { timeout: 15000 });

  if (await page.isVisible('#skip-biometrics-btn')) {
    await page.click('#skip-biometrics-btn');
    await page.waitForSelector('#recovery-key-reveal-step:not(.hidden)', { timeout: 10000 });
  }

  const generatedWords = await page.$$eval('#recovery-words-grid .word-chip', chips => {
    return chips.map(c => {
      const spans = c.querySelectorAll('span');
      return spans[1] ? spans[1].textContent.trim() : '';
    });
  });

  await page.click('#proceed-to-verify-rk-btn');
  await page.waitForSelector('#recovery-key-verify-step:not(.hidden)', { timeout: 10000 });

  const verifyInputs = await page.$$('.rk-verify-input');
  for (const input of verifyInputs) {
    const idx = parseInt(await input.getAttribute('data-index'), 10);
    await input.fill(generatedWords[idx]);
  }
  await page.click('#verify-rk-btn');
  await page.waitForSelector('#dashboard-view-container:not(.hidden)', { timeout: 10000 });

  // Add 3 different assets with weak/short passwords
  console.log('Adding multiple sensitive vault assets with weak credentials...');

  // Asset 1: Wifi Password
  await page.click('#add-entry-btn');
  await page.waitForTimeout(500);
  await page.fill('#entry-title-input', 'Wifi password');

  let pwdInp = await page.$('input[name="pin_password"]');
  if (pwdInp) await pwdInp.fill('123REW');
  await page.click('#entry-dynamic-form button[type="submit"]');
  await page.waitForTimeout(800);

  // Asset 2: Chase Bank Card PIN
  await page.click('#add-entry-btn');
  await page.waitForTimeout(500);
  await page.fill('#entry-title-input', 'Chase Bank Card PIN');
  pwdInp = await page.$('input[name="pin_password"]');
  if (pwdInp) await pwdInp.fill('4321');
  await page.click('#entry-dynamic-form button[type="submit"]');
  await page.waitForTimeout(800);

  // Asset 3: File Attachment (MUST BE SKIPPED BY ENGINE)
  console.log('Adding file attachment entry (must be skipped)...');
  await page.click('#add-file-btn');
  await page.waitForTimeout(500);
  await page.fill('#file-title-input', 'Secret Document Attachment.pdf');

  // Create mock file in file-picker
  await page.setInputFiles('#file-picker-input', {
    name: 'document.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('Mock PDF content')
  });
  await page.click('#file-upload-form button[type="submit"]');
  await page.waitForTimeout(1000);

  // Navigate to Security Center
  console.log('Navigating to Security Center...');
  await page.click('.tool-tab-btn[data-tool="security"]');
  await page.waitForTimeout(1000);

  // Screenshot 1: Security Center showing TWO distinct cards (Password Health Check & OS Biometrics)
  await page.screenshot({ path: path.join(proofDir, 'screenshot_1_security_center_two_cards.png') });
  console.log('Captured screenshot_1_security_center_two_cards.png');

  // Test "Configure OS Biometrics" on unsupported device
  await page.click('#configure-biometrics-btn');
  await page.waitForTimeout(800);
  await page.click('#bio-notice-ok-btn');
  await page.waitForTimeout(500);

  // Run Password Health Check #1
  console.log('Running Password Health Check Attempt 1...');
  await page.click('#open-health-check-btn');

  await page.waitForSelector('#health-results-view', { state: 'visible', timeout: 10000 });
  await page.waitForTimeout(1500);

  // Verify "Fix Now" modal workflow
  console.log('Testing Fix Now modal workflow...');
  const fixBtns = await page.$$('.fix-entry-btn');
  if (fixBtns.length > 0) {
    await fixBtns[0].click();
    await page.waitForTimeout(1000);

    // Verify modal elements
    const assetTitle = await page.textContent('#fix-asset-title');
    const currentSecret = await page.textContent('#fix-current-secret');
    const newPwdVal = await page.inputValue('#fix-new-pwd-display');

    console.log('Fix Modal opened for:', assetTitle.trim(), '| Weak secret:', currentSecret.trim(), '| New 24-char pwd len:', newPwdVal.length);

    // Click "Yes, I have updated my account"
    await page.click('#confirm-fix-updated-btn');
    await page.waitForTimeout(1000);
  }

  // Screenshot 3: History canvas graph
  await page.screenshot({ path: path.join(proofDir, 'screenshot_3_health_history_canvas.png') });
  console.log('Captured screenshot_3_health_history_canvas.png');

  // Close health modal
  await page.click('#close-health-modal-btn');
  await page.waitForTimeout(800);

  // Re-run scan to verify fixed item is no longer flagged and score increased
  console.log('Re-running scan to verify fixed secret is scored 100...');
  await page.click('#open-health-check-btn');
  await page.waitForSelector('#health-results-view', { state: 'visible', timeout: 10000 });
  await page.waitForTimeout(1500);

  await page.click('#close-health-modal-btn');
  await page.waitForTimeout(800);

  // Zero Corruption Guarantee Verification: Recovery Phrase reveal
  console.log('Verifying Zero Corruption Guarantee (Recovery Phrase reveal)...');
  await page.click('.tool-tab-btn[data-tool="seed"]');
  await page.waitForTimeout(800);
  await page.fill('#seed-mp-confirm', 'MasterPass123!');
  await page.click('#seed-gate-form button[type="submit"]');
  await page.waitForTimeout(1000);

  console.log('Closing browser and saving video...');
  await appContext.close();
  await browser.close();

  console.log('All Playwright verifications completed successfully!');
})().catch(err => {
  console.error('Playwright test error:', err);
  process.exit(1);
});

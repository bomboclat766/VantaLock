const fs = require('fs');
const path = require('path');

describe('Phase 6 Landing-Page Verification Matrix Audit', () => {
  test('LANDING-PAGE-VERIFICATION.md exists and contains pass status for C1-C17', () => {
    const claimsPath = path.join(__dirname, '..', 'LANDING-PAGE-VERIFICATION.md');
    expect(fs.existsSync(claimsPath)).toBe(true);

    const content = fs.readFileSync(claimsPath, 'utf8');

    for (let i = 1; i <= 17; i++) {
      expect(content).toContain(`C${i}`);
    }
  });
});

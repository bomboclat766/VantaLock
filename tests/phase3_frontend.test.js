const fs = require('fs');
const path = require('path');

describe('Phase 3 Frontend, Migration & Feature Integration Verification', () => {
  test('Option (a) blocking seed migration screen exists without skip option', () => {
    const appJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf8');
    // Ensure recovery key verification screen or seed confirmation step is present and has no skip button
    expect(appJs).toContain('recovery-key-verify');
    expect(appJs).not.toMatch(/id=["']skip-seed-btn["']/);
  });

  test('Vault compartments and entry types match Section 4.1 specification', () => {
    const appJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf8');
    expect(appJs).toContain('financial');
    expect(appJs).toContain('legal');
    expect(appJs).toContain('personal');
    expect(appJs).toContain('bank');
    expect(appJs).toContain('card');
    expect(appJs).toContain('crypto');
  });

  test('Web assets size is under 1.5 MB limit', () => {
    const rendererDir = path.join(__dirname, '..', 'src', 'renderer');
    const files = fs.readdirSync(rendererDir);
    let totalBytes = 0;

    files.forEach(f => {
      const stat = fs.statSync(path.join(rendererDir, f));
      if (stat.isFile()) {
        totalBytes += stat.size;
      }
    });

    expect(totalBytes).toBeLessThan(1500000);
  });
});

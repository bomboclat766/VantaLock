const fs = require('fs');
const path = require('path');

describe('Phase 0 & Section 0C Defect Sweep Verification', () => {
  test('SWEEP-RESULTS.md exists and contains all required Stop-Ship defects and 10 sweep items', () => {
    const sweepPath = path.join(__dirname, '..', 'SWEEP-RESULTS.md');
    expect(fs.existsSync(sweepPath)).toBe(true);

    const content = fs.readFileSync(sweepPath, 'utf8');

    // Verify SS-1 to SS-15 entries exist
    for (let i = 1; i <= 15; i++) {
      expect(content).toContain(`SS-${i}`);
    }

    // Verify SWEEP-01 to SWEEP-10 entries exist
    for (let i = 1; i <= 10; i++) {
      const pad = String(i).padStart(2, '0');
      expect(content).toContain(`SWEEP-${pad}`);
    }
  });

  test('local.db is removed from the working tree and ignored in .gitignore', () => {
    const localDbPath = path.join(__dirname, '..', 'local.db');
    expect(fs.existsSync(localDbPath)).toBe(false);

    const gitignorePath = path.join(__dirname, '..', '.gitignore');
    const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
    expect(gitignoreContent).toContain('local.db');
  });
});

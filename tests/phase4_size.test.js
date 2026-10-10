const { execSync } = require('child_process');
const path = require('path');

describe('Phase 4 Packaging & Size Limit Verification', () => {
  test('tests/check_size_budgets.js runs and passes size checks', () => {
    const checkScript = path.join(__dirname, 'check_size_budgets.js');
    expect(() => {
      execSync(`node "${checkScript}"`, { stdio: 'pipe' });
    }).not.toThrow();
  });
});

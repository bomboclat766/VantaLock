const fs = require('fs');
const path = require('path');

describe('Landing page scramble asset wiring', () => {
  const landingRoot = path.join(__dirname, '..', 'landing-page');

  test('scramble.js exists and contains scramble and fade logic', () => {
    const scriptPath = path.join(landingRoot, 'scramble.js');
    const script = fs.readFileSync(scriptPath, 'utf8');

    expect(script).toContain('initScramble');
    expect(script).toContain('initCardFade');
    expect(script).toContain('IntersectionObserver');
  });

  test('all landing-page HTML files load scramble.js before </body>', () => {
    const htmlFiles = [];

    function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.html')) {
          htmlFiles.push(fullPath);
        }
      }
    }

    walk(landingRoot);

    for (const file of htmlFiles) {
      const html = fs.readFileSync(file, 'utf8');
      const scriptIndex = html.lastIndexOf('scramble.js');
      const bodyCloseIndex = html.lastIndexOf('</body>');

      expect(scriptIndex).toBeGreaterThan(-1);
      expect(bodyCloseIndex).toBeGreaterThan(scriptIndex);
    }
  });
});

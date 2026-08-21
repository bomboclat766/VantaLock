const ClipboardManager = require('../src/crypto/clipboardManager');

describe('Clipboard Manager & Security Hardening (Phase 6)', () => {
  jest.useFakeTimers();

  test('copySensitiveText clears clipboard after 30 seconds', () => {
    let clipboardContent = '';
    global.navigator = {
      clipboard: {
        writeText: jest.fn((text) => { clipboardContent = text; })
      }
    };

    const cbManager = new ClipboardManager(30000);
    cbManager.copySensitiveText('SecretPassphrase123');

    expect(clipboardContent).toBe('SecretPassphrase123');

    jest.advanceTimersByTime(30000);
    expect(clipboardContent).toBe('');
  });
});

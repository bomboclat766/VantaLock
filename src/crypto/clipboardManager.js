/**
 * Security Hardening Clipboard Manager (Phase 6)
 * Auto-clears sensitive data copied to clipboard after 30 seconds.
 */

class ClipboardManager {
  constructor(timeoutMs = 30000) {
    this.timeoutMs = timeoutMs;
    this.timer = null;
    this.lastCopiedText = null;
  }

  copySensitiveText(text) {
    if (this.timer) clearTimeout(this.timer);
    this.lastCopiedText = text;

    if (navigator && navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }

    this.timer = setTimeout(() => {
      this.clearIfMatches(text);
    }, this.timeoutMs);
  }

  clearIfMatches(expectedText) {
    if (this.lastCopiedText === expectedText) {
      if (navigator && navigator.clipboard) {
        navigator.clipboard.writeText('');
      }
      this.lastCopiedText = null;
    }
  }
}

module.exports = ClipboardManager;

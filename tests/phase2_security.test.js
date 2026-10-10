const fs = require('fs');
const path = require('path');

describe('Phase 2 Security, Capability Allowlist & CSP Verification', () => {
  test('Exact strict CSP string is configured in tauri.conf.json', () => {
    const configPath = path.join(__dirname, '..', 'src-tauri', 'tauri.conf.json');
    expect(fs.existsSync(configPath)).toBe(true);

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const expectedCsp = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'.";

    expect(config.app.security.csp).toBe(expectedCsp);
  });

  test('Tauri capability file contains strict command allowlist', () => {
    const capPath = path.join(__dirname, '..', 'src-tauri', 'capabilities', 'default.json');
    expect(fs.existsSync(capPath)).toBe(true);

    const cap = JSON.parse(fs.readFileSync(capPath, 'utf8'));
    const permissions = cap.permissions;

    const requiredPermissions = [
      "core:default",
      "allow-setup-vault",
      "allow-generate-recovery-seed",
      "allow-unlock-vault",
      "allow-unlock-with-biometric",
      "allow-lock-vault",
      "allow-lockout-status",
      "allow-set-lockout-policy",
      "allow-list-entries",
      "allow-get-entry",
      "allow-copy-field",
      "allow-create-entry",
      "allow-update-entry",
      "allow-delete-entry",
      "allow-add-attachment",
      "allow-open-attachment",
      "allow-backup-create",
      "allow-backup-restore",
      "allow-activate-license",
      "allow-check-for-update",
      "allow-get-app-version"
    ];

    expect(permissions).toEqual(requiredPermissions);
  });
});

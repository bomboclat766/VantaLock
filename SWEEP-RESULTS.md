# VantaLock Section 0C Defect Sweep & Stop-Ship Audit Results

Date: 2025-02-23
Owner: Jules (build), Osteen (product)

## Stop-Ship Defects (SS-1 to SS-15)

| SS-ID | Defect Summary | Location / Evidence | Required Fix | Test ID | Owner / Status |
|-------|----------------|--------------------|--------------|---------|----------------|
| SS-1 | Recovery seed stored in plaintext in `localStorage` | `app.js` lines 1415, 1424, 1524, 2482 | Never write seed to browser store, plaintext file, or log. Purge existing seed on first run. Shown once. | 6.2 | Jules / Open |
| SS-2 | Biometric token (`vantalock_secure_token`) backed by software `safeStorage` in `localStorage` | `app.js` line 2722, `main.js` | Hardware-bound key wrapping (macOS Secure Enclave via Security.framework, Windows TPM 2.0 via CNG, Linux disabled). | 6.9 | Jules / Implemented, pending hardware test |
| SS-3 | Vault entries, decoy data, lockout counters, salt, verifier in `localStorage` | `app.js` localStorage calls | All secrets/metadata stored inside Rust-owned encrypted vault file. Webview has zero localStorage access to secrets. | 6.2 | Jules / Open |
| SS-4 | `local.db` committed in git repository | Root `local.db` | Remove `local.db` from git history using `git filter-repo`, add to `.gitignore`. | 6.2 | Jules / Open |
| SS-5 | No CI size budget checks | `.github/workflows/build.yml` | Fail CI if installer > 10 MB or installed app > 15 MB. | 6.10 | Jules / Open |
| SS-6 | Decrypted attachments written to OS temp in plaintext | `main.js` line 135 (`open-file-native`) | Write to private temp directory, delete on lock/exit/60s timeout, overwrite before deletion where OS allows. | 6.3 | Jules / Open |
| SS-7 | Missing Content Security Policy | `index.html` and `main.js` | Set exact strict CSP: `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'.` | 6.2 | Jules / Open |
| SS-8 | Predictable password generator pattern (`<name>Pass#20<2 digits>!`) | `app.js` lines 595-605 | Use CSPRNG generator. Real vault never receives generator output from that path; sample/decoy separate. | 6.1 | Jules / Open |
| SS-9 | Electron `safeStorage` description imprecise | `app.js`, `main.js` | Update specs/docs/code to accurately reflect OS keystore vs hardware-bound TPM/Secure Enclave. | 6.9 | Jules / Open |
| SS-10 | Path traversal in `open-file-native` | `main.js` lines 127-128 | Sanitize with `path.basename`, restrict characters, verify resolution inside private temp directory. | 6.2 | Jules / Open |
| SS-11 | Unrestricted Electron window navigation | `main.js`, `app.js` | Restrict navigation to internal pages; open external URLs only via allowlisted system browser command. | 6.2 | Jules / Open |
| SS-12 | Admin API un-rate-limited & public static serving of admin files | `server.js` | Rate limit admin routes (5 attempts / 15 min per IP), remove static admin file serving, require valid session before loading any content. | 6.1 | Jules / Open |
| SS-13 | Default file write permissions | `vaultStorage.js` `writeFileSync` calls | Create vault, attachment, backup, and temp files with mode 0600 on macOS/Linux and restricted ACL on Windows. | 6.1 | Jules / Open |
| SS-14 | Unverified backup key derivation | `vaultBackup.js` | Derive key with Argon2id parameters, fresh salt in versioned header. Verify 1.1.49 backup derivation. | 6.1 | Jules / Open |
| SS-15 | Unbounded attachment input data size | `open-file-native` handler | Reject inputs larger than 50 MB. | 6.3 | Jules / Open |

---

## Section 0C Sweep Items (10 Minimum Checked Items)

| Sweep Item ID | Category | Audit Description & Location | Finding / Evidence | Required Fix / Action | Test ID |
|---------------|----------|------------------------------|--------------------|-----------------------|---------|
| SWEEP-01 | Storage Writes | Audit all 37 `localStorage.setItem` calls in `app.js` | 37 setItem calls persist entries, decoy passwords, lockout state, seed, salt, verifier, tokens in webview storage | Migrate all secrets/state to Rust encrypted vault; zero sensitive webview storage | 6.2 |
| SWEEP-02 | Storage Reads | Audit all `localStorage.getItem` calls in `app.js` | Webview reads plaintext seed (`vantalock_seed_phrase`), salt, verifier, entries directly | Remove all secret getItem calls; replace with IPC commands | 6.2 |
| SWEEP-03 | Logging | Scan all `console.*` and logger calls for secrets, seeds, keys, passwords | Found `console.log`/`console.error` in `app.js` and `server.js` | Sanitize all log calls to ensure no keys, seeds, or entries are logged | 6.2 |
| SWEEP-04 | Temp Files | Check temporary file creation in OS temp | `main.js` writes decrypted attachments with `fs.writeFileSync(filePath, buffer)` without cleanup | Move to private temp directory with secure deletion on lock/exit/timeout | 6.3 |
| SWEEP-05 | Secrets in History | Secret scan git repository history for committed credentials or keys | `local.db` tracked; check repository history with `gitleaks` | Purge `local.db` and any credentials from history | 6.2 |
| SWEEP-06 | Outbound Network Calls | Audit all network requests in desktop app | `app.js` fetches GitHub latest release API (`api.github.com`); `server.js` separate | Restrict network calls to user-initiated update check & license activation | 6.8 |
| SWEEP-07 | Dependencies | Audit node modules & Rust crates for vulnerabilities | Run `npm audit` and `cargo audit` | Fail build on any unresolved high or critical vulnerabilities | 6.1 |
| SWEEP-08 | Build Artifacts | Verify release packages omit debug symbols, source maps, test data, `.env`, `local.db` | Check build files list in `package.json` | Exclude test files, `.env`, and database files from release outputs | 6.10 |
| SWEEP-09 | File Permissions | Inspect permission modes on created files | Files created with default OS umask (no mode parameter) | Enforce mode `0600` on POSIX and restricted ACLs on Windows | 6.1 |
| SWEEP-10 | Legacy Backup Derivation | Inspect 1.1.49 backup key derivation in `vaultBackup.js` | `exportEncryptedVault` accepts `derivedKey` directly without explicit header salt/KDF params | Add versioned header with salt and Argon2id parameters; preserve backwards compatibility | 6.1 |

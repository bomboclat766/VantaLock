(function exposePasswordDialog(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.VantaLockPasswordDialog = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createPasswordDialog() {
  let activeDialog = null;

  function requestPassword({
    title,
    message,
    submitLabel = 'Continue',
    allowRecoveryPhrase = false,
    validatePassword
  }) {
    if (activeDialog) activeDialog(null);

    return new Promise(resolve => {
      const previousFocus = document.activeElement;
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay vault-password-dialog';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-labelledby', 'vault-password-dialog-title');

      const card = document.createElement('section');
      card.className = 'setup-card';
      card.style.maxWidth = '480px';

      const heading = document.createElement('h2');
      heading.id = 'vault-password-dialog-title';
      heading.className = 'setup-title';
      heading.textContent = title;

      const description = document.createElement('p');
      description.className = 'setup-desc';
      description.textContent = message;

      const form = document.createElement('form');
      form.noValidate = true;
      const fieldGroup = document.createElement('div');
      fieldGroup.className = 'form-group';

      const label = document.createElement('label');
      label.className = 'form-label';
      label.htmlFor = 'vault-password-dialog-input';
      label.textContent = 'Master password';

      const input = document.createElement('input');
      input.id = 'vault-password-dialog-input';
      input.className = 'input-field';
      input.type = 'password';
      input.autocomplete = 'current-password';
      input.required = true;
      input.setAttribute('aria-label', label.textContent);

      const error = document.createElement('p');
      error.id = 'vault-password-dialog-error';
      error.className = 'vault-password-dialog-error';
      error.setAttribute('role', 'alert');
      error.setAttribute('aria-live', 'polite');

      const buttons = document.createElement('div');
      buttons.className = 'vault-password-dialog-actions';

      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.className = 'btn-secondary';
      cancel.id = 'vault-password-dialog-cancel';
      cancel.textContent = 'Cancel';

      const submit = document.createElement('button');
      submit.type = 'submit';
      submit.className = 'btn-primary';
      submit.id = 'vault-password-dialog-submit';
      submit.textContent = submitLabel;

      const recoveryLink = document.createElement('button');
      recoveryLink.type = 'button';
      recoveryLink.className = 'vault-password-recovery-link';
      recoveryLink.id = 'vault-password-dialog-recovery';
      recoveryLink.textContent = 'Use 24-word recovery phrase instead';

      fieldGroup.append(label, input);
      buttons.append(cancel, submit);
      form.append(fieldGroup, error);
      if (allowRecoveryPhrase) form.append(recoveryLink);
      form.append(buttons);
      card.append(heading, description, form);
      overlay.appendChild(card);

      let finished = false;
      const finish = password => {
        if (finished) return;
        finished = true;
        if (activeDialog === finish) activeDialog = null;
        document.removeEventListener('keydown', onKeyDown);
        overlay.remove();
        if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
        resolve(password);
      };
      const onKeyDown = event => {
        if (event.key === 'Escape') {
          event.preventDefault();
          finish(null);
        }
      };

      activeDialog = finish;
      cancel.addEventListener('click', () => finish(null));
      recoveryLink.addEventListener('click', () => finish({ method: 'recovery' }));
      overlay.addEventListener('click', event => {
        if (event.target === overlay) finish(null);
      });
      form.addEventListener('submit', async event => {
        event.preventDefault();
        if (!input.value) {
          error.textContent = 'Enter your master password to continue.';
          input.focus();
          return;
        }
        error.textContent = '';
        submit.disabled = true;
        try {
          if (validatePassword) {
            const validation = await validatePassword(input.value);
            if (validation !== true) {
              error.textContent = validation && validation.message
                ? validation.message
                : 'Incorrect master password.';
              return;
            }
          }
          if (!finished) finish({ method: 'password', password: input.value });
        } catch (failure) {
          error.textContent = failure && failure.message
            ? `Could not verify password: ${failure.message}`
            : 'Could not verify password. Please try again.';
        } finally {
          if (!finished) submit.disabled = false;
        }
      });
      document.addEventListener('keydown', onKeyDown);
      document.body.appendChild(overlay);
      input.focus();
    });
  }

  return { requestPassword };
});

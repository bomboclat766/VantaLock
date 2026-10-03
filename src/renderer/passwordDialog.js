(function exposePasswordDialog(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.VantaLockPasswordDialog = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createPasswordDialog() {
  let activeDialog = null;

  function requestPassword({ title, message, submitLabel = 'Continue' }) {
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
      label.textContent = 'Master or backup password';

      const input = document.createElement('input');
      input.id = 'vault-password-dialog-input';
      input.className = 'input-field';
      input.type = 'password';
      input.autocomplete = 'current-password';
      input.required = true;
      input.setAttribute('aria-label', label.textContent);

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

      fieldGroup.append(label, input);
      buttons.append(cancel, submit);
      form.append(fieldGroup, buttons);
      card.append(heading, description, form);
      overlay.appendChild(card);

      const finish = password => {
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
      overlay.addEventListener('click', event => {
        if (event.target === overlay) finish(null);
      });
      form.addEventListener('submit', event => {
        event.preventDefault();
        if (!input.value) {
          input.focus();
          return;
        }
        finish(input.value);
      });
      document.addEventListener('keydown', onKeyDown);
      document.body.appendChild(overlay);
      input.focus();
    });
  }

  return { requestPassword };
});

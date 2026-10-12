export const api = {
  revision: 0,
  async request(path, options = {}) {
    const response = await fetch(path, {
      credentials: 'same-origin',
      ...options,
      headers: { 'Content-Type': 'application/json', 'X-Fieldwork-Client': 'web', ...options.headers },
    });
    const result = await response.json();
    if (!response.ok) {
      const error = new Error(result.error?.message || 'Unable to reach Fieldwork.');
      error.code = result.error?.code;
      error.details = result.error?.details;
      throw error;
    }
    if (result.revision !== undefined) this.revision = result.revision;
    return result;
  },
  async workspace() {
    return (await this.request('/api/v1/workspace')).data;
  },
  async command(name, args) {
    return (
      await this.request(`/api/v1/commands/${name}`, {
        method: 'POST',
        headers: { 'If-Match': String(this.revision), 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify(args),
      })
    ).data;
  },
};
export async function connect() {
  const status = await api.request('/auth/status');
  if (!status.signedIn) {
    if (status.mode === 'local') await api.request('/auth/local', { method: 'POST', body: '{}' });
    else await login();
  }
  let data = await api.workspace();
  let migrated = false,
    migrationError = '';
  if (!data.people.length && !data.companies.length && !data.research.length) {
    let previous;
    try {
      previous = JSON.parse(localStorage.getItem('fieldwork.crm.v1'));
    } catch {}
    if (previous) {
      try {
        data = (
          await api.request('/api/v1/workspace/import', {
            method: 'POST',
            headers: { 'If-Match': String(api.revision) },
            body: JSON.stringify(previous),
          })
        ).data;
        migrated = true;
      } catch (error) {
        migrationError = error.message;
      }
    }
  }
  return { data, migrated, migrationError, mode: status.mode };
}
async function login() {
  const main = document.querySelector('main'),
    sidebar = document.querySelector('.sidebar');
  main.hidden = true;
  sidebar.hidden = true;
  const panel = document.createElement('section');
  panel.className = 'login-panel';
  panel.innerHTML =
    '<div class="brand"><span class="brand-mark">f.</span> Fieldwork</div><h1>Welcome back</h1><p>Sign in to your professional workspace.</p><form><label for="login-password">Password</label><input id="login-password" type="password" autocomplete="current-password" required><p id="login-error" role="alert"></p><button class="primary">Sign in</button></form>';
  document.body.append(panel);
  await new Promise((resolve) => {
    panel.querySelector('form').onsubmit = async (event) => {
      event.preventDefault();
      const button = panel.querySelector('button');
      button.disabled = true;
      try {
        await api.request('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ password: panel.querySelector('input').value }),
        });
        resolve();
      } catch (error) {
        panel.querySelector('#login-error').textContent = error.message;
      } finally {
        button.disabled = false;
      }
    };
  });
  panel.remove();
  main.hidden = false;
  sidebar.hidden = false;
}

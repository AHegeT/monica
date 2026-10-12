import { api } from './api.js';
export function createManagement({ getData, escape, command, toast, modal, closeModal, render, showPerson }) {
  const $ = (selector) => document.querySelector(selector);
  let access = null;
  const companyById = (id) => getData().companies.find((c) => c.id === id);
  const link = (l) =>
    `<a class="source-link" href="${escape(l.url)}" target="_blank" rel="noopener noreferrer">${escape(l.label)} ↗</a>`;
  const run = async (action) => {
    try {
      await action();
    } catch (error) {
      toast(error.message);
    }
  };
  function companies() {
    return `<div class="sequence-grid">${
      getData()
        .companies.filter((c) => !c.archived)
        .map(
          (c) =>
            `<article class="sequence-card"><span class="chip">COMPANY</span><h2>${escape(c.name)}</h2><p>${escape(c.context || 'Add context about this organization.')}</p><div class="sequence-bottom"><span>${getData().people.filter((p) => p.companyId === c.id).length} people</span><button data-company="${escape(c.id)}">Open company</button></div></article>`,
        )
        .join('') || '<div class="empty">Add a company to research, keep notes, and connect its people.</div>'
    }</div>`;
  }
  function editCompany(id) {
    const c = companyById(id) || { name: '', website: '', context: '' };
    modal(
      id ? 'Edit company' : 'Add a company',
      `<form id="company-form"><div class="modal-body"><label for="company-name">Company name</label><input id="company-name" name="name" required value="${escape(c.name)}"><label for="company-website" style="margin-top:15px">Website</label><input id="company-website" type="url" name="website" value="${escape(c.website)}" placeholder="https://…"><label for="company-context" style="margin-top:15px">Context</label><textarea id="company-context" name="context">${escape(c.context)}</textarea></div><div class="modal-footer"><button type="button" data-close>Cancel</button><button class="primary">Save company</button></div></form>`,
    );
    $('#company-form').onsubmit = (event) => {
      event.preventDefault();
      run(async () => {
        const fields = Object.fromEntries(new FormData(event.target));
        const result = await command(
          id ? 'update_company' : 'create_company',
          id ? { ...fields, id, expectedVersion: c.version } : fields,
        );
        companyDetail(result.id);
        toast('Company saved');
      });
    };
  }
  function companyDetail(id) {
    const c = companyById(id);
    modal(
      'Company workspace',
      `<div class="modal-body"><div class="split"><h2>${escape(c.name)}</h2><button data-edit-company="${escape(id)}">Edit company</button></div><p>${escape(c.context)}</p>${c.website ? link({ url: c.website, label: 'Company website' }) : ''}<div class="profile-links">${(c.links || []).map(link).join('')}</div><div class="detail-section"><h3>People at this company</h3>${
        getData()
          .people.filter((p) => p.companyId === id)
          .map(
            (p) =>
              `<div><button class="text-button" data-person="${escape(p.id)}">${escape(p.name)} ↗</button><span class="person-role"> ${escape(p.role)}${!p.stage ? ' · In research' : ''}</span></div>`,
          )
          .join('') || '<p>No contacts yet. Add a person with this company name, or explore a contact in Research.</p>'
      }</div><div class="detail-section"><h3>Company notes</h3><form id="company-note"><label for="company-note-text">Add a note</label><textarea id="company-note-text" required></textarea><button>Save note</button></form>${(c.notes || []).map((n) => `<div class="note"><small>${escape(n.actor || 'Owner')} · ${escape(n.date)}</small>${escape(n.text)}</div>`).join('')}</div><div class="detail-section"><h3>Profile links</h3><form id="company-link"><label for="company-link-url">Add a profile or website</label><input id="company-link-url" type="url" required placeholder="https://…"><button style="margin-top:10px">Add link</button></form></div></div>`,
    );
    $('#company-note').onsubmit = (event) => {
      event.preventDefault();
      run(async () => {
        await command('add_note', { collection: 'companies', id, text: $('#company-note-text').value });
        companyDetail(id);
      });
    };
    $('#company-link').onsubmit = (event) => {
      event.preventDefault();
      run(async () => {
        await command('add_profile_link', { collection: 'companies', id, url: $('#company-link-url').value });
        companyDetail(id);
      });
    };
  }
  async function loadAccess() {
    const [tokens, audit] = await Promise.all([api.request('/api/v1/tokens'), api.request('/api/v1/audit')]);
    access = { tokens: tokens.data, audit: audit.data };
  }
  function agentAccess() {
    if (!access) {
      loadAccess()
        .then(render)
        .catch((e) => toast(e.message));
      return '<div class="empty">Loading agent access…</div>';
    }
    return `<div class="research-overview"><div><span class="eyebrow">ONE WORKSPACE, MANY INTERFACES</span><h2>Your agent can work here, too</h2><p>Connect Hermes or another MCP client to the same records and workflows.</p></div><a class="source-link" href="/api/v1/openapi.json" target="_blank">API specification ↗</a></div><div class="sequence-grid"><article class="sequence-card"><h2>Agent credentials</h2><p>Create a dedicated credential for each agent. The token is shown once.</p><form id="token-form"><label for="agent-name">Agent name</label><input id="agent-name" name="name" required placeholder="Hermes"><label for="agent-scope" style="margin-top:15px">Permissions</label><select id="agent-scope"><option value="write">Read and update records</option><option value="read">Read only</option></select><button class="primary" style="margin-top:15px">Create credential</button></form><div class="detail-section">${access.tokens.map((t) => `<div class="split note"><div>${escape(t.name)}<small>${t.revoked ? 'Revoked' : escape(t.scopes.join(', '))}</small></div>${t.revoked ? '' : `<button class="danger" data-revoke-token="${escape(t.id)}">Revoke</button>`}</div>`).join('') || '<p>No agent credentials yet.</p>'}</div></article><article class="sequence-card"><h2>Connect through MCP</h2><p>Run the included MCP adapter on the machine running Hermes. It authenticates to this app using the agent token.</p><pre class="code-block">mcp_servers:\n  fieldwork:\n    command: node\n    args:\n      - /absolute/path/apps/fieldwork/server/mcp.js\n    env:\n      FIELDWORK_API_URL: http://localhost:4178\n      FIELDWORK_API_TOKEN: YOUR_AGENT_TOKEN</pre><p>Core tools create and update records, move stages, post findings, and manage next actions. Research jobs can be queued and claimed by an external agent.</p></article></div><div class="detail-section"><div class="split"><h2>Recent activity</h2><button id="refresh-access">Refresh activity</button></div><div class="table-wrap"><table><thead><tr><th>ACTOR</th><th>OPERATION</th><th>WHEN</th></tr></thead><tbody>${access.audit.map((e) => `<tr><td>${escape(e.actor)}</td><td>${escape(e.operation.replaceAll('_', ' '))}</td><td>${escape(new Date(e.createdAt).toLocaleString())}</td></tr>`).join('')}</tbody></table></div></div>${!getData().people.length && !getData().companies.length && !getData().research.length ? '<div class="detail-section"><h2>Import workspace</h2><p>Import a Fieldwork JSON export into this empty workspace.</p><form id="import-workspace-form"><label for="import-workspace-file">Workspace JSON file</label><input id="import-workspace-file" type="file" accept=".json,application/json" required><button class="primary" style="margin-top:12px">Import workspace</button></form></div>' : ''}<div class="notice">Research jobs wait for an external agent to execute them. The app does not browse on its own or send outreach messages.</div>`;
  }
  function bindAccess() {
    const importForm = $('#import-workspace-form');
    if (importForm)
      importForm.onsubmit = (event) => {
        event.preventDefault();
        run(async () => {
          const file = $('#import-workspace-file').files[0];
          if (!file || file.size > 5 * 1024 * 1024) throw Error('Choose a JSON export smaller than 5 MB.');
          const snapshot = JSON.parse(await file.text());
          await api.request('/api/v1/workspace/import', {
            method: 'POST',
            headers: { 'If-Match': String(api.revision) },
            body: JSON.stringify(snapshot),
          });
          location.reload();
        });
      };
    const form = $('#token-form');
    if (!form) return;
    form.onsubmit = (event) => {
      event.preventDefault();
      run(async () => {
        const input = {
          name: $('#agent-name').value,
          scopes: $('#agent-scope').value === 'read' ? ['read'] : ['read', 'write'],
        };
        const result = await api.request('/api/v1/tokens', { method: 'POST', body: JSON.stringify(input) });
        await loadAccess();
        render();
        modal(
          'Save your agent credential',
          `<div class="modal-body"><p>This credential is shown once. Store it in your agent's private environment configuration.</p><label for="new-token">Agent token</label><input id="new-token" type="password" readonly value="${escape(result.data.token)}"><button id="copy-token" style="margin-top:12px">Copy token</button><p>Closing this dialog hides the token. You can revoke it and create another from Agent access.</p></div><div class="modal-footer"><button data-close>Done</button></div>`,
        );
        $('#copy-token').onclick = () =>
          navigator.clipboard
            .writeText(result.data.token)
            .then(() => toast('Token copied'))
            .catch(() => toast('Select the token field and copy it manually.'));
      });
    };
  }
  document.addEventListener('click', (event) => {
    const b = event.target.closest('button');
    if (!b) return;
    if (b.id === 'add-company') editCompany();
    if (b.dataset.company) companyDetail(b.dataset.company);
    if (b.dataset.editCompany) editCompany(b.dataset.editCompany);
    if (b.id === 'refresh-access')
      run(async () => {
        await loadAccess();
        render();
      });
    if (b.dataset.revokeToken)
      run(async () => {
        await api.request(`/api/v1/tokens/${b.dataset.revokeToken}/revoke`, { method: 'POST', body: '{}' });
        await loadAccess();
        render();
        toast('Credential revoked');
      });
  });
  return { companies, agentAccess, bindAccess };
}

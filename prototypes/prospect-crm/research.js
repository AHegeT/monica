import { researchStatuses, findingTypes, putResearch, putTarget, addFinding, promoteTarget } from './research-model.js';

export function sampleResearch(date) {
  return [
    {
      id: 'r-studios',
      title: 'Independent studios',
      question: 'Which small studios might benefit from a conversation about growth?',
      status: 'Exploring',
      createdAt: date,
      updatedAt: date,
      targets: [
        {
          id: 'rt-lumen',
          kind: 'Company',
          name: 'Lumen Studio',
          company: '',
          role: '',
          context: 'Look into their current priorities and who leads the business.',
          links: [{ label: 'Sample website', url: 'https://example.com/lumen' }],
          personId: null,
        },
        {
          id: 'rt-sofia',
          kind: 'Person',
          name: 'Sofia Rivera',
          company: 'Lumen Studio',
          role: 'Founder',
          context: 'Understand what the founder is focused on this quarter.',
          links: [{ label: 'Sample profile', url: 'https://example.com/sofia' }],
          personId: 'p1',
        },
      ],
      findings: [
        {
          id: 'rf-1',
          text: 'What would make this conversation useful for Sofia?',
          kind: 'Question',
          targetId: 'rt-sofia',
          sourceUrl: '',
          author: 'You',
          createdAt: date,
        },
      ],
    },
    {
      id: 'r-ops',
      title: 'Teams in transition',
      question: 'Explore companies changing the way they work and identify relevant people.',
      status: 'Waiting',
      createdAt: date,
      updatedAt: date,
      targets: [
        {
          id: 'rt-north',
          kind: 'Company',
          name: 'Northstar',
          company: '',
          role: '',
          context: 'Explore how the operations team is organized.',
          links: [],
          personId: null,
        },
      ],
      findings: [],
    },
    {
      id: 'r-independent',
      title: 'Independent consultants',
      question: 'Learn who works with early-stage teams and what they need.',
      status: 'Ready',
      createdAt: date,
      updatedAt: date,
      targets: [
        {
          id: 'rt-julian',
          kind: 'Person',
          name: 'Julian Vega',
          company: '',
          role: 'Consultant',
          context: 'Potential introduction through a mutual contact.',
          links: [],
          personId: null,
        },
      ],
      findings: [
        {
          id: 'rf-2',
          text: 'There may be a useful exchange of introductions here. Validate in a first conversation.',
          kind: 'Hypothesis',
          targetId: 'rt-julian',
          sourceUrl: '',
          author: 'You',
          createdAt: date,
        },
      ],
    },
  ];
}
export function createResearchFeature({
  getData,
  escape,
  day,
  dateLabel,
  uid,
  save,
  toast,
  modal,
  closeModal,
  showPerson,
}) {
  const $ = (selector) => document.querySelector(selector);
  let query = '',
    status = 'All investigations';
  const researchById = (id) => getData().research.find((r) => r.id === id);
  const options = (items, selected) =>
    items.map((item) => `<option ${selected === item ? 'selected' : ''}>${escape(item)}</option>`).join('');
  const linksHtml = (links) =>
    links
      .map(
        (link) =>
          `<a class="source-link" href="${escape(link.url)}" target="_blank" rel="noopener noreferrer">${escape(link.label)} ↗</a>`,
      )
      .join('');
  const run = (action) => {
    try {
      action();
    } catch (error) {
      toast(error.message);
    }
  };
  function render() {
    const all = getData().research,
      items = all.filter(
        (r) =>
          (status === 'All investigations' || r.status === status) &&
          `${r.title} ${r.question} ${r.targets.map((t) => `${t.name} ${t.company}`).join(' ')}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      );
    const active = all.filter((r) => r.status !== 'Archived');
    return `<div class="research-overview"><div><span class="eyebrow">ROOM FOR CURIOSITY</span><h2>${active.length} investigations in progress</h2><p>Explore a company, follow a person, or gather a whole market in one place.</p></div><div class="research-totals"><strong>${all.reduce((count, r) => count + r.targets.length, 0)}</strong><span>people & companies</span><strong>${all.reduce((count, r) => count + r.findings.length, 0)}</strong><span>findings collected</span></div></div><div class="toolbar"><input id="research-search" class="search" aria-label="Search research" placeholder="Search investigations or subjects…" value="${escape(query)}"><select id="research-filter" aria-label="Filter research status">${options(['All investigations', ...researchStatuses], status)}</select></div><div class="research-grid">${
      items
        .map(
          (r) =>
            `<article class="research-card"><div class="split"><span class="chip ${r.status === 'Waiting' ? 'gold' : r.status === 'Ready' ? 'blue' : ''}">${escape(r.status)}</span><span class="person-role">Updated ${dateLabel(r.updatedAt)}</span></div><button class="research-title" data-research="${escape(r.id)}">${escape(r.title)} ↗</button><p>${escape(r.question)}</p><div class="research-subjects">${
              r.targets
                .slice(0, 3)
                .map((t) => `<span>${t.kind === 'Company' ? '▤' : '♧'} ${escape(t.name)}</span>`)
                .join('') || '<span>Add your first person or company</span>'
            }${r.targets.length > 3 ? `<span>＋ ${r.targets.length - 3} more</span>` : ''}</div><div class="sequence-bottom"><span>${r.targets.length} subjects · ${r.findings.length} findings</span><button data-research="${escape(r.id)}">Open research</button></div></article>`,
        )
        .join('') ||
      '<div class="empty">No investigations here yet. Start a research to gather people, companies, links, and findings.</div>'
    }</div><p class="hint">Sample research is fictional; example.com links are placeholders. Subjects can stay here while you decide whether to approach them.</p>`;
  }
  function edit(id) {
    const r = researchById(id) || { title: '', question: '', status: 'Exploring' };
    modal(
      id ? 'Edit research' : 'Start a research',
      `<form id="research-form"><div class="modal-body"><label for="research-title">Research title</label><input id="research-title" name="title" required maxlength="120" value="${escape(r.title)}" placeholder="Independent studios in Mexico City"><label for="research-question" style="margin-top:16px">What are you exploring?</label><textarea id="research-question" name="question" required placeholder="What would you like to find out?">${escape(r.question)}</textarea><label for="research-status" style="margin-top:16px">Status</label><select id="research-status" name="status">${options(researchStatuses, r.status)}</select></div><div class="modal-footer"><button type="button" data-close>Cancel</button><button class="primary">Save research</button></div></form>`,
    );
    $('#research-form').onsubmit = (event) => {
      event.preventDefault();
      run(() => {
        const r = putResearch(getData(), Object.fromEntries(new FormData(event.target)), id, uid, day());
        save();
        detail(r.id);
        toast('Research saved');
      });
    };
  }
  function detail(id) {
    const r = researchById(id);
    if (!r) return;
    modal(
      'Research workspace',
      `<div class="modal-body"><div class="split"><span class="chip">${escape(r.status)}</span><button data-edit-research="${escape(id)}">Edit research</button></div><h2>${escape(r.title)}</h2><p>${escape(r.question)}</p><div class="detail-section"><div class="split"><h3>People & companies <span class="chip">${r.targets.length}</span></h3><button data-add-target="${escape(id)}">＋ Add subject</button></div>${r.targets.map((t) => `<article class="research-target"><div class="split"><div><span class="chip">${t.kind}</span><strong>${escape(t.name)}</strong><small>${escape([t.role, t.company].filter(Boolean).join(' · '))}</small></div><button class="text-button" data-edit-target="${escape(t.id)}" data-research-id="${escape(id)}">Edit</button></div><p>${escape(t.context)}</p><div class="profile-links">${linksHtml(t.links)}</div><div class="detail-actions">${t.kind === 'Person' ? (t.personId ? `<button data-person="${escape(t.personId)}">Open CRM profile ↗</button>` : `<button data-promote-target="${escape(t.id)}" data-research-id="${escape(id)}">Add to pipeline</button>`) : `<button data-company-contact="${escape(t.id)}" data-research-id="${escape(id)}">＋ Research a contact here</button>`}</div></article>`).join('') || '<p>Add a person or company without committing them to the pipeline.</p>'}</div><div class="detail-section"><h3>Findings <span class="chip">${r.findings.length}</span></h3><form id="finding-form"><label for="finding-text">What did you learn?</label><textarea id="finding-text" name="text" required placeholder="Capture an observation, a hypothesis, or an open question…"></textarea><div class="form-grid" style="margin-top:12px"><div><label for="finding-kind">Type</label><select id="finding-kind" name="kind">${options(findingTypes, 'Observation')}</select></div><div><label for="finding-target">About</label><select id="finding-target" name="targetId"><option value="">The investigation</option>${r.targets.map((t) => `<option value="${escape(t.id)}">${escape(t.name)}</option>`).join('')}</select></div><div class="full"><label for="finding-source">Source link (optional)</label><input id="finding-source" name="sourceUrl" type="url" placeholder="https://…"></div></div><button style="margin-top:12px">Add finding</button></form>${r.findings.map((f) => `<article class="note research-finding"><div class="split"><span class="chip ${f.kind === 'Hypothesis' ? 'gold' : f.kind === 'Question' ? 'blue' : ''}">${escape(f.kind)}</span><small>${escape(f.author)} · ${dateLabel(f.createdAt)}</small></div>${f.targetId ? `<small>About ${escape(r.targets.find((t) => t.id === f.targetId)?.name || 'subject')}</small>` : ''}<div>${escape(f.text)}</div>${f.sourceUrl ? `<a class="source-link" href="${escape(f.sourceUrl)}" target="_blank" rel="noopener noreferrer">View source ↗</a>` : ''}</article>`).join('')}</div></div>`,
    );
    $('#finding-form').onsubmit = (event) => {
      event.preventDefault();
      run(() => {
        addFinding(getData(), id, Object.fromEntries(new FormData(event.target)), uid, day());
        save();
        detail(id);
        toast('Finding added');
      });
    };
  }
  function editTarget(researchId, id, company = '') {
    const r = researchById(researchId),
      t = r.targets.find((t) => t.id === id) || {
        kind: 'Person',
        name: '',
        role: '',
        company,
        context: '',
        links: [],
        personId: null,
      };
    modal(
      id ? 'Edit research subject' : 'Add a research subject',
      `<form id="target-form"><div class="modal-body form-grid"><div><label for="target-kind">Subject type</label><select id="target-kind" name="kind">${options(['Person', 'Company'], t.kind)}</select></div><div><label for="target-name">Name</label><input id="target-name" name="name" required value="${escape(t.name)}"></div><div><label for="target-role">Role (for people)</label><input id="target-role" name="role" value="${escape(t.role)}"></div><div><label for="target-company">Company (for people)</label><input id="target-company" name="company" value="${escape(t.company)}"></div><div class="full"><label for="target-context">Why are you exploring them?</label><textarea id="target-context" name="context">${escape(t.context)}</textarea></div><div class="full"><label for="target-links">Profile & website links — one URL per line</label><textarea id="target-links" name="links" placeholder="https://www.linkedin.com/in/…&#10;https://company.com">${escape(t.links.map((link) => link.url).join('\n'))}</textarea></div><div class="full"><label for="target-person">Link to an existing CRM person (optional)</label><select id="target-person" name="personId"><option value="">Keep as a research subject</option>${getData()
        .people.map(
          (p) =>
            `<option value="${escape(p.id)}" ${t.personId === p.id ? 'selected' : ''}>${escape(p.name)}${p.company ? ` · ${escape(p.company)}` : ''}</option>`,
        )
        .join(
          '',
        )}</select></div></div><div class="modal-footer"><button type="button" data-back-research="${escape(researchId)}">Back</button><button class="primary">Save subject</button></div></form>`,
    );
    const kindChange = () => {
      const isCompany = $('#target-kind').value === 'Company';
      $('#target-person').disabled = isCompany;
      if (isCompany) $('#target-person').value = '';
    };
    $('#target-kind').onchange = kindChange;
    kindChange();
    $('#target-form').onsubmit = (event) => {
      event.preventDefault();
      run(() => {
        putTarget(getData(), researchId, Object.fromEntries(new FormData(event.target)), id, uid, day());
        save();
        detail(researchId);
        toast('Research subject saved');
      });
    };
  }
  function personLinks(personId) {
    const matches = getData().research.filter((r) => r.targets.some((t) => t.personId === personId));
    return matches.length
      ? `<div class="detail-section"><h3>Research context</h3>${matches.map((r) => `<button class="text-button" data-research="${escape(r.id)}">${escape(r.title)} ↗</button><div class="profile-links">${linksHtml(r.targets.filter((t) => t.personId === personId).flatMap((t) => t.links))}</div>`).join('')}</div>`
      : '';
  }
  document.addEventListener('click', (event) => {
    const b = event.target.closest('button');
    if (!b) return;
    if (b.id === 'add-research') edit();
    if (b.dataset.research) detail(b.dataset.research);
    if (b.dataset.editResearch) edit(b.dataset.editResearch);
    if (b.dataset.addTarget) editTarget(b.dataset.addTarget);
    if (b.dataset.editTarget) editTarget(b.dataset.researchId, b.dataset.editTarget);
    if (b.dataset.backResearch) detail(b.dataset.backResearch);
    if (b.dataset.companyContact) {
      const target = researchById(b.dataset.researchId).targets.find((t) => t.id === b.dataset.companyContact);
      editTarget(b.dataset.researchId, null, target.name);
    }
    if (b.dataset.promoteTarget)
      run(() => {
        const p = promoteTarget(getData(), b.dataset.researchId, b.dataset.promoteTarget, uid, day());
        save();
        showPerson(p.id);
        toast('Person added to the pipeline · research retained');
      });
  });
  function bind() {
    $('#research-search').oninput = (event) => {
      const pos = event.target.selectionStart;
      query = event.target.value;
      $('#content').innerHTML = render();
      bind();
      $('#research-search').focus();
      $('#research-search').setSelectionRange(pos, pos);
    };
    $('#research-filter').onchange = (event) => {
      status = event.target.value;
      $('#content').innerHTML = render();
      bind();
    };
  }
  return { render, bind, personLinks };
}

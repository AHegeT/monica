import { createResearchFeature } from './research.js';
import { api, connect } from './api.js';
import { createManagement } from './manage.js';

const $ = (selector) => document.querySelector(selector);
const escape = (value = '') =>
  String(value).replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  );
const uid = () => crypto.randomUUID();
const day = (offset = 0) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: data.timezone || 'America/Mexico_City',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  );
  const date = new Date(`${parts.year}-${parts.month}-${parts.day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
};
const dateLabel = (value) => {
  if (!value) return 'No date';
  let date = String(value).slice(0, 10);
  if (String(value).includes('T')) {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-CA', { timeZone: data.timezone, year: 'numeric', month: '2-digit', day: '2-digit' })
        .formatToParts(new Date(value))
        .map((p) => [p.type, p.value]),
    );
    date = `${parts.year}-${parts.month}-${parts.day}`;
  }
  return date === day()
    ? 'Today'
    : date === day(1)
      ? 'Tomorrow'
      : new Date(`${date}T12:00:00Z`).toLocaleDateString(undefined, {
          timeZone: 'UTC',
          month: 'short',
          day: 'numeric',
        });
};
const initials = (name) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
const colors = ['#dfe8d6', '#e8dfd2', '#dae6ea', '#e9dfe8', '#e5e7d4'];
const avatar = (person) =>
  `<span class="avatar" style="background:${colors[person.color % colors.length]}">${escape(initials(person.name))}</span>`;
const initial = await connect();
let data = initial.data;
let view = ['pipeline', 'people', 'today', 'sequences', 'research', 'companies', 'access'].includes(
  location.hash.slice(1),
)
  ? location.hash.slice(1)
  : 'pipeline';
let search = '',
  typeFilter = 'All people',
  taskFilter = 'due';
const openTasks = () =>
  data.tasks.filter((task) => task.status === 'open' && !data.people.find((p) => p.id === task.personId)?.archived);
const personTasks = (id) =>
  openTasks()
    .filter((task) => task.personId === id)
    .sort((a, b) => a.due.localeCompare(b.due));
const personById = (id) => data.people.find((person) => person.id === id);
const stageById = (id) => data.stages.find((stage) => stage.id === id);
const sequenceById = (id) => data.sequences.find((sequence) => sequence.id === id);
let saving = false;
async function command(name, args) {
  if (saving) throw new Error('An update is in progress. Please wait a moment.');
  saving = true;
  document.body.classList.add('saving');
  try {
    const result = await api.command(name, args);
    data = await api.workspace();
    render();
    return result;
  } catch (error) {
    if (error.code === 'version_conflict') {
      data = await api.workspace();
      render();
    }
    throw error;
  } finally {
    saving = false;
    document.body.classList.remove('saving');
  }
}
let toastTimer;
function toast(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 4000);
}
const peopleFiltered = () =>
  data.people.filter(
    (person) =>
      (typeFilter === 'Archived'
        ? person.archived
        : !person.archived && (typeFilter === 'All people' || person.type === typeFilter)) &&
      `${person.name} ${person.company} ${person.role} ${person.context}`.toLowerCase().includes(search.toLowerCase()),
  );
const stageOptions = (selected) =>
  data.stages
    .map(
      (stage) =>
        `<option value="${escape(stage.id)}" ${stage.id === selected ? 'selected' : ''}>${escape(stage.name)}</option>`,
    )
    .join('');
const channels = ['Email', 'LinkedIn', 'Call', 'Meeting', 'Research', 'Other'];
const channelOptions = (selected) =>
  channels.map((channel) => `<option ${channel === selected ? 'selected' : ''}>${channel}</option>`).join('');
const researchFeature = createResearchFeature({
  getData: () => data,
  escape,
  day,
  dateLabel,
  uid,
  command,
  toast,
  modal,
  closeModal: () => closeModal(),
  showPerson: detail,
});

const management = createManagement({
  getData: () => data,
  escape,
  command,
  toast,
  modal,
  closeModal: () => closeModal(),
  render,
  showPerson: detail,
});

const headerCopy = {
  companies: ['Companies, with context', 'Explore organizations and the people who make them work.'],
  access: ['Agent access', 'One shared workspace for you and your agents.'],
  research: ['Follow your curiosity', 'People, companies, and the questions worth exploring.'],
  pipeline: ['Your pipeline', 'A little context. A clear next step. Keep your conversations moving.'],
  today: ['Your next actions', 'Make room for the relationships that need your attention.'],
  people: ['People, with context', 'Remember who they are, what matters, and where you left off.'],
  sequences: ['A rhythm for reaching out', 'Build a repeatable flow, with space for a real conversation.'],
};
function stats() {
  const items = [
    ['People in your workspace', data.people.length, 'Individuals and company contacts'],
    ['In conversation', data.people.filter((p) => p.stage === 'conversation').length, 'Relationships gaining momentum'],
    ['Actions due', openTasks().filter((t) => t.due <= day()).length, 'Your next opportunities to connect'],
    [
      'Active sequences',
      data.people.filter((p) => p.enrollment?.status === 'active').length,
      'A clear path to the next touchpoint',
    ],
  ];
  return `<div class="stats">${items.map(([label, value, note]) => `<div class="stat"><span class="stat-label">${label}</span><strong>${value}</strong><small>${note}</small></div>`).join('')}</div>`;
}
function peopleToolbar(extra = '') {
  return `<div class="toolbar"><input class="search" id="search" aria-label="Search people" placeholder="Search people or companies…" value="${escape(search)}"><div class="toolbar-right"><select id="type-filter" aria-label="Filter relationship type">${['All people', 'Prospect', 'Client', 'Colleague', 'Mentor', 'Recruiter', 'Archived'].map((type) => `<option ${type === typeFilter ? 'selected' : ''}>${type}</option>`).join('')}</select>${extra}</div></div>`;
}
function prospectCard(person) {
  const task = personTasks(person.id)[0];
  const enrollment = person.enrollment;
  return `<button class="prospect-card" draggable="true" data-person="${escape(person.id)}"><div class="person-row">${avatar(person)}<div><div class="person-name">${escape(person.name)}</div><div class="person-role">${escape(person.role || person.type)}${person.company ? ` · ${escape(person.company)}` : ''}</div></div></div><div class="card-context">${escape(person.context || 'Add a little context to start the conversation.')}</div><span class="chip">${escape(person.type)}</span>${enrollment ? `<span class="chip ${enrollment.status === 'paused' ? 'gold' : 'blue'}">${enrollment.status === 'active' ? 'In sequence' : enrollment.status === 'paused' ? 'Sequence paused' : 'Sequence complete'}</span>` : ''}<div class="card-task"><span>${task ? escape(task.title) : '＋ Set a next action'}</span><span class="${task && task.due <= day() ? 'due' : ''}">${task ? dateLabel(task.due) : ''}</span></div></button>`;
}
function render() {
  const [title, description] = headerCopy[view];
  $('#page-title').textContent = title;
  $('#page-description').textContent = description;
  $('#breadcrumb').textContent = {
    pipeline: 'Pipeline',
    people: 'People',
    today: 'Next actions',
    sequences: 'Sequences',
    research: 'Research',
    companies: 'Companies',
    access: 'Agent access',
  }[view];
  document
    .querySelectorAll('[data-view]')
    .forEach((button) => button.classList.toggle('active', button.dataset.view === view));
  $('#due-count').textContent = openTasks().filter((task) => task.due <= day()).length;
  const content = $('#content');
  const headingAction = document.querySelector('.page-heading > button');
  headingAction.id = view === 'research' ? 'add-research' : view === 'companies' ? 'add-company' : 'add-person';
  headingAction.hidden = view === 'access';
  headingAction.textContent =
    view === 'research' ? '＋ Start research' : view === 'companies' ? '＋ Add company' : '＋ Add prospect';
  if (view === 'companies') content.innerHTML = management.companies();
  if (view === 'access') {
    content.innerHTML = management.agentAccess();
    management.bindAccess();
  }
  if (view === 'research') {
    content.innerHTML = researchFeature.render();
    researchFeature.bind();
  }
  if (view === 'pipeline')
    content.innerHTML =
      stats() +
      peopleToolbar('<button id="edit-stages">Edit stages</button>') +
      `<div class="board">${data.stages
        .map((stage) => {
          const people = peopleFiltered().filter((person) => person.stage === stage.id);
          return `<section class="column" data-stage="${escape(stage.id)}" aria-label="${escape(stage.name)}"><div class="column-heading"><span class="stage-label"><span class="dot" style="--stage-color:${stage.color}"></span>${escape(stage.name)}</span><span class="count">${people.length}</span></div>${people.map(prospectCard).join('') || '<div class="empty-column">Room for the next conversation.</div>'}</section>`;
        })
        .join(
          '',
        )}</div><p class="hint">Drag a person into another stage, or open their profile to change it. These stages are a starting point; edit them as your process takes shape.</p>`;
  if (view === 'people')
    content.innerHTML =
      peopleToolbar() +
      `<div class="table-wrap"><table><thead><tr><th>PERSON</th><th>COMPANY</th><th>RELATIONSHIP</th><th>STAGE</th><th>NEXT ACTION</th></tr></thead><tbody>${peopleFiltered()
        .map((person) => {
          const task = personTasks(person.id)[0];
          return `<tr><td><button class="person-link" data-person="${escape(person.id)}"><div class="person-row">${avatar(person)}<div class="person-name">${escape(person.name)}<div class="person-role">${escape(person.role)}</div></div></div></button></td><td>${escape(person.company || 'Individual')}</td><td><span class="chip">${escape(person.type)}</span></td><td>${escape(stageById(person.stage)?.name || 'In research')}</td><td>${task ? `${escape(task.title)} <span class="person-role">· ${dateLabel(task.due)}</span>` : '—'}</td></tr>`;
        })
        .join(
          '',
        )}</tbody></table></div>${peopleFiltered().length ? '' : '<div class="empty">No people match your search.</div>'}`;
  if (view === 'sequences')
    content.innerHTML = `<div class="toolbar"><span class="hint">A sequence creates one next action at a time.</span><button id="add-sequence">＋ New sequence</button></div><div class="sequence-grid">${data.sequences.map((sequence) => `<article class="sequence-card"><div class="sequence-top"><span class="chip">${sequence.steps.length} STEPS</span><button class="text-button" data-edit-sequence="${escape(sequence.id)}">Edit sequence ↗</button></div><h2>${escape(sequence.name)}</h2><p>${escape(sequence.description)}</p><ol class="step-list">${sequence.steps.map((step, index) => `<li><span class="step-number">${index + 1}</span><div class="step-copy">${escape(step.title)}<small>${escape(step.channel)} · ${step.delay === 0 ? 'Ready immediately' : `${step.delay} days ${index === 0 ? 'after enrollment' : 'after previous step'}`}</small></div></li>`).join('')}</ol><div class="sequence-bottom"><span>${data.people.filter((person) => person.enrollment?.sequenceId === sequence.id && person.enrollment.status === 'active').length} active people</span><button data-enroll-picker="${escape(sequence.id)}">Enroll a person</button></div></article>`).join('')}</div><div class="notice">Sequence steps are manual tasks. Recording a reply pauses the sequence. Completing a step schedules the next one; no messages are sent.</div>`;
  if (view === 'today') {
    const tasks = openTasks()
      .filter((task) => taskFilter === 'all' || task.due <= day())
      .sort((a, b) => a.due.localeCompare(b.due));
    content.innerHTML =
      stats() +
      `<div class="section-line"><h2>${taskFilter === 'all' ? 'Upcoming & due' : 'Ready for your attention'} <span class="chip">${tasks.length}</span></h2><button id="toggle-tasks">${taskFilter === 'all' ? 'Show due actions' : 'Show all actions'}</button></div><div class="action-list">${
        tasks
          .map((task) => {
            const person = personById(task.personId);
            if (!person) return '';
            return `<article class="action-card">${avatar(person)}<div class="action-body"><h3>${escape(task.title)}</h3><p><button class="text-button" data-person="${escape(person.id)}">${escape(person.name)}</button>${person.company ? ` · ${escape(person.company)}` : ''} · ${escape(task.channel)} ${task.sequenceId ? '· Sequence step' : ''}</p></div><span class="chip ${task.due <= day() ? 'gold' : ''}">${dateLabel(task.due)}</span><div class="action-buttons"><button data-snooze="${escape(task.id)}">Tomorrow</button><button class="primary" data-complete="${escape(task.id)}">✓ Complete</button></div></article>`;
          })
          .join('') ||
        '<div class="empty">Nothing due. Add a prospect or enroll someone in a sequence to plan your next conversation.</div>'
      }</div>`;
  }
  bindBoard();
}
function bindBoard() {
  document
    .querySelectorAll('.prospect-card')
    .forEach((card) =>
      card.addEventListener('dragstart', (event) => event.dataTransfer.setData('text/plain', card.dataset.person)),
    );
  document.querySelectorAll('.column').forEach((column) => {
    column.addEventListener('dragover', (event) => {
      event.preventDefault();
      column.classList.add('drag-over');
    });
    column.addEventListener('dragleave', () => column.classList.remove('drag-over'));
    column.addEventListener('drop', (event) => {
      event.preventDefault();
      const person = personById(event.dataTransfer.getData('text/plain'));
      if (person) moveStage(person, column.dataset.stage);
    });
  });
}
async function moveStage(person, stage) {
  if (person.stage === stage) return;
  await command('move_pipeline_item', { id: person.id, stageId: stage, expectedVersion: person.version });
  toast('Pipeline updated');
}
function modal(title, body, footer = '') {
  $('#editor-content').innerHTML =
    `<div class="modal-header"><h2 id="dialog-title">${escape(title)}</h2><button class="close" data-close aria-label="Close dialog">×</button></div>${body}${footer}`;
  if (!$('#editor').open) $('#editor').showModal();
}
const closeModal = () => $('#editor').close();
function editPerson(id) {
  const person = personById(id) || {
    name: '',
    role: '',
    company: '',
    email: '',
    type: 'Prospect',
    stage: data.stages[0].id,
    context: '',
    personal: '',
  };
  modal(
    id ? 'Edit person' : 'Add a prospect',
    `<form id="person-form"><div class="modal-body form-grid"><div><label for="person-name">Name</label><input id="person-name" name="name" required maxlength="120" value="${escape(person.name)}"></div><div><label for="person-role">Role</label><input id="person-role" name="role" value="${escape(person.role)}" placeholder="Founder, consultant…"></div><div><label for="person-company">Company (optional)</label><input id="person-company" name="company" value="${escape(person.company)}" placeholder="Leave blank for an individual" list="companies"><datalist id="companies">${data.companies
      .filter((c) => !c.archived)
      .map((c) => c.name)
      .map((company) => `<option value="${escape(company)}">`)
      .join(
        '',
      )}</datalist></div><div><label for="person-email">Email (optional)</label><input id="person-email" name="email" type="email" value="${escape(person.email)}"></div><div><label for="person-type">Relationship</label><select id="person-type" name="type">${['Prospect', 'Client', 'Colleague', 'Mentor', 'Recruiter'].map((type) => `<option ${type === person.type ? 'selected' : ''}>${type}</option>`).join('')}</select></div><div><label for="person-stage">Pipeline stage</label><select id="person-stage" name="stage">${!person.stage ? '<option value="" selected disabled>In research — choose a stage</option>' : ''}${stageOptions(person.stage)}</select></div><div class="full"><label for="person-context">Professional context</label><textarea id="person-context" name="context" placeholder="How you met, what they are working on…">${escape(person.context)}</textarea></div><div class="full"><label for="person-personal">Personal details</label><textarea id="person-personal" name="personal" placeholder="A few things you want to remember…">${escape(person.personal)}</textarea></div></div><div class="modal-footer"><button type="button" data-close>Cancel</button><button class="primary" type="submit">${id ? 'Save changes' : 'Add prospect'}</button></div></form>`,
  );
  $('#person-form').onsubmit = async (event) => {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.target));
    fields.name = fields.name.trim();
    if (!fields.name) {
      toast('Please enter a name');
      return;
    }
    fields.company = fields.company.trim();
    await command(
      id ? 'update_person' : 'create_person',
      id ? { ...fields, id, expectedVersion: person.version } : fields,
    );
    closeModal();
    toast(id ? 'Person updated' : 'Prospect added');
  };
}
function detail(id) {
  const person = personById(id);
  if (!person) return;
  const tasks = personTasks(id),
    enrollment = person.enrollment;
  modal(
    'Person details',
    `<div class="modal-body"><div class="detail-title">${avatar(person)}<div><h2>${escape(person.name)}</h2><p>${escape([person.role, person.company].filter(Boolean).join(' · ') || 'Individual prospect')}</p></div></div><div class="split"><span class="chip">${escape(person.type)}</span><div class="detail-actions"><button data-edit-person="${escape(id)}">Edit profile</button><button data-archive-person="${escape(id)}">${person.archived ? 'Restore' : 'Archive'}</button></div></div><p>${escape(person.context || 'No professional context added yet.')}</p>${person.email ? `<p>${escape(person.email)}</p>` : ''}<label for="detail-stage">Pipeline stage</label><select id="detail-stage">${!person.stage ? '<option value="" selected disabled>In research — choose a stage</option>' : ''}${stageOptions(person.stage)}</select>${researchFeature.personLinks(id)}<div class="detail-section"><h3>Profile links</h3><div class="profile-links">${(person.links || []).map((l) => `<a class="source-link" href="${escape(l.url)}" target="_blank" rel="noopener noreferrer">${escape(l.label)} ↗</a>`).join('')}</div><form id="person-link-form"><label for="person-link-url">Add a profile or website</label><input id="person-link-url" type="url" required placeholder="https://…"><button style="margin-top:8px">Add link</button></form></div><div class="detail-section"><h3>Personal details</h3><p>${escape(person.personal || 'Add details you want to remember in the profile.')}</p></div><div class="detail-section"><h3>Sequence</h3>${enrollment ? `<p>${escape(enrollment.name)} · <strong>${escape(enrollment.status)}</strong> · ${enrollment.status === 'completed' ? 'All steps finished' : `Step ${enrollment.index + 1} of ${enrollment.steps.length}`}</p><div class="detail-actions">${enrollment.status === 'active' ? `<button data-pause="${escape(id)}">Pause sequence</button><button data-reply="${escape(id)}">Record reply</button>` : enrollment.status === 'paused' ? `<button data-resume="${escape(id)}">Resume sequence</button>` : ''}</div>` : ''}<form id="enroll-form" class="inline-form" style="margin-top:14px"><div><label for="enroll-sequence">${enrollment ? 'Start a new sequence' : 'Enroll in a sequence'}</label><select id="enroll-sequence" name="sequence">${data.sequences.map((sequence) => `<option value="${escape(sequence.id)}">${escape(sequence.name)}</option>`).join('')}</select></div><button ${data.sequences.length ? '' : 'disabled'}>Enroll</button></form></div><div class="detail-section"><h3>Next actions</h3>${tasks.map((task) => `<div class="split note"><div>${escape(task.title)}<small>${escape(task.channel)} · ${dateLabel(task.due)}</small></div><button data-complete="${escape(task.id)}" data-return-person="${escape(id)}">✓ Done</button></div>`).join('') || '<p>No open actions.</p>'}<form id="task-form"><label for="task-title">Add an action</label><input id="task-title" name="title" required placeholder="What is the next step?"><div class="inline-form" style="margin-top:10px"><div><label for="task-due">Due</label><input id="task-due" name="due" type="date" value="${day()}" required></div><div><label for="task-channel">Channel</label><select id="task-channel" name="channel">${channelOptions('Email')}</select></div><button>Add action</button></div></form></div><div class="detail-section"><h3>Notes</h3><form id="note-form"><label for="note-text">Add a short note</label><textarea id="note-text" name="text" required placeholder="What did you discuss? What did you promise?"></textarea><button style="margin-top:8px">Save note</button></form>${person.notes.map((note) => `<div class="note"><small>${escape(note.actor || 'Imported')} · ${dateLabel(note.date)}</small>${escape(note.text)}</div>`).join('')}</div>${
      person.history.length
        ? `<div class="detail-section"><h3>Activity</h3>${person.history
            .slice(0, 12)
            .map(
              (item) =>
                `<div class="timeline-item">${escape(item.text)}<small>${escape(item.actor || 'Imported')} · ${dateLabel(item.date)}</small></div>`,
            )
            .join('')}</div>`
        : ''
    }</div>`,
  );
  $('#person-link-form').onsubmit = async (event) => {
    event.preventDefault();
    await command('add_profile_link', { collection: 'people', id, url: $('#person-link-url').value });
    detail(id);
    toast('Profile link added');
  };
  $('#detail-stage').onchange = async (event) => {
    await moveStage(personById(id), event.target.value);
    detail(id);
  };
  $('#enroll-form').onsubmit = async (event) => {
    event.preventDefault();
    await enroll(person, $('#enroll-sequence').value);
    detail(id);
  };
  $('#task-form').onsubmit = async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.target));
    if (!values.title.trim()) return;
    await command('create_action', { ...values, title: values.title.trim(), personId: id });
    detail(id);
    toast('Next action added');
  };
  $('#note-form').onsubmit = async (event) => {
    event.preventDefault();
    const text = $('#note-text').value.trim();
    if (!text) return;
    await command('add_note', { collection: 'people', id, text });
    detail(id);
    toast('Note saved');
  };
}
async function enroll(person, sequenceId) {
  await command('enroll_in_sequence', { personId: person.id, sequenceId, replace: true });
  toast('Enrolled · first action scheduled');
}
async function complete(id) {
  await command('complete_action', { id });
  toast('Action completed');
}
async function pause(id, reply = false) {
  await command('sequence_event', { personId: id, event: reply ? 'reply' : 'pause' });
  detail(id);
  toast(reply ? 'Reply recorded · sequence paused' : 'Sequence paused');
}
async function resume(id) {
  await command('sequence_event', { personId: id, event: 'resume' });
  detail(id);
  toast('Sequence resumed');
}
function editStages() {
  modal(
    'Make the pipeline yours',
    `<form id="stages-form"><div class="modal-body"><p>Define stages that fit the way you work. “Outcome” can mean whatever you are exploring.</p>${data.stages.map((stage, index) => `<div class="stage-editor"><span class="step-number">${index + 1}</span><input name="${escape(stage.id)}" aria-label="Stage ${index + 1} name" value="${escape(stage.name)}" required maxlength="40"></div>`).join('')}</div><div class="modal-footer"><button type="button" data-close>Cancel</button><button class="primary">Save stages</button></div></form>`,
  );
  $('#stages-form').onsubmit = async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.target));
    if (Object.values(values).some((value) => !value.trim())) return;
    await command('update_stages', {
      stages: data.stages.map((stage) => ({ id: stage.id, name: values[stage.id].trim() })),
    });
    closeModal();
    toast('Stages updated');
  };
}
function editSequence(id, draft) {
  const sequence = draft ||
    sequenceById(id) || { name: '', description: '', steps: [{ title: '', channel: 'Email', delay: 0 }] };
  modal(
    id ? 'Edit sequence' : 'Create a sequence',
    `<form id="sequence-form"><div class="modal-body"><label for="sequence-name">Sequence name</label><input id="sequence-name" required value="${escape(sequence.name)}" placeholder="A thoughtful introduction"><label for="sequence-description" style="margin-top:15px">Description</label><input id="sequence-description" value="${escape(sequence.description)}" placeholder="What is this sequence for?"><div class="detail-section"><h3>Steps & timing</h3><p>Wait days after enrollment for step 1, then after completing the previous step.</p><div class="step-editor" style="font-size:9px;color:var(--muted)"><span>ACTION</span><span>CHANNEL</span><span>DAYS</span><span></span></div>${sequence.steps.map((step, index) => `<div class="step-editor" data-step-row><input aria-label="Step ${index + 1} action" data-step-title required value="${escape(step.title)}" placeholder="Send an introduction"><select aria-label="Step ${index + 1} channel" data-step-channel>${channelOptions(step.channel)}</select><input aria-label="Step ${index + 1} wait days" data-step-delay type="number" min="0" max="365" required value="${step.delay}"><button type="button" data-remove-step="${index}" aria-label="Remove step ${index + 1}" ${sequence.steps.length === 1 ? 'disabled' : ''}>×</button></div>`).join('')}<button type="button" id="add-step">＋ Add step</button></div><div class="notice">Existing enrollments keep their original steps. Changes apply to new enrollments. Completing the last step finishes the sequence; choose a pipeline stage separately.</div></div><div class="modal-footer"><button type="button" data-close>Cancel</button><button class="primary">Save sequence</button></div></form>`,
  );
  const readDraft = () => ({
    name: $('#sequence-name').value,
    description: $('#sequence-description').value,
    steps: [...document.querySelectorAll('[data-step-row]')].map((row) => ({
      title: row.querySelector('[data-step-title]').value,
      channel: row.querySelector('[data-step-channel]').value,
      delay: Number(row.querySelector('[data-step-delay]').value),
    })),
  });
  $('#add-step').onclick = () => {
    const next = readDraft();
    next.steps.push({ title: '', channel: 'Email', delay: 3 });
    editSequence(id, next);
  };
  document.querySelectorAll('[data-remove-step]').forEach(
    (button) =>
      (button.onclick = () => {
        const next = readDraft();
        next.steps.splice(Number(button.dataset.removeStep), 1);
        editSequence(id, next);
      }),
  );
  $('#sequence-form').onsubmit = async (event) => {
    event.preventDefault();
    const values = readDraft();
    if (!values.name.trim() || values.steps.some((step) => !step.title.trim())) return;
    await command(
      id ? 'update_sequence' : 'create_sequence',
      id ? { ...values, id, expectedVersion: sequenceById(id).version } : values,
    );
    closeModal();
    toast('Sequence saved');
  };
}
function enrollmentPicker(sequenceId) {
  modal(
    'Enroll a person',
    `<form id="enrollment-picker"><div class="modal-body"><p>Choose a person for ${escape(sequenceById(sequenceId).name)}. Enrollment replaces any current sequence for that person.</p><label for="enrollment-person">Person</label><select id="enrollment-person">${data.people.map((person) => `<option value="${escape(person.id)}">${escape(person.name)}${person.company ? ` · ${escape(person.company)}` : ''}</option>`).join('')}</select></div><div class="modal-footer"><button type="button" data-close>Cancel</button><button class="primary" ${data.people.length ? '' : 'disabled'}>Enroll</button></div></form>`,
  );
  $('#enrollment-picker').onsubmit = async (event) => {
    event.preventDefault();
    await enroll(personById($('#enrollment-person').value), sequenceId);
    closeModal();
  };
}
document.addEventListener('click', async (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.view) {
    view = button.dataset.view;
    location.hash = view;
    search = '';
    render();
  }
  if (button.hasAttribute('data-close')) closeModal();
  if (button.dataset.person) detail(button.dataset.person);
  if (button.dataset.archivePerson) {
    const person = personById(button.dataset.archivePerson);
    await command('update_person', { id: person.id, archived: !person.archived, expectedVersion: person.version });
    detail(person.id);
    toast(person.archived ? 'Person restored' : 'Person archived');
  }
  if (button.dataset.editPerson) editPerson(button.dataset.editPerson);
  if (button.dataset.editSequence) editSequence(button.dataset.editSequence);
  if (button.dataset.enrollPicker) enrollmentPicker(button.dataset.enrollPicker);
  if (button.dataset.complete) {
    await complete(button.dataset.complete);
    if (button.dataset.returnPerson) detail(button.dataset.returnPerson);
  }
  if (button.dataset.pause) await pause(button.dataset.pause);
  if (button.dataset.reply) await pause(button.dataset.reply, true);
  if (button.dataset.resume) await resume(button.dataset.resume);
  if (button.dataset.snooze) {
    const task = data.tasks.find((t) => t.id === button.dataset.snooze);
    await command('update_action', { id: task.id, due: day(1), expectedVersion: task.version });
    toast('Moved to tomorrow');
  }
  if (button.id === 'add-person') editPerson();
  if (button.id === 'edit-stages') editStages();
  if (button.id === 'add-sequence') editSequence();
  if (button.id === 'toggle-tasks') {
    taskFilter = taskFilter === 'due' ? 'all' : 'due';
    render();
  }
  if (button.id === 'export') {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fieldwork-workspace-${day()}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Workspace exported');
  }
});
document.addEventListener('input', (event) => {
  if (event.target.id === 'search') {
    const position = event.target.selectionStart;
    search = event.target.value;
    render();
    $('#search').focus();
    $('#search').setSelectionRange(position, position);
  }
});
document.addEventListener('change', (event) => {
  if (event.target.id === 'type-filter') {
    typeFilter = event.target.value;
    render();
  }
});
window.addEventListener('hashchange', () => {
  const next = location.hash.slice(1);
  if (headerCopy[next] && next !== view) {
    view = next;
    search = '';
    render();
  }
});
window.addEventListener('unhandledrejection', (event) => {
  event.preventDefault();
  toast(event.reason?.message || 'Unable to save. Please try again.');
});
render();
if (initial.migrated) toast('Prototype workspace imported into your server database');
if (initial.migrationError) toast(`Prototype import needs attention: ${initial.migrationError}`);
setInterval(async () => {
  if (saving || document.hidden || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
  try {
    const latest = await api.workspace();
    if (latest.revision !== data.revision) {
      data = latest;
      render();
    }
  } catch {}
}, 8000);

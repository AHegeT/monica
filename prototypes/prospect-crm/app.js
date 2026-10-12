import { createResearchFeature, sampleResearch } from './research.js';

const STORAGE = 'fieldwork.crm.v1';
const $ = (selector) => document.querySelector(selector);
const escape = (value = '') =>
  String(value).replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  );
const uid = () => crypto.randomUUID();
const day = (offset = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const dateLabel = (date) =>
  !date
    ? 'No date'
    : date === day()
      ? 'Today'
      : date === day(1)
        ? 'Tomorrow'
        : new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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
const sample = () => ({
  version: 1,
  stages: [
    { id: 'new', name: 'New prospects', color: '#92a788' },
    { id: 'contacted', name: 'Contacted', color: '#b3a36d' },
    { id: 'conversation', name: 'In conversation', color: '#7b9bad' },
    { id: 'meeting', name: 'Meeting booked', color: '#a08daa' },
    { id: 'outcome', name: 'Outcome', color: '#658d72' },
  ],
  sequences: [
    {
      id: 'warm',
      name: 'A thoughtful introduction',
      description: 'Start a conversation, then give it room to grow.',
      steps: [
        { title: 'Send a personal introduction', channel: 'Email', delay: 0 },
        { title: 'Follow up with a useful idea', channel: 'Email', delay: 3 },
        { title: 'Suggest a short conversation', channel: 'Call', delay: 5 },
      ],
    },
    {
      id: 'network',
      name: 'Reconnect with your network',
      description: 'An easy rhythm for people you already know.',
      steps: [
        { title: 'Send a quick check-in', channel: 'LinkedIn', delay: 0 },
        { title: 'Share something relevant', channel: 'Email', delay: 7 },
        { title: 'Invite them for coffee', channel: 'Meeting', delay: 7 },
      ],
    },
  ],
  people: [
    {
      id: 'p1',
      name: 'Sofia Rivera',
      role: 'Founder',
      company: 'Lumen Studio',
      type: 'Prospect',
      stage: 'new',
      context: 'Met at a design meetup. Exploring ways to grow her studio.',
      personal: 'Enjoys trail running. Ask about her upcoming race.',
      color: 0,
    },
    {
      id: 'p2',
      name: 'Daniel Chen',
      role: 'Independent consultant',
      company: '',
      type: 'Prospect',
      stage: 'new',
      context: 'Introduced by a mutual contact. Works with early-stage teams.',
      personal: 'Recently moved to Mexico City.',
      color: 1,
    },
    {
      id: 'p3',
      name: 'Maya Patel',
      role: 'Head of operations',
      company: 'Northstar',
      type: 'Prospect',
      stage: 'contacted',
      context: 'Interested in improving the way her team works.',
      personal: 'Prefers short, practical emails.',
      color: 2,
    },
    {
      id: 'p4',
      name: 'Alex Morgan',
      role: 'Co-founder',
      company: 'Atlas Collective',
      type: 'Prospect',
      stage: 'contacted',
      context: 'Reached out after their recent product launch.',
      personal: 'Enjoys photography.',
      color: 3,
    },
    {
      id: 'p5',
      name: 'Camila Torres',
      role: 'Managing director',
      company: 'Forma',
      type: 'Prospect',
      stage: 'conversation',
      context: 'We discussed her plans for the next quarter.',
      personal: 'Travels frequently. Morning calls work best.',
      color: 4,
    },
    {
      id: 'p6',
      name: 'Oliver James',
      role: 'Business owner',
      company: '',
      type: 'Prospect',
      stage: 'meeting',
      context: 'Introductory conversation scheduled. Prepare a few questions.',
      personal: 'Introduced through a former colleague.',
      color: 1,
    },
    {
      id: 'p7',
      name: 'Elena Ruiz',
      role: 'Partner',
      company: 'Nido',
      type: 'Colleague',
      stage: 'conversation',
      context: 'A good person to exchange ideas and introductions with.',
      personal: 'Working on a community project.',
      color: 0,
    },
  ].map((person) => ({ ...person, email: '', notes: [], history: [], enrollment: null })),
  tasks: [
    { id: 't1', personId: 'p1', title: 'Research Sofia’s studio', channel: 'Research', due: day(), status: 'open' },
    {
      id: 't2',
      personId: 'p5',
      title: 'Send a recap and suggest next steps',
      channel: 'Email',
      due: day(-1),
      status: 'open',
    },
    {
      id: 't3',
      personId: 'p6',
      title: 'Prepare questions for our meeting',
      channel: 'Meeting',
      due: day(1),
      status: 'open',
    },
    {
      id: 't4',
      personId: 'p7',
      title: 'Check in about the community project',
      channel: 'Email',
      due: day(4),
      status: 'open',
    },
  ],
});
let data;
try {
  data = JSON.parse(localStorage.getItem(STORAGE)) || sample();
  if (
    data.version !== 1 ||
    !Array.isArray(data.people) ||
    !Array.isArray(data.stages) ||
    !Array.isArray(data.tasks) ||
    !Array.isArray(data.sequences)
  )
    throw Error('Unsupported data');
} catch {
  data = sample();
}
// Add research without replacing existing contacts, notes, sequences, or tasks.
data.research ??= sampleResearch(day());

let view = ['pipeline', 'people', 'today', 'sequences', 'research'].includes(location.hash.slice(1))
  ? location.hash.slice(1)
  : 'pipeline';
let search = '',
  typeFilter = 'All people',
  taskFilter = 'due';
const openTasks = () => data.tasks.filter((task) => task.status === 'open');
const personTasks = (id) =>
  openTasks()
    .filter((task) => task.personId === id)
    .sort((a, b) => a.due.localeCompare(b.due));
const personById = (id) => data.people.find((person) => person.id === id);
const stageById = (id) => data.stages.find((stage) => stage.id === id);
const sequenceById = (id) => data.sequences.find((sequence) => sequence.id === id);
const save = () => {
  try {
    localStorage.setItem(STORAGE, JSON.stringify(data));
  } catch {
    toast('Browser storage is full or unavailable. Export your workspace to keep a copy.');
  }
  render();
};
let toastTimer;
function toast(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 4000);
}
const history = (person, text) => person.history.unshift({ id: uid(), text, date: day() });
const peopleFiltered = () =>
  data.people.filter(
    (person) =>
      (typeFilter === 'All people' || person.type === typeFilter) &&
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
  save,
  toast,
  modal,
  closeModal: () => closeModal(),
  showPerson: detail,
});

const headerCopy = {
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
  return `<div class="toolbar"><input class="search" id="search" aria-label="Search people" placeholder="Search people or companies…" value="${escape(search)}"><div class="toolbar-right"><select id="type-filter" aria-label="Filter relationship type">${['All people', 'Prospect', 'Client', 'Colleague', 'Mentor', 'Recruiter'].map((type) => `<option ${type === typeFilter ? 'selected' : ''}>${type}</option>`).join('')}</select>${extra}</div></div>`;
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
  }[view];
  document
    .querySelectorAll('[data-view]')
    .forEach((button) => button.classList.toggle('active', button.dataset.view === view));
  $('#due-count').textContent = openTasks().filter((task) => task.due <= day()).length;
  const content = $('#content');
  const headingAction = document.querySelector('.page-heading > button');
  headingAction.id = view === 'research' ? 'add-research' : 'add-person';
  headingAction.textContent = view === 'research' ? '＋ Start research' : '＋ Add prospect';
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
          return `<tr><td><button class="person-link" data-person="${escape(person.id)}"><div class="person-row">${avatar(person)}<div class="person-name">${escape(person.name)}<div class="person-role">${escape(person.role)}</div></div></div></button></td><td>${escape(person.company || 'Individual')}</td><td><span class="chip">${escape(person.type)}</span></td><td>${escape(stageById(person.stage)?.name || '')}</td><td>${task ? `${escape(task.title)} <span class="person-role">· ${dateLabel(task.due)}</span>` : '—'}</td></tr>`;
        })
        .join(
          '',
        )}</tbody></table></div>${peopleFiltered().length ? '' : '<div class="empty">No people match your search.</div>'}`;
  if (view === 'sequences')
    content.innerHTML = `<div class="toolbar"><span class="hint">A sequence creates one next action at a time.</span><button id="add-sequence">＋ New sequence</button></div><div class="sequence-grid">${data.sequences.map((sequence) => `<article class="sequence-card"><div class="sequence-top"><span class="chip">${sequence.steps.length} STEPS</span><button class="text-button" data-edit-sequence="${escape(sequence.id)}">Edit sequence ↗</button></div><h2>${escape(sequence.name)}</h2><p>${escape(sequence.description)}</p><ol class="step-list">${sequence.steps.map((step, index) => `<li><span class="step-number">${index + 1}</span><div class="step-copy">${escape(step.title)}<small>${escape(step.channel)} · ${step.delay === 0 ? 'Ready immediately' : `${step.delay} days ${index === 0 ? 'after enrollment' : 'after previous step'}`}</small></div></li>`).join('')}</ol><div class="sequence-bottom"><span>${data.people.filter((person) => person.enrollment?.sequenceId === sequence.id && person.enrollment.status === 'active').length} active people</span><button data-enroll-picker="${escape(sequence.id)}">Enroll a person</button></div></article>`).join('')}</div><div class="notice">All steps are manual tasks in this prototype. Recording a reply pauses the sequence. Completing a step schedules the next one; no messages are sent.</div>`;
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
function moveStage(person, stage) {
  if (person.stage === stage) return;
  person.stage = stage;
  history(person, `Moved to ${stageById(stage).name}`);
  save();
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
    `<form id="person-form"><div class="modal-body form-grid"><div><label for="person-name">Name</label><input id="person-name" name="name" required maxlength="120" value="${escape(person.name)}"></div><div><label for="person-role">Role</label><input id="person-role" name="role" value="${escape(person.role)}" placeholder="Founder, consultant…"></div><div><label for="person-company">Company (optional)</label><input id="person-company" name="company" value="${escape(person.company)}" placeholder="Leave blank for an individual" list="companies"><datalist id="companies">${[...new Set(data.people.map((p) => p.company).filter(Boolean))].map((company) => `<option value="${escape(company)}">`).join('')}</datalist></div><div><label for="person-email">Email (optional)</label><input id="person-email" name="email" type="email" value="${escape(person.email)}"></div><div><label for="person-type">Relationship</label><select id="person-type" name="type">${['Prospect', 'Client', 'Colleague', 'Mentor', 'Recruiter'].map((type) => `<option ${type === person.type ? 'selected' : ''}>${type}</option>`).join('')}</select></div><div><label for="person-stage">Pipeline stage</label><select id="person-stage" name="stage">${stageOptions(person.stage)}</select></div><div class="full"><label for="person-context">Professional context</label><textarea id="person-context" name="context" placeholder="How you met, what they are working on…">${escape(person.context)}</textarea></div><div class="full"><label for="person-personal">Personal details</label><textarea id="person-personal" name="personal" placeholder="A few things you want to remember…">${escape(person.personal)}</textarea></div></div><div class="modal-footer"><button type="button" data-close>Cancel</button><button class="primary" type="submit">${id ? 'Save changes' : 'Add prospect'}</button></div></form>`,
  );
  $('#person-form').onsubmit = (event) => {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.target));
    fields.name = fields.name.trim();
    if (!fields.name) {
      toast('Please enter a name');
      return;
    }
    fields.company = fields.company.trim();
    if (id) {
      Object.assign(person, fields);
      history(person, 'Profile updated');
    } else {
      data.people.push({ ...fields, id: uid(), color: data.people.length, notes: [], history: [], enrollment: null });
    }
    save();
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
    `<div class="modal-body"><div class="detail-title">${avatar(person)}<div><h2>${escape(person.name)}</h2><p>${escape([person.role, person.company].filter(Boolean).join(' · ') || 'Individual prospect')}</p></div></div><div class="split"><span class="chip">${escape(person.type)}</span><button data-edit-person="${escape(id)}">Edit profile</button></div><p>${escape(person.context || 'No professional context added yet.')}</p>${person.email ? `<p>${escape(person.email)}</p>` : ''}<label for="detail-stage">Pipeline stage</label><select id="detail-stage">${stageOptions(person.stage)}</select>${researchFeature.personLinks(id)}<div class="detail-section"><h3>Personal details</h3><p>${escape(person.personal || 'Add details you want to remember in the profile.')}</p></div><div class="detail-section"><h3>Sequence</h3>${enrollment ? `<p>${escape(enrollment.name)} · <strong>${escape(enrollment.status)}</strong> · ${enrollment.status === 'completed' ? 'All steps finished' : `Step ${enrollment.index + 1} of ${enrollment.steps.length}`}</p><div class="detail-actions">${enrollment.status === 'active' ? `<button data-pause="${escape(id)}">Pause sequence</button><button data-reply="${escape(id)}">Record reply</button>` : enrollment.status === 'paused' ? `<button data-resume="${escape(id)}">Resume sequence</button>` : ''}</div>` : ''}<form id="enroll-form" class="inline-form" style="margin-top:14px"><div><label for="enroll-sequence">${enrollment ? 'Start a new sequence' : 'Enroll in a sequence'}</label><select id="enroll-sequence" name="sequence">${data.sequences.map((sequence) => `<option value="${escape(sequence.id)}">${escape(sequence.name)}</option>`).join('')}</select></div><button ${data.sequences.length ? '' : 'disabled'}>Enroll</button></form></div><div class="detail-section"><h3>Next actions</h3>${tasks.map((task) => `<div class="split note"><div>${escape(task.title)}<small>${escape(task.channel)} · ${dateLabel(task.due)}</small></div><button data-complete="${escape(task.id)}" data-return-person="${escape(id)}">✓ Done</button></div>`).join('') || '<p>No open actions.</p>'}<form id="task-form"><label for="task-title">Add an action</label><input id="task-title" name="title" required placeholder="What is the next step?"><div class="inline-form" style="margin-top:10px"><div><label for="task-due">Due</label><input id="task-due" name="due" type="date" value="${day()}" required></div><div><label for="task-channel">Channel</label><select id="task-channel" name="channel">${channelOptions('Email')}</select></div><button>Add action</button></div></form></div><div class="detail-section"><h3>Notes</h3><form id="note-form"><label for="note-text">Add a short note</label><textarea id="note-text" name="text" required placeholder="What did you discuss? What did you promise?"></textarea><button style="margin-top:8px">Save note</button></form>${person.notes.map((note) => `<div class="note"><small>${dateLabel(note.date)}</small>${escape(note.text)}</div>`).join('')}</div>${
      person.history.length
        ? `<div class="detail-section"><h3>Activity</h3>${person.history
            .slice(0, 12)
            .map(
              (item) => `<div class="timeline-item">${escape(item.text)}<small>${dateLabel(item.date)}</small></div>`,
            )
            .join('')}</div>`
        : ''
    }</div>`,
  );
  $('#detail-stage').onchange = (event) => moveStage(person, event.target.value);
  $('#enroll-form').onsubmit = (event) => {
    event.preventDefault();
    enroll(person, $('#enroll-sequence').value);
    detail(id);
  };
  $('#task-form').onsubmit = (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.target));
    if (!values.title.trim()) return;
    data.tasks.push({ ...values, title: values.title.trim(), id: uid(), personId: id, status: 'open' });
    save();
    detail(id);
    toast('Next action added');
  };
  $('#note-form').onsubmit = (event) => {
    event.preventDefault();
    const text = $('#note-text').value.trim();
    if (!text) return;
    person.notes.unshift({ id: uid(), date: day(), text });
    save();
    detail(id);
    toast('Note saved');
  };
}
function scheduleStep(person) {
  const enrollment = person.enrollment,
    step = enrollment.steps[enrollment.index];
  data.tasks.push({
    id: uid(),
    personId: person.id,
    title: step.title,
    channel: step.channel,
    due: day(step.delay),
    status: 'open',
    sequenceId: enrollment.sequenceId,
    enrollmentId: enrollment.id,
    stepIndex: enrollment.index,
  });
}
function enroll(person, sequenceId) {
  const sequence = sequenceById(sequenceId);
  if (!sequence) return;
  data.tasks
    .filter((task) => task.personId === person.id && task.sequenceId && ['open', 'paused'].includes(task.status))
    .forEach((task) => (task.status = 'cancelled'));
  person.enrollment = {
    id: uid(),
    sequenceId,
    name: sequence.name,
    steps: structuredClone(sequence.steps),
    index: 0,
    status: 'active',
  };
  scheduleStep(person);
  history(person, `Enrolled in ${sequence.name}`);
  save();
  toast('Enrolled · first action scheduled');
}
function complete(id) {
  const task = data.tasks.find((task) => task.id === id);
  if (!task || task.status !== 'open') return;
  const person = personById(task.personId);
  task.status = 'done';
  task.completedAt = day();
  history(person, `Completed: ${task.title}`);
  const enrollment = person.enrollment;
  if (task.enrollmentId && enrollment?.id === task.enrollmentId && enrollment.status === 'active') {
    enrollment.index++;
    if (enrollment.index < enrollment.steps.length) scheduleStep(person);
    else {
      enrollment.status = 'completed';
      history(person, `Finished ${enrollment.name}`);
    }
  }
  save();
  toast('Action completed');
}
function pause(id, reply = false) {
  const person = personById(id);
  if (person.enrollment?.status !== 'active') return;
  person.enrollment.status = 'paused';
  data.tasks
    .filter((task) => task.personId === id && task.enrollmentId === person.enrollment.id && task.status === 'open')
    .forEach((task) => (task.status = 'paused'));
  history(person, reply ? 'Reply received · sequence paused' : 'Sequence paused');
  save();
  detail(id);
  toast(reply ? 'Reply recorded · sequence paused' : 'Sequence paused');
}
function resume(id) {
  const person = personById(id);
  if (person.enrollment?.status !== 'paused') return;
  person.enrollment.status = 'active';
  data.tasks
    .filter((task) => task.enrollmentId === person.enrollment.id && task.status === 'paused')
    .forEach((task) => {
      task.status = 'open';
      if (task.due < day()) task.due = day();
    });
  history(person, 'Sequence resumed');
  save();
  detail(id);
  toast('Sequence resumed');
}
function editStages() {
  modal(
    'Make the pipeline yours',
    `<form id="stages-form"><div class="modal-body"><p>Define stages that fit the way you work. “Outcome” can mean whatever you are exploring.</p>${data.stages.map((stage, index) => `<div class="stage-editor"><span class="step-number">${index + 1}</span><input name="${escape(stage.id)}" aria-label="Stage ${index + 1} name" value="${escape(stage.name)}" required maxlength="40"></div>`).join('')}</div><div class="modal-footer"><button type="button" data-close>Cancel</button><button class="primary">Save stages</button></div></form>`,
  );
  $('#stages-form').onsubmit = (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.target));
    if (Object.values(values).some((value) => !value.trim())) return;
    data.stages.forEach((stage) => (stage.name = values[stage.id].trim()));
    save();
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
  $('#sequence-form').onsubmit = (event) => {
    event.preventDefault();
    const values = readDraft();
    if (!values.name.trim() || values.steps.some((step) => !step.title.trim())) return;
    if (id) Object.assign(sequenceById(id), values);
    else data.sequences.push({ ...values, id: uid() });
    save();
    closeModal();
    toast('Sequence saved');
  };
}
function enrollmentPicker(sequenceId) {
  modal(
    'Enroll a person',
    `<form id="enrollment-picker"><div class="modal-body"><p>Choose a person for ${escape(sequenceById(sequenceId).name)}. Enrollment replaces any current sequence for that person.</p><label for="enrollment-person">Person</label><select id="enrollment-person">${data.people.map((person) => `<option value="${escape(person.id)}">${escape(person.name)}${person.company ? ` · ${escape(person.company)}` : ''}</option>`).join('')}</select></div><div class="modal-footer"><button type="button" data-close>Cancel</button><button class="primary" ${data.people.length ? '' : 'disabled'}>Enroll</button></div></form>`,
  );
  $('#enrollment-picker').onsubmit = (event) => {
    event.preventDefault();
    enroll(personById($('#enrollment-person').value), sequenceId);
    closeModal();
  };
}
document.addEventListener('click', (event) => {
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
  if (button.dataset.editPerson) editPerson(button.dataset.editPerson);
  if (button.dataset.editSequence) editSequence(button.dataset.editSequence);
  if (button.dataset.enrollPicker) enrollmentPicker(button.dataset.enrollPicker);
  if (button.dataset.complete) {
    complete(button.dataset.complete);
    if (button.dataset.returnPerson) detail(button.dataset.returnPerson);
  }
  if (button.dataset.pause) pause(button.dataset.pause);
  if (button.dataset.reply) pause(button.dataset.reply, true);
  if (button.dataset.resume) resume(button.dataset.resume);
  if (button.dataset.snooze) {
    const task = data.tasks.find((t) => t.id === button.dataset.snooze);
    task.due = day(1);
    save();
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
// Save the initial fictional workspace so reloads retain the same sample dates.
save();

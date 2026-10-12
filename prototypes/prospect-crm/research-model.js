// UI-independent operations. A future service/API can preserve these semantics.
export const researchStatuses = ['Exploring', 'Waiting', 'Ready', 'Archived'];
export const findingTypes = ['Observation', 'Hypothesis', 'Question'];
const required = (value, name) => {
  const text = String(value || '').trim();
  if (!text) throw new Error(`${name} is required.`);
  return text;
};
export function webUrl(value) {
  if (!value?.trim()) return '';
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error('Use a full https:// or http:// link.');
  }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password)
    throw new Error('Use an http:// or https:// link without credentials.');
  return url.href;
}
export function parseLinks(value) {
  return [
    ...new Set(
      String(value || '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    ),
  ].map((value) => {
    const url = webUrl(value);
    const parsed = new URL(url);
    return { url, label: `${parsed.hostname}${parsed.pathname === '/' ? '' : parsed.pathname}` };
  });
}
export function putResearch(workspace, values, id, makeId, date) {
  const fields = {
    title: required(values.title, 'Research title'),
    question: required(values.question, 'Research question'),
    status: values.status,
  };
  if (!researchStatuses.includes(fields.status)) throw new Error('Choose a research status.');
  if (id) {
    const research = workspace.research.find((item) => item.id === id);
    if (!research) throw new Error('Research not found.');
    Object.assign(research, fields, { updatedAt: date });
    return research;
  }
  const research = { ...fields, id: makeId(), targets: [], findings: [], createdAt: date, updatedAt: date };
  workspace.research.push(research);
  return research;
}
export function putTarget(workspace, researchId, values, id, makeId, date) {
  const research = workspace.research.find((item) => item.id === researchId);
  if (!research) throw new Error('Research not found.');
  if (!['Person', 'Company'].includes(values.kind)) throw new Error('Choose a person or company.');
  const fields = {
    kind: values.kind,
    name: required(values.name, 'Name'),
    company: String(values.company || '').trim(),
    role: String(values.role || '').trim(),
    context: String(values.context || '').trim(),
    links: parseLinks(values.links),
    personId: values.personId || null,
  };
  if (fields.personId && (fields.kind !== 'Person' || !workspace.people.some((p) => p.id === fields.personId)))
    throw new Error('Choose an existing person or leave the link empty.');
  if (id) {
    const target = research.targets.find((t) => t.id === id);
    if (!target) throw new Error('Research subject not found.');
    Object.assign(target, fields);
    research.updatedAt = date;
    return target;
  }
  const target = { ...fields, id: makeId() };
  research.targets.push(target);
  research.updatedAt = date;
  return target;
}
export function addFinding(workspace, researchId, values, makeId, date) {
  const research = workspace.research.find((item) => item.id === researchId);
  if (!research) throw new Error('Research not found.');
  if (!findingTypes.includes(values.kind)) throw new Error('Choose a finding type.');
  if (values.targetId && !research.targets.some((t) => t.id === values.targetId))
    throw new Error('Choose a subject in this research.');
  const finding = {
    id: makeId(),
    text: required(values.text, 'Finding'),
    kind: values.kind,
    targetId: values.targetId || null,
    sourceUrl: webUrl(values.sourceUrl),
    author: 'You',
    createdAt: date,
  };
  research.findings.unshift(finding);
  research.updatedAt = date;
  return finding;
}
export function promoteTarget(workspace, researchId, targetId, makeId, date) {
  const research = workspace.research.find((item) => item.id === researchId),
    target = research?.targets.find((t) => t.id === targetId);
  if (!target || target.kind !== 'Person') throw new Error('Choose a person to add to the pipeline.');
  if (target.personId) {
    const existing = workspace.people.find((p) => p.id === target.personId);
    if (!existing) throw new Error('Linked person not found.');
    return existing;
  }
  const matches = workspace.people.filter((p) => p.name.toLowerCase() === target.name.toLowerCase());
  if (matches.length)
    throw new Error('A person with this name already exists. Edit the subject and link the correct profile first.');
  const person = {
    id: makeId(),
    name: target.name,
    role: target.role,
    company: target.company,
    email: '',
    type: 'Prospect',
    stage: workspace.stages[0].id,
    context: target.context,
    personal: '',
    color: workspace.people.length,
    notes: [],
    history: [{ id: makeId(), text: `Added from research: ${research.title}`, date }],
    enrollment: null,
  };
  workspace.people.push(person);
  target.personId = person.id;
  research.updatedAt = date;
  return person;
}

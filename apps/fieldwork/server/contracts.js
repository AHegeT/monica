const str = { type: 'string', maxLength: 10000 },
  id = { type: 'string', minLength: 1, maxLength: 150 },
  short = { type: 'string', maxLength: 200 };
const enumeration = (values) => ({ type: 'string', enum: values });
const version = { type: 'integer', minimum: 1 };
const steps = {
  type: 'array',
  minItems: 1,
  maxItems: 30,
  items: {
    type: 'object',
    additionalProperties: false,
    required: ['title', 'channel', 'delay'],
    properties: {
      title: { ...short, minLength: 1 },
      channel: enumeration(['Email', 'LinkedIn', 'Call', 'Meeting', 'Research', 'Other']),
      delay: { type: 'integer', minimum: 0, maximum: 365 },
    },
  },
};
const fields = {
  name: short,
  role: short,
  company: short,
  companyId: { anyOf: [id, { type: 'null' }] },
  email: short,
  type: enumeration(['Prospect', 'Client', 'Colleague', 'Mentor', 'Recruiter']),
  stage: { anyOf: [id, { type: 'null' }] },
  context: str,
  personal: str,
  archived: { type: 'boolean' },
};
const companyFields = { name: short, website: short, context: str, archived: { type: 'boolean' } };
export const operations = {};
function define(name, description, properties, required = [], scope = 'write') {
  operations[name] = {
    name,
    description,
    scope,
    inputSchema: { type: 'object', additionalProperties: false, properties, required },
  };
}
define(
  'describe_workspace',
  'Discover Fieldwork capabilities, permitted operations, research conventions, and current limitations. Call this first when exploring the app.',
  {},
  [],
  'read',
);
define(
  'search_records',
  'Search people, companies, and research. Resolve exact IDs before changing a record.',
  {
    query: short,
    type: enumeration(['people', 'companies', 'research', 'all']),
    limit: { type: 'integer', minimum: 1, maximum: 100 },
  },
  [],
  'read',
);
define(
  'get_record',
  'Read a person, company, research, action, sequence, or job by its stable ID.',
  { collection: enumeration(['people', 'companies', 'research', 'tasks', 'sequences', 'jobs']), id },
  ['collection', 'id'],
  'read',
);
define(
  'list_records',
  'List records with optional search, status filter, cursor, and updated-since filter.',
  {
    collection: enumeration(['people', 'companies', 'research', 'tasks', 'sequences', 'jobs', 'stages']),
    query: short,
    status: short,
    cursor: { type: 'integer', minimum: 0 },
    limit: { type: 'integer', minimum: 1, maximum: 100 },
    updatedSince: short,
  },
  ['collection'],
  'read',
);
define(
  'create_person',
  'Create an individual or company contact. Use stage=null to keep a research-only identity.',
  fields,
  ['name'],
);
define(
  'update_person',
  'Update specified person fields; expectedVersion prevents overwriting concurrent edits.',
  { id, ...fields, expectedVersion: version },
  ['id'],
);
define('create_company', 'Create a company even when no contacts are known yet.', companyFields, ['name']);
define('update_company', 'Update specified company fields.', { id, ...companyFields, expectedVersion: version }, [
  'id',
]);
define(
  'add_note',
  'Add a note to a person or company, with server-derived authorship.',
  { collection: enumeration(['people', 'companies']), id, text: str },
  ['collection', 'id', 'text'],
);
define(
  'add_profile_link',
  'Attach a website or profile URL to a person or company.',
  { collection: enumeration(['people', 'companies']), id, url: str, label: short },
  ['collection', 'id', 'url'],
);
define(
  'move_pipeline_item',
  'Move a person to an existing stage. This does not send a message.',
  { id, stageId: id, expectedVersion: version },
  ['id', 'stageId'],
);
define(
  'update_stages',
  'Rename or reorder existing pipeline stages.',
  {
    stages: {
      type: 'array',
      minItems: 1,
      maxItems: 30,
      items: { type: 'object', additionalProperties: false, required: ['id', 'name'], properties: { id, name: short } },
    },
  },
  ['stages'],
);
define('create_sequence', 'Create manual engagement steps with wait days.', { name: short, description: str, steps }, [
  'name',
  'steps',
]);
define(
  'update_sequence',
  'Edit a sequence template; existing enrollments keep their step snapshot.',
  { id, name: short, description: str, steps, expectedVersion: version },
  ['id', 'name', 'steps'],
);
define(
  'enroll_in_sequence',
  'Enroll a person. Explicit replace=true is required to replace an active or paused enrollment.',
  { personId: id, sequenceId: id, replace: { type: 'boolean' } },
  ['personId', 'sequenceId'],
);
define(
  'sequence_event',
  "Pause, resume, or record a reply on a person's current sequence.",
  { personId: id, event: enumeration(['pause', 'resume', 'reply']) },
  ['personId', 'event'],
);
define(
  'create_action',
  'Create a dated next action for a person.',
  {
    personId: id,
    title: short,
    channel: enumeration(['Email', 'LinkedIn', 'Call', 'Meeting', 'Research', 'Other']),
    due: short,
  },
  ['personId', 'title', 'due'],
);
define(
  'update_action',
  "Change an open action's title, channel, or due date.",
  { id, title: short, channel: short, due: short, expectedVersion: version },
  ['id'],
);
define('complete_action', 'Complete an action once and atomically schedule the next sequence step.', { id }, ['id']);
define(
  'create_research',
  'Start one of many parallel research investigations.',
  { title: short, question: str, summary: str, tags: { type: 'array', maxItems: 30, items: short }, status: enumeration(['Exploring', 'Waiting', 'Ready', 'Archived']) },
  ['title', 'question'],
);
define(
  'update_research',
  'Update a research brief or workflow status.',
  {
    id,
    title: short,
    question: str,
    summary: str,
    tags: { type: 'array', maxItems: 30, items: short },
    status: enumeration(['Exploring', 'Waiting', 'Ready', 'Archived']),
    expectedVersion: version,
  },
  ['id'],
);
const targetFields = {
  kind: enumeration(['Person', 'Company']),
  name: short,
  role: short,
  company: short,
  context: str,
  links: str,
  personId: { anyOf: [id, { type: 'null' }] },
  companyId: { anyOf: [id, { type: 'null' }] },
};
define(
  'add_research_subject',
  'Attach a person or company to research; link an existing identity by ID when appropriate.',
  { researchId: id, ...targetFields },
  ['researchId', 'kind', 'name'],
);
define(
  'update_research_subject',
  'Edit a research subject, its links, or identity link.',
  { researchId: id, id, ...targetFields, expectedVersion: version },
  ['researchId', 'id', 'kind', 'name'],
);
define(
  'add_research_finding',
  'Record an observation, hypothesis, or question, retaining its source and subject.',
  {
    researchId: id,
    text: str,
    kind: enumeration(['Observation', 'Hypothesis', 'Question']),
    targetId: { anyOf: [id, { type: 'null' }] },
    sourceUrl: str,
    sourceReference: short,
    jobId: id,
  },
  ['researchId', 'text', 'kind'],
);
define(
  'promote_research_subject',
  'Add a researched person to the pipeline, preserving the same identity and research.',
  { researchId: id, targetId: id },
  ['researchId', 'targetId'],
);
define(
  'start_research_job',
  'Create a research job for an external agent to execute. This schedules work; it does not itself browse.',
  { researchId: id, brief: str },
  ['researchId', 'brief'],
);
define('claim_research_job', 'Claim a queued job so another agent cannot run the same work concurrently.', { id }, [
  'id',
]);
define(
  'update_research_job',
  'Update progress or finish/fail/cancel a job you claimed.',
  {
    id,
    status: enumeration(['running', 'completed', 'failed', 'cancelled']),
    progress: { type: 'integer', minimum: 0, maximum: 100 },
    message: str,
  },
  ['id', 'status'],
);
export const publicOperations = Object.values(operations);

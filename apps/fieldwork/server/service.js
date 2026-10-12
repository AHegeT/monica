import Ajv from 'ajv';
import { randomUUID, createHash } from 'node:crypto';
import { operations } from './contracts.js';
import { webUrl, parseLinks } from '../public/research-model.js';

export class AppError extends Error {
  constructor(code, message, status = 422, details) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}
const fail = (code, message, status = 422, details) => {
  throw new AppError(code, message, status, details);
};
const text = (value, label) => {
  if (typeof value !== 'string' || !value.trim()) fail('validation_failed', `${label} is required.`);
  return value.trim();
};
const canonical = (value) =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((k) => [k, canonical(value[k])]),
        )
      : value;
const present = (value) => Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined));
export class Service {
  constructor(store, { timezone = 'America/Mexico_City' } = {}) {
    this.store = store;
    this.timezone = timezone;
    new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());
    const ajv = new Ajv({ allErrors: true });
    this.validators = {};
    for (const [name, op] of Object.entries(operations)) {
      if (op.scope === 'write')
        op.inputSchema.properties.requestId = {
          type: 'string',
          minLength: 1,
          maxLength: 200,
          description: 'Stable operation ID for safe retries, e.g. Telegram update ID plus operation number.',
        };
      this.validators[name] = ajv.compile(op.inputSchema);
    }
  }
  day(offset = 0) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: this.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
    const date = new Date(`${p.year}-${p.month}-${p.day}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + offset);
    return date.toISOString().slice(0, 10);
  }
  date(value) {
    if (
      typeof value !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      Number.isNaN(Date.parse(value)) ||
      new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) !== value
    )
      fail('validation_failed', 'Due date must be a real date in YYYY-MM-DD format.');
    return value;
  }
  record(table, id, version) {
    const item = this.store.get(table, id);
    if (!item) fail('not_found', `${table} record not found.`, 404);
    if (version !== undefined && version !== item.version)
      fail('version_conflict', 'This record changed. Read it again before updating.', 409, {
        currentVersion: item.version,
      });
    return item;
  }
  company(name, id) {
    if (id) return this.record('companies', id);
    if (!name?.trim()) return null;
    const existing = this.store
      .list('companies')
      .filter((c) => c.name.toLowerCase() === name.trim().toLowerCase() && !c.archived);
    if (existing.length > 1) fail('ambiguous_match', 'Several companies match. Supply companyId.', 409);
    return (
      existing[0] ||
      this.store.put('companies', {
        id: randomUUID(),
        name: name.trim(),
        website: '',
        context: '',
        notes: [],
        links: [],
        archived: false,
      })
    );
  }
  log(item, message, actor) {
    item.history = [{ id: randomUUID(), text: message, date: this.day(), actor }, ...(item.history || [])];
    return item;
  }
  person(item) {
    const company = item.companyId ? this.store.get('companies', item.companyId) : null;
    return { ...item, company: company?.name || item.company || '' };
  }
  workspace() {
    return {
      version: 1,
      revision: this.store.revision(),
      timezone: this.timezone,
      people: this.store.list('people').map((p) => this.person(p)),
      companies: this.store.list('companies'),
      stages: this.store.list('stages').sort((a, b) => a.order - b.order),
      sequences: this.store.list('sequences'),
      tasks: this.store.list('tasks'),
      research: this.store.list('research'),
      jobs: this.store.list('jobs'),
    };
  }
  execute(name, args = {}, context = {}) {
    const op = operations[name];
    if (!op) fail('not_found', 'Unknown operation.', 404);
    if (!context.scopes?.includes(op.scope))
      fail('permission_denied', `This credential lacks ${op.scope} access.`, 403);
    if (!this.validators[name](args))
      fail('validation_failed', 'Invalid operation arguments.', 422, this.validators[name].errors);
    const actor = context.actor || 'Owner';
    if (op.scope === 'read') return { data: this.run(name, args, actor, context), revision: this.store.revision() };
    const key = context.idempotencyKey || args.requestId;
    if (key && (key.length > 200 || key.length < 1))
      fail('validation_failed', 'Idempotency key must be 1–200 characters.');
    const fingerprint = createHash('sha256')
      .update(JSON.stringify(canonical({ name, args })))
      .digest('hex');
    return this.store.transaction(() => {
      if (key) {
        const old = this.store.db.prepare('SELECT * FROM idempotency WHERE actor=? AND key=?').get(actor, key);
        if (old) {
          if (old.fingerprint !== fingerprint)
            fail('idempotency_conflict', 'This request ID was already used for different input.', 409);
          return { ...JSON.parse(old.result), replayed: true };
        }
      }
      if (context.expectedRevision !== undefined && context.expectedRevision !== this.store.revision())
        fail('version_conflict', 'Workspace changed in another client. Reload and retry.', 409);
      const result = this.run(name, args, actor);
      this.store.audit(actor, name, result?.id || args.id || args.personId || args.researchId, {
        fields: Object.keys(args).filter((k) => k !== 'requestId'),
        sourceReference: args.sourceReference || null,
      });
      const response = { data: result, revision: this.store.bump() };
      if (key)
        this.store.db
          .prepare('INSERT INTO idempotency VALUES (?,?,?,?)')
          .run(actor, key, fingerprint, JSON.stringify(response));
      return response;
    });
  }
  run(name, a, actor, context = {}) {
    const s = this.store;
    switch (name) {
      case 'describe_workspace':
        return {
          name: 'Fieldwork', version: '0.1.0', timezone: this.timezone,
          operations: Object.values(operations).filter((op) => context.scopes?.includes(op.scope)).map(({ name, description, scope }) => ({ name, description, scope })),
          research: {
            structure: 'Investigation with title, question, summary, tags, company/person subjects, and individually sourced findings.',
            retrieval: 'search_records and list_records search stored record content, including findings, subjects, summaries, and tags. get_record returns the complete investigation by stable ID. Search is literal text, not semantic search.',
            findingTypes: ['Observation', 'Hypothesis', 'Question'],
            limits: { textCharacters: 10000, titleCharacters: 200, tags: 30, pageSize: 100 },
            workflow: ['Search for existing investigations and identities before creating.', 'Store one claim per finding, retaining sourceUrl and sourceReference when available.', 'Use targetId for competitor-specific findings; omit it for cross-company conclusions.', 'Keep summary as a synthesis and tags as consistent retrieval keywords.', 'Record gaps and requested improvements as Question findings under a separate Fieldwork feedback investigation.'],
          },
          limitations: ['Single owner and workspace.', 'Tokens grant general read/write access, not per-investigation access.', 'No attachment storage.', 'No automatic browsing worker or outreach delivery.', 'No structured pricing/comparison matrix, semantic search, or finding edit/delete operation.', 'Sources are recorded but not independently verified by Fieldwork.', 'MCP currently uses local stdio; remote ChatGPT MCP requires another transport and authentication integration.'],
          guidance: 'Explore available read tools first. Evaluate which structures fit the user research and explicitly report gaps. Never claim an unsupported feature exists or that data was saved until a write succeeds. Use stable requestId values for retries and expectedVersion for edits.',
        };
      case 'search_records': {
        const query = (a.query || '').toLowerCase(),
          types = a.type && a.type !== 'all' ? [a.type] : ['people', 'companies', 'research'];
        return types
          .flatMap((collection) =>
            s
              .list(collection)
              .filter(
                (p) =>
                  !p.archived &&
                  JSON.stringify(p).toLowerCase().includes(query),
              )
              .map((p) => ({ collection, ...(collection === 'people' ? this.person(p) : p) })),
          )
          .slice(0, a.limit || 30);
      }
      case 'get_record': {
        const r = this.record(a.collection, a.id);
        return a.collection === 'people' ? this.person(r) : r;
      }
      case 'list_records': {
        const all = s
          .list(a.collection)
          .filter(
            (r) =>
              (!a.query ||
                JSON.stringify(r)
                  .toLowerCase()
                  .includes(a.query.toLowerCase())) &&
              (!a.status || r.status === a.status) &&
              (!a.updatedSince || r.updatedAt > a.updatedSince),
          );
        const start = a.cursor || 0,
          limit = a.limit || 30;
        return {
          items: all.slice(start, start + limit).map((r) => (a.collection === 'people' ? this.person(r) : r)),
          nextCursor: start + limit < all.length ? start + limit : null,
          total: all.length,
        };
      }
      case 'create_person':
      case 'update_person': {
        const old =
          name === 'update_person'
            ? this.record('people', a.id, a.expectedVersion)
            : {
                id: randomUUID(),
                name: '',
                role: '',
                email: '',
                companyId: null,
                type: 'Prospect',
                stage: s.list('stages')[0].id,
                context: '',
                personal: '',
                notes: [],
                links: [],
                history: [],
                enrollment: null,
                color: s.list('people').length,
                archived: false,
              };
        const { id, expectedVersion, requestId, company, ...fields } = a;
        const p = { ...old, ...fields };
        p.name = text(p.name, 'Name');
        if (p.stage) this.record('stages', p.stage);
        if (p.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email))
          fail('validation_failed', 'Enter a valid email address.');
        if (a.companyId !== undefined) p.companyId = a.companyId ? this.record('companies', a.companyId).id : null;
        else if (company !== undefined) p.companyId = this.company(company)?.id || null;
        if (
          name === 'create_person' &&
          s
            .list('people')
            .some(
              (x) =>
                !x.archived &&
                ((p.email && x.email.toLowerCase() === p.email.toLowerCase()) ||
                  (x.name.toLowerCase() === p.name.toLowerCase() && x.companyId === p.companyId)),
            )
        )
          fail('ambiguous_match', 'A matching person already exists. Link or update the existing record.', 409);
        if (p.archived && p.enrollment?.status === 'active') this.changeSequence(p, 'pause', actor);
        return this.person(
          s.put('people', this.log(p, name === 'create_person' ? 'Person created' : 'Profile updated', actor)),
        );
      }
      case 'create_company':
      case 'update_company': {
        const old =
          name === 'update_company'
            ? this.record('companies', a.id, a.expectedVersion)
            : { id: randomUUID(), notes: [], links: [], website: '', context: '', archived: false };
        const { id, expectedVersion, requestId, ...fields } = a,
          c = { ...old, ...fields };
        c.name = text(c.name, 'Company name');
        c.website = webUrl(c.website);
        if (
          s.list('companies').some((x) => x.id !== c.id && !x.archived && x.name.toLowerCase() === c.name.toLowerCase())
        )
          fail('ambiguous_match', 'A company with this name already exists.', 409);
        return s.put('companies', c);
      }
      case 'add_note': {
        const r = this.record(a.collection, a.id);
        r.notes = [{ id: randomUUID(), text: text(a.text, 'Note'), date: this.day(), actor }, ...(r.notes || [])];
        return s.put(a.collection, r);
      }
      case 'add_profile_link': {
        const r = this.record(a.collection, a.id),
          url = webUrl(text(a.url, 'URL'));
        r.links = r.links || [];
        if (!r.links.some((l) => l.url === url)) r.links.push({ url, label: a.label?.trim() || new URL(url).hostname });
        return s.put(a.collection, r);
      }
      case 'move_pipeline_item': {
        const p = this.record('people', a.id, a.expectedVersion),
          stage = this.record('stages', a.stageId);
        p.stage = stage.id;
        return s.put('people', this.log(p, `Moved to ${stage.name}`, actor));
      }
      case 'update_stages': {
        const existing = s.list('stages');
        if (a.stages.length !== existing.length || new Set(a.stages.map((x) => x.id)).size !== existing.length)
          fail('validation_failed', 'Include every existing stage exactly once.');
        return a.stages.map((stage, index) =>
          s.put('stages', { ...this.record('stages', stage.id), name: text(stage.name, 'Stage name'), order: index }),
        );
      }
      case 'create_sequence':
      case 'update_sequence': {
        const old =
          name === 'update_sequence' ? this.record('sequences', a.id, a.expectedVersion) : { id: randomUUID() };
        return s.put('sequences', {
          ...old,
          name: text(a.name, 'Sequence name'),
          description: a.description || '',
          steps: a.steps.map((step) => ({ ...step, title: text(step.title, 'Step title') })),
        });
      }
      case 'enroll_in_sequence': {
        const p = this.record('people', a.personId),
          sequence = this.record('sequences', a.sequenceId);
        if (p.archived) fail('validation_failed', 'Restore this person before enrolling.');
        if (['active', 'paused'].includes(p.enrollment?.status) && !a.replace)
          fail('enrollment_exists', 'This person has a sequence. Set replace=true to replace it.', 409);
        s.list('tasks')
          .filter((t) => t.personId === p.id && t.enrollmentId && ['open', 'paused'].includes(t.status))
          .forEach((t) => s.put('tasks', { ...t, status: 'cancelled' }));
        p.enrollment = {
          id: randomUUID(),
          sequenceId: sequence.id,
          name: sequence.name,
          steps: structuredClone(sequence.steps),
          index: 0,
          status: 'active',
        };
        this.schedule(p);
        return s.put('people', this.log(p, `Enrolled in ${sequence.name}`, actor));
      }
      case 'sequence_event': {
        const p = this.record('people', a.personId);
        this.changeSequence(p, a.event, actor);
        return s.put('people', p);
      }
      case 'create_action': {
        const p = this.record('people', a.personId);
        if (p.archived) fail('validation_failed', 'Restore this person before adding actions.');
        return s.put('tasks', {
          id: randomUUID(),
          personId: a.personId,
          title: text(a.title, 'Action title'),
          channel: a.channel || 'Other',
          due: this.date(a.due),
          status: 'open',
        });
      }
      case 'update_action': {
        const t = this.record('tasks', a.id, a.expectedVersion);
        if (t.status !== 'open') fail('invalid_transition', 'Only open actions can be edited.', 409);
        const { id, requestId, expectedVersion, ...fields } = a;
        if (fields.title) fields.title = text(fields.title, 'Title');
        if (fields.due) fields.due = this.date(fields.due);
        return s.put('tasks', { ...t, ...fields });
      }
      case 'complete_action': {
        const t = this.record('tasks', a.id);
        if (t.status === 'done') return t;
        if (t.status !== 'open') fail('invalid_transition', 'Only open actions can be completed.', 409);
        const p = this.record('people', t.personId);
        t.status = 'done';
        t.completedAt = new Date().toISOString();
        this.log(p, `Completed: ${t.title}`, actor);
        if (t.enrollmentId === p.enrollment?.id && p.enrollment?.status === 'active') {
          p.enrollment.index++;
          if (p.enrollment.index < p.enrollment.steps.length) this.schedule(p);
          else {
            p.enrollment.status = 'completed';
            this.log(p, `Finished ${p.enrollment.name}`, actor);
          }
        }
        s.put('people', p);
        return s.put('tasks', t);
      }
      case 'create_research':
      case 'update_research': {
        const old =
          name === 'update_research'
            ? this.record('research', a.id, a.expectedVersion)
            : { id: randomUUID(), targets: [], findings: [], summary: '', tags: [], status: 'Exploring' };
        const { id, expectedVersion, requestId, ...fields } = a;
        const r = { ...old, ...fields };
        r.title = text(r.title, 'Title');
        r.question = text(r.question, 'Question');
        return s.put('research', r);
      }
      case 'add_research_subject':
      case 'update_research_subject': {
        const r = this.record('research', a.researchId, a.expectedVersion),
          old = name === 'update_research_subject' ? r.targets.find((t) => t.id === a.id) : null;
        if (name === 'update_research_subject' && !old) fail('not_found', 'Subject not found.', 404);
        const t = {
          id: old?.id || randomUUID(),
          kind: a.kind,
          name: text(a.name, 'Subject name'),
          role: a.role || '',
          company: a.company || '',
          context: a.context || '',
          links: parseLinks(a.links),
          personId: null,
          companyId: null,
        };
        if (t.kind === 'Company') {
          if (a.personId) fail('validation_failed', 'A company subject cannot link to a person.');
          const c = a.companyId ? this.record('companies', a.companyId) : this.company(t.name, old?.companyId);
          t.companyId = c.id;
        } else {
          let p;
          if (a.personId) p = this.record('people', a.personId);
          else if (old?.personId) p = this.record('people', old.personId);
          else
            p = this.run(
              'create_person',
              { name: t.name, role: t.role, company: t.company, context: t.context, stage: null },
              actor,
            );
          t.personId = p.id;
          t.companyId = p.companyId;
        }
        if (old) r.targets = r.targets.map((x) => (x.id === t.id ? t : x));
        else r.targets.push(t);
        s.put('research', r);
        return t;
      }
      case 'add_research_finding': {
        const r = this.record('research', a.researchId);
        if (a.targetId && !r.targets.some((t) => t.id === a.targetId))
          fail('validation_failed', 'Subject is not in this research.');
        if (a.jobId) {
          const job = this.record('jobs', a.jobId);
          if (job.researchId !== r.id || job.claimedBy !== actor || job.status !== 'running')
            fail(
              'invalid_transition',
              'Finding job must be running, belong to this research, and be claimed by this actor.',
              409,
            );
        }
        const f = {
          id: randomUUID(),
          text: text(a.text, 'Finding'),
          kind: a.kind,
          targetId: a.targetId || null,
          sourceUrl: webUrl(a.sourceUrl),
          sourceReference: a.sourceReference || null,
          author: actor,
          createdAt: new Date().toISOString(),
          jobId: a.jobId || null,
        };
        r.findings.unshift(f);
        s.put('research', r);
        return f;
      }
      case 'promote_research_subject': {
        const r = this.record('research', a.researchId),
          t = r.targets.find((t) => t.id === a.targetId);
        if (t?.kind !== 'Person') fail('validation_failed', 'Choose a person subject.');
        const p = this.record('people', t.personId);
        if (!p.stage) {
          p.stage = s.list('stages').sort((a, b) => a.order - b.order)[0].id;
          this.log(p, `Added from research: ${r.title}`, actor);
          s.put('people', p);
        }
        return this.person(p);
      }
      case 'start_research_job': {
        this.record('research', a.researchId);
        return s.put('jobs', {
          id: randomUUID(),
          researchId: a.researchId,
          brief: text(a.brief, 'Brief'),
          status: 'queued',
          progress: 0,
          claimedBy: null,
          message: 'Waiting for an agent to claim this job.',
          initiatedBy: actor,
        });
      }
      case 'claim_research_job': {
        const j = this.record('jobs', a.id);
        if (j.status !== 'queued') fail('job_claimed', 'This job is no longer available.', 409);
        return s.put('jobs', {
          ...j,
          status: 'running',
          claimedBy: actor,
          message: 'Claimed by agent',
          claimedAt: new Date().toISOString(),
        });
      }
      case 'update_research_job': {
        const j = this.record('jobs', a.id);
        if (j.claimedBy !== actor && actor !== 'Owner')
          fail('permission_denied', 'Only the claiming agent or owner may update this job.', 403);
        if (!['queued', 'running'].includes(j.status)) fail('invalid_transition', 'This job is already finished.', 409);
        if (j.status === 'queued' && a.status !== 'cancelled')
          fail('invalid_transition', 'Claim the job before reporting progress.', 409);
        return s.put('jobs', {
          ...j,
          status: a.status,
          progress: a.status === 'completed' ? 100 : (a.progress ?? j.progress),
          message: a.message ?? j.message,
        });
      }
      default:
        fail('not_found', 'Unknown operation.', 404);
    }
  }
  schedule(person) {
    const e = person.enrollment,
      step = e.steps[e.index];
    return this.store.put('tasks', {
      id: randomUUID(),
      personId: person.id,
      title: step.title,
      channel: step.channel,
      due: this.day(step.delay),
      status: 'open',
      sequenceId: e.sequenceId,
      enrollmentId: e.id,
      stepIndex: e.index,
    });
  }
  changeSequence(person, event, actor) {
    const e = person.enrollment;
    if (!e || !['active', 'paused'].includes(e.status))
      fail('invalid_transition', 'There is no active or paused sequence.', 409);
    if (event === 'resume') {
      if (e.status !== 'paused') fail('invalid_transition', 'Sequence is not paused.', 409);
      e.status = 'active';
      this.store
        .list('tasks')
        .filter((t) => t.enrollmentId === e.id && t.status === 'paused')
        .forEach((t) =>
          this.store.put('tasks', { ...t, status: 'open', due: t.due < this.day() ? this.day() : t.due }),
        );
      this.log(person, 'Sequence resumed', actor);
    } else {
      e.status = 'paused';
      this.store
        .list('tasks')
        .filter((t) => t.enrollmentId === e.id && t.status === 'open')
        .forEach((t) => this.store.put('tasks', { ...t, status: 'paused' }));
      this.log(person, event === 'reply' ? 'Reply recorded · sequence paused' : 'Sequence paused', actor);
    }
  }
  importWorkspace(input, context) {
    if (!context.scopes?.includes('admin')) fail('permission_denied', 'Owner access is required.', 403);
    if (
      !input ||
      input.version !== 1 ||
      !['people', 'stages', 'sequences', 'tasks'].every((k) => Array.isArray(input[k]))
    )
      fail('validation_failed', 'Choose a Fieldwork workspace export.');
    const allowed = new Set(['people', 'stages', 'sequences', 'tasks', 'companies', 'research', 'jobs']);
    for (const k of allowed)
      if (input[k] && (!Array.isArray(input[k]) || input[k].length > 10000))
        fail('validation_failed', 'Import collections must be arrays of at most 10,000 records.');
    return this.store.transaction(() => {
      if (
        this.store.list('people').length ||
        this.store.list('companies').length ||
        this.store.list('research').length ||
        this.store.meta('imported')
      )
        fail('import_conflict', 'Import is available only in an empty workspace.', 409);
      if (context.expectedRevision !== undefined && context.expectedRevision !== this.store.revision())
        fail('version_conflict', 'Workspace changed before import.', 409);
      const safeId = (value) => {
        if (typeof value !== 'string' || !value || value.length > 150)
          fail('validation_failed', 'Each imported record needs a valid ID.');
        return value;
      };
      const checkUnique = (items) => {
        const ids = items.map((x) => safeId(x.id));
        if (new Set(ids).size !== ids.length) fail('validation_failed', 'Duplicate IDs in import.');
      };
      for (const k of allowed) checkUnique(input[k] || []);
      if (!input.stages.length) fail('validation_failed', 'Import needs pipeline stages.');
      this.store.db.exec('DELETE FROM stages; DELETE FROM sequences;');
      input.stages.forEach((r, index) =>
        this.store.put('stages', {
          id: r.id,
          name: text(r.name, 'Stage name'),
          color: /^#[0-9a-fA-F]{6}$/.test(r.color) ? r.color : '#92a788',
          order: index,
        }),
      );
      const validNotes = (notes) =>
        (notes || []).map((n) => ({
          id: n.id || randomUUID(),
          text: text(n.text, 'Note'),
          date: n.date || this.day(),
          actor: n.actor || 'Imported',
        }));
      for (const c of input.companies || [])
        this.store.put('companies', {
          id: c.id,
          name: text(c.name, 'Company name'),
          website: webUrl(c.website),
          context: c.context || '',
          notes: validNotes(c.notes),
          links: (c.links || []).map((l) => ({ url: webUrl(l.url), label: l.label || 'Profile' })),
          archived: !!c.archived,
        });
      // Preserve template IDs needed by existing enrollments.
      this.store.db.exec('DELETE FROM sequences;');
      for (const r of input.sequences)
        this.store.put('sequences', {
          id: r.id,
          name: text(r.name, 'Sequence'),
          description: r.description || '',
          steps: this.validateImportedSteps(r.steps),
        });
      for (const r of input.people) {
        const company = this.company(r.company, r.companyId);
        if (r.stage) this.record('stages', r.stage);
        const p = {
          id: r.id,
          name: text(r.name, 'Name'),
          role: r.role || '',
          companyId: company?.id || null,
          email: r.email || '',
          type: r.type || 'Prospect',
          stage: r.stage || null,
          context: r.context || '',
          personal: r.personal || '',
          notes: validNotes(r.notes),
          links: (r.links || []).map((l) => ({ url: webUrl(l.url), label: l.label || 'Profile' })),
          history: Array.isArray(r.history) ? r.history : [],
          color: Number.isInteger(r.color) ? r.color : 0,
          archived: !!r.archived,
          enrollment: r.enrollment ? { ...r.enrollment, steps: this.validateImportedSteps(r.enrollment.steps) } : null,
        };
        if (
          p.enrollment &&
          (typeof p.enrollment.index !== 'number' ||
            p.enrollment.index < 0 ||
            p.enrollment.index > p.enrollment.steps.length ||
            !['active', 'paused', 'completed'].includes(p.enrollment.status))
        )
          fail('validation_failed', 'Invalid sequence enrollment in import.');
        this.store.put('people', p);
      }
      for (const r of input.tasks) {
        this.record('people', r.personId);
        if (!['open', 'paused', 'done', 'cancelled'].includes(r.status))
          fail('validation_failed', 'Invalid action status.');
        this.store.put('tasks', { ...r, title: text(r.title, 'Action title'), due: this.date(r.due) });
      }
      for (const r of input.research || []) {
        const targets = [];
        this.store.put('research', {
          id: r.id,
          title: text(r.title, 'Research title'),
          question: text(r.question, 'Research question'),
          summary: typeof r.summary === 'string' ? r.summary.slice(0, 10000) : '',
          tags: Array.isArray(r.tags) ? r.tags.filter((t) => typeof t === 'string').slice(0, 30).map((t) => t.slice(0, 200)) : [],
          status: ['Exploring', 'Waiting', 'Ready', 'Archived'].includes(r.status) ? r.status : 'Exploring',
          targets: [],
          findings: [],
        });
        for (const t of r.targets || []) {
          const args = present({
            researchId: r.id,
            kind: t.kind,
            name: t.name,
            role: t.role,
            company: t.company,
            context: t.context,
            links: (t.links || []).map((l) => l.url).join('\n'),
            personId: t.personId || undefined,
            companyId: t.companyId || undefined,
          });
          const result = this.run('add_research_subject', args, 'Owner');
          targets.push({ ...result, id: safeId(t.id) });
        }
        const current = this.record('research', r.id);
        current.targets = targets;
        this.store.put('research', current);
        for (const f of [...(r.findings || [])].reverse()) {
          const imported = this.run(
            'add_research_finding',
            present({
              researchId: r.id,
              text: f.text,
              kind: f.kind,
              targetId: f.targetId || undefined,
              sourceUrl: f.sourceUrl || '',
              sourceReference: f.sourceReference,
            }),
            'Owner',
          );
          const updated = this.record('research', r.id);
          updated.findings = updated.findings.map((finding) =>
            finding.id === imported.id
              ? {
                  ...finding,
                  id: f.id || imported.id,
                  author: `Imported: ${f.author || 'Owner'}`,
                  createdAt: f.createdAt || imported.createdAt,
                }
              : finding,
          );
          this.store.put('research', updated);
        }
      }
      this.store.setMeta('imported', '1');
      this.store.audit('Owner', 'import_workspace', null, { people: input.people.length });
      this.store.bump();
      return { data: this.workspace(), revision: this.store.revision() };
    });
  }
  validateImportedSteps(steps) {
    if (
      !Array.isArray(steps) ||
      !steps.length ||
      steps.length > 30 ||
      steps.some(
        (x) =>
          typeof x.title !== 'string' ||
          !x.title.trim() ||
          !Number.isInteger(x.delay) ||
          x.delay < 0 ||
          x.delay > 365 ||
          !['Email', 'LinkedIn', 'Call', 'Meeting', 'Research', 'Other'].includes(x.channel),
      )
    )
      fail('validation_failed', 'Invalid sequence steps in import.');
    return steps;
  }
}

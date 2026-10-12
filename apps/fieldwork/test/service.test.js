import test from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../server/store.js';
import { Service } from '../server/service.js';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const owner = { actor: 'Owner', scopes: ['read', 'write', 'admin'] };
function setup(t) {
  const store = new Store(':memory:');
  t.after(() => store.close());
  const service = new Service(store);
  return { store, service, run: (name, a, ctx = owner) => service.execute(name, a, ctx).data };
}
test('server persistence and normalized companies survive reopening', (t) => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'fieldwork-test-')),
    filename = path.join(dir, 'crm.sqlite');
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  let store = new Store(filename),
    service = new Service(store);
  const p = service.execute('create_person', { name: 'Ada', company: 'Example Studio' }, owner).data;
  store.close();
  store = new Store(filename);
  t.after(() => store.close());
  service = new Service(store);
  assert.equal(service.workspace().people[0].id, p.id);
  assert.equal(service.workspace().companies.length, 1);
  assert.equal(store.events()[0].actor, 'Owner');
});
test('sequence completion is atomic and replay never creates another next action', (t) => {
  const { service, run } = setup(t);
  const p = run('create_person', { name: 'Ada' });
  run('enroll_in_sequence', { personId: p.id, sequenceId: 'warm' });
  assert.throws(
    () => run('enroll_in_sequence', { personId: p.id, sequenceId: 'warm' }),
    (e) => e.code === 'enrollment_exists',
  );
  const first = service.workspace().tasks[0];
  run('complete_action', { id: first.id });
  run('complete_action', { id: first.id });
  assert.equal(service.workspace().tasks.length, 2);
  assert.equal(service.workspace().people[0].enrollment.index, 1);
  const step = service.workspace().tasks.find((t) => t.status === 'open');
  assert.equal(step.due, service.day(3));
  run('sequence_event', { personId: p.id, event: 'reply' });
  assert.equal(service.workspace().tasks.find((t) => t.id === step.id).status, 'paused');
  assert.throws(
    () => run('complete_action', { id: step.id }),
    (e) => e.code === 'invalid_transition',
  );
  run('sequence_event', { personId: p.id, event: 'resume' });
  run('complete_action', { id: step.id });
  const last = service.workspace().tasks.find((t) => t.status === 'open');
  run('complete_action', { id: last.id });
  assert.equal(service.workspace().people[0].enrollment.status, 'completed');
});
test('validation, duplicate protection, idempotency and stale versions roll back', (t) => {
  const { service, store, run } = setup(t),
    ctx = { ...owner, idempotencyKey: 'telegram-1' };
  const a = service.execute('create_person', { name: 'Ada', company: 'Studio' }, ctx),
    revision = store.revision();
  const replay = service.execute('create_person', { name: 'Ada', company: 'Studio' }, ctx);
  assert.equal(replay.data.id, a.data.id);
  assert.equal(replay.replayed, true);
  assert.equal(store.revision(), revision);
  assert.throws(
    () => run('create_person', { name: 'Other' }, ctx),
    (e) => e.code === 'idempotency_conflict',
  );
  assert.throws(
    () => run('update_person', { id: a.data.id, name: 'Bad', expectedVersion: 999 }),
    (e) => e.code === 'version_conflict',
  );
  assert.throws(() => run('create_person', { name: 'Bad', company: 'Should roll back', email: 'invalid' }));
  assert.equal(store.list('companies').length, 1);
  assert.throws(() => run('create_action', { personId: a.data.id, title: 'Call', due: '2026-02-30' }));
  assert.throws(
    () => run('create_person', { name: 'Actor injection', author: 'Admin' }),
    (e) => e.code === 'validation_failed',
  );
  assert.throws(
    () => run('create_person', { name: 'No permission' }, { actor: 'Agent', scopes: ['read'] }),
    (e) => e.code === 'permission_denied',
  );
  assert.throws(() => run('add_profile_link', { collection: 'people', id: a.data.id, url: 'javascript:alert(1)' }));
  assert.throws(
    () => run('create_person', { name: 'Stale' }, { ...owner, expectedRevision: 0 }),
    (e) => e.code === 'version_conflict',
  );
});
test('research-only identities can be promoted without losing findings; jobs have exclusive ownership', (t) => {
  const { service, run } = setup(t),
    agent = { actor: 'Agent: Hermes', scopes: ['read', 'write'] };
  const r = run('create_research', { title: 'Studios', question: 'Who could use an introduction?' });
  const t1 = run('add_research_subject', {
    researchId: r.id,
    kind: 'Person',
    name: 'Sofia',
    company: 'Studio',
    links: 'https://example.com/profile',
  });
  assert.equal(service.workspace().people[0].stage, null);
  const job = run('start_research_job', { researchId: r.id, brief: 'Find their priorities' });
  run('claim_research_job', { id: job.id }, agent);
  assert.throws(
    () => run('claim_research_job', { id: job.id }, owner),
    (e) => e.code === 'job_claimed',
  );
  assert.throws(
    () => run('update_research_job', { id: job.id, status: 'completed' }, { actor: 'Agent: Other', scopes: ['write'] }),
    (e) => e.code === 'permission_denied',
  );
  const finding = run(
    'add_research_finding',
    {
      researchId: r.id,
      text: 'Might be growing',
      kind: 'Hypothesis',
      targetId: t1.id,
      sourceUrl: 'https://example.com/news',
      jobId: job.id,
    },
    agent,
  );
  assert.equal(finding.author, agent.actor);
  run('update_research_job', { id: job.id, status: 'completed' }, agent);
  const p = run('promote_research_subject', { researchId: r.id, targetId: t1.id });
  run('promote_research_subject', { researchId: r.id, targetId: t1.id });
  assert.equal(service.workspace().people.length, 1);
  assert.equal(p.stage, 'new');
  assert.equal(service.workspace().research[0].findings.length, 1);
});
test('legacy import preserves IDs and rejects invalid snapshots without partial changes', (t) => {
  const { service, store } = setup(t);
  const input = {
    version: 1,
    people: [{ id: 'p1', name: 'Sofia', company: 'Studio', stage: 'new', notes: [{ text: 'Remember this' }] }],
    stages: [{ id: 'new', name: 'New prospects' }],
    sequences: [],
    tasks: [{ id: 't1', personId: 'p1', title: 'Call', due: '2026-10-12', status: 'open' }],
    research: [
      {
        id: 'r1',
        title: 'Studios',
        question: 'Who to approach?',
        targets: [{ id: 'subject', kind: 'Person', name: 'Sofia', personId: 'p1', links: [] }],
        findings: [{ text: 'Priority?', kind: 'Question', targetId: 'subject' }],
      },
    ],
  };
  const bad = structuredClone(input);
  bad.tasks[0].personId = 'missing';
  assert.throws(() => service.importWorkspace(bad, owner));
  assert.equal(store.list('people').length, 0);
  assert.equal(store.list('stages').length, 5);
  service.importWorkspace(input, owner);
  assert.equal(service.workspace().people[0].id, 'p1');
  assert.equal(service.workspace().people[0].notes[0].text, 'Remember this');
  assert.equal(service.workspace().research[0].targets[0].personId, 'p1');
  assert.throws(
    () => service.importWorkspace(input, owner),
    (e) => e.code === 'import_conflict',
  );
});
test('JSON export round-trip preserves company notes, links and finding origin', (t) => {
  const { service, run } = setup(t);
  const company = run('create_company', { name: 'Studio', website: 'https://example.com' });
  run('add_note', { collection: 'companies', id: company.id, text: 'Company note' });
  run('add_profile_link', { collection: 'companies', id: company.id, url: 'https://example.com/team' });
  const person = run('create_person', { name: 'Contact', companyId: company.id });
  const research = run('create_research', { title: 'Studio', question: 'Priorities?' });
  const subject = run('add_research_subject', {
    researchId: research.id,
    kind: 'Person',
    name: person.name,
    personId: person.id,
  });
  const finding = run('add_research_finding', {
    researchId: research.id,
    text: 'An open question',
    kind: 'Question',
    targetId: subject.id,
    sourceReference: 'telegram:example',
  });
  const other = new Store(':memory:');
  t.after(() => other.close());
  const target = new Service(other);
  target.importWorkspace(service.workspace(), owner);
  const restored = target.workspace();
  assert.equal(restored.companies[0].notes[0].text, 'Company note');
  assert.equal(restored.companies[0].links.length, 1);
  assert.equal(restored.research[0].findings[0].sourceReference, 'telegram:example');
  assert.equal(restored.research[0].findings[0].createdAt, finding.createdAt);
  assert.equal(restored.people[0].companyId, company.id);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { putResearch, putTarget, addFinding, promoteTarget, webUrl } from './research-model.js';
const setup = () => {
  let index = 0;
  return {
    workspace: { research: [], people: [], stages: [{ id: 'new' }] },
    id: () => `test-${++index}`,
    date: '2026-10-12',
  };
};
test('parallel investigations, linked subjects, and sourced findings remain separate', () => {
  const { workspace, id, date } = setup();
  const first = putResearch(
    workspace,
    { title: 'Studios', question: 'Who to approach?', status: 'Exploring' },
    null,
    id,
    date,
  );
  const second = putResearch(
    workspace,
    { title: 'Consultants', question: 'Who to reconnect with?', status: 'Waiting' },
    null,
    id,
    date,
  );
  const company = putTarget(
    workspace,
    first.id,
    { kind: 'Company', name: 'Studio A', links: 'https://example.com\nhttps://example.com' },
    null,
    id,
    date,
  );
  const person = putTarget(
    workspace,
    first.id,
    { kind: 'Person', name: 'New Person', company: 'Studio A' },
    null,
    id,
    date,
  );
  const finding = addFinding(
    workspace,
    first.id,
    { text: 'May be growing', kind: 'Hypothesis', targetId: company.id, sourceUrl: 'https://example.com/news' },
    id,
    date,
  );
  assert.equal(company.links.length, 1);
  assert.equal(finding.kind, 'Hypothesis');
  assert.equal(second.findings.length, 0);
  const promoted = promoteTarget(workspace, first.id, person.id, id, date);
  assert.equal(promoted.stage, 'new');
  assert.equal(promoted.company, 'Studio A');
  assert.equal(promoteTarget(workspace, first.id, person.id, id, date).id, promoted.id);
  assert.equal(workspace.people.length, 1);
  assert.equal(first.findings.length, 1);
});
test('reject unsafe URLs, invalid references and ambiguous duplicate identities before mutation', () => {
  const { workspace, id, date } = setup();
  const research = putResearch(workspace, { title: 'Test', question: 'Explore', status: 'Exploring' }, null, id, date);
  for (const url of ['javascript:alert(1)', 'file:///tmp/data', 'https://user:secret@example.com', 'not a link'])
    assert.throws(() => webUrl(url));
  assert.throws(() =>
    putTarget(workspace, research.id, { kind: 'Person', name: 'A', links: 'javascript:alert(1)' }, null, id, date),
  );
  assert.equal(research.targets.length, 0);
  assert.throws(() =>
    addFinding(workspace, research.id, { text: 'Claim', kind: 'Observation', targetId: 'missing' }, id, date),
  );
  assert.equal(research.findings.length, 0);
  workspace.people.push({ id: 'existing', name: 'A' });
  const subject = putTarget(workspace, research.id, { kind: 'Person', name: 'A' }, null, id, date);
  assert.throws(() => promoteTarget(workspace, research.id, subject.id, id, date), /already exists/);
  assert.equal(workspace.people.length, 1);
  putTarget(workspace, research.id, { kind: 'Person', name: 'A', personId: 'existing' }, subject.id, id, date);
  assert.equal(promoteTarget(workspace, research.id, subject.id, id, date).id, 'existing');
});

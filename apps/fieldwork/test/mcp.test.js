import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Store } from '../server/store.js';
import { Service } from '../server/service.js';
import { createApp } from '../server/http.js';
test('real MCP client discovers tools and creates, researches, moves, and schedules records via the API', async (t) => {
  const store = new Store(':memory:'),
    service = new Service(store),
    { server, auth } = createApp(service);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(
    () =>
      new Promise((resolve) =>
        server.close(() => {
          store.close();
          resolve();
        }),
      ),
  );
  const token = auth.createToken('Integration test', ['read', 'write']).token;
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL('../server/mcp.js', import.meta.url))],
    env: { ...process.env, FIELDWORK_API_URL: `http://127.0.0.1:${server.address().port}`, FIELDWORK_API_TOKEN: token },
    stderr: 'pipe',
  });
  const client = new Client({ name: 'fieldwork-integration-test', version: '1.0.0' });
  t.after(() => client.close());
  await client.connect(transport);
  const tools = await client.listTools();
  assert.ok(tools.tools.some((tool) => tool.name === 'add_research_finding'));
  async function call(name, args) {
    const result = await client.callTool({ name, arguments: args });
    assert.ok(!result.isError, result.content[0].text);
    return JSON.parse(result.content[0].text).data;
  }
  const person = await call('create_person', { name: 'Voice note prospect', requestId: 'telegram-test-person' });
  const again = await call('create_person', { name: 'Voice note prospect', requestId: 'telegram-test-person' });
  assert.equal(again.id, person.id);
  await call('move_pipeline_item', { id: person.id, stageId: 'contacted' });
  const research = await call('create_research', {
    title: 'Voice note research',
    question: 'What are their priorities?',
  });
  const subject = await call('add_research_subject', {
    researchId: research.id,
    kind: 'Person',
    name: person.name,
    personId: person.id,
  });
  const finding = await call('add_research_finding', {
    researchId: research.id,
    targetId: subject.id,
    text: 'May need help with growth',
    kind: 'Hypothesis',
    sourceUrl: 'https://example.com',
  });
  assert.match(finding.author, /Agent: Integration test/);
  await call('create_action', { personId: person.id, title: 'Follow up', due: '2026-10-16', channel: 'Email' });
  assert.equal(service.workspace().people[0].stage, 'contacted');
  assert.equal(service.workspace().tasks.length, 1);
});

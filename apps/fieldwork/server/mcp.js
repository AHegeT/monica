import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const url = new URL(process.env.FIELDWORK_API_URL || 'http://localhost:4178');
if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
  throw Error('Use an HTTP(S) API URL without credentials.');
if (url.protocol === 'http:' && !['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname))
  throw Error('Remote API connections require HTTPS.');
const token = process.env.FIELDWORK_API_TOKEN;
if (!token) throw Error('Set FIELDWORK_API_TOKEN to a credential created in Fieldwork Agent access.');
async function request(endpoint, body, requestId) {
  const response = await fetch(new URL(endpoint, url), {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(requestId ? { 'Idempotency-Key': requestId } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000),
  });
  const result = await response.json();
  if (!response.ok)
    throw Error(`${result.error?.code || response.status}: ${result.error?.message || 'API request failed'}`);
  return result;
}
const schema = await request('/api/v1/schema');
const server = new Server({ name: 'fieldwork-crm', version: '0.1.0' }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: schema.data.map(({ name, description, inputSchema, scope }) => ({
    name,
    description,
    inputSchema,
    annotations: {
      readOnlyHint: scope === 'read',
      destructiveHint: false,
      idempotentHint: scope === 'read' || ['complete_action', 'promote_research_subject'].includes(name),
      openWorldHint: false,
    },
  })),
}));
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const args = request.params.arguments || {};
    const result = await requestApi(request.params.name, args);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  } catch (error) {
    return { isError: true, content: [{ type: 'text', text: error.message }] };
  }
});
async function requestApi(name, args) {
  if (!schema.data.some((op) => op.name === name)) throw Error('Unknown Fieldwork tool');
  return request(`/api/v1/commands/${encodeURIComponent(name)}`, args, args.requestId);
}
await server.connect(new StdioServerTransport());

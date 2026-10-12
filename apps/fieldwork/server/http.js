import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Auth } from './auth.js';
import { AppError } from './service.js';
import { operations, publicOperations } from './contracts.js';

const root = new URL('../public/', import.meta.url);
const staticFiles = new Map(
  ['index.html', 'app.js', 'api.js', 'research.js', 'research-model.js', 'manage.js', 'styles.css'].map((file) => [
    `/${file}`,
    file,
  ]),
);
staticFiles.set('/', 'index.html');
const json = (res, status, body, headers = {}) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(body));
};
const deny = (code, message, status = 403) => {
  throw new AppError(code, message, status);
};
async function body(req) {
  if (!req.headers['content-type']?.startsWith('application/json'))
    deny('validation_failed', 'Send application/json.', 415);
  let bytes = 0,
    buffer = [];
  for await (const part of req) {
    bytes += part.length;
    if (bytes > 5 * 1024 * 1024) deny('payload_too_large', 'Maximum request size is 5 MB.', 413);
    buffer.push(part);
  }
  try {
    return JSON.parse(Buffer.concat(buffer).toString() || '{}');
  } catch {
    deny('validation_failed', 'Invalid JSON.', 400);
  }
}
const admin = (context) => {
  if (!context.scopes.includes('admin')) deny('permission_denied', 'Owner access required.');
};
export function createApp(service, options = {}) {
  const { origin = 'http://localhost:4178', mode = 'local', password, secureCookie = false } = options;
  const auth = new Auth(service.store, { mode, password, secureCookie });
  const expectedOrigin = new URL(origin).origin;
  const failures = new Map();
  const server = http.createServer(async (req, res) => {
    const requestId = randomUUID();
    res.setHeader('X-Request-Id', requestId);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    );
    try {
      const incomingHost = req.headers.host;
      const allowedHosts = new Set([new URL(origin).host]);
      if (mode === 'local') {
        const p = new URL(origin).port;
        allowedHosts.add(`127.0.0.1${p ? `:${p}` : ''}`);
        const actualPort = server.address()?.port;
        if (actualPort) {
          allowedHosts.add(`localhost:${actualPort}`);
          allowedHosts.add(`127.0.0.1:${actualPort}`);
        }
      }
      if (!allowedHosts.has(incomingHost)) deny('invalid_host', 'Unexpected host header.');
      const url = new URL(req.url, origin),
        pathname = url.pathname;
      if (
        req.headers.origin &&
        req.headers.origin !== expectedOrigin &&
        !(mode === 'local' && [...allowedHosts].some((host) => req.headers.origin === `http://${host}`))
      )
        deny('invalid_origin', 'Cross-origin requests are not allowed.');
      if (pathname === '/health' && req.method === 'GET') {
        json(res, 200, { status: 'ok' });
        return;
      }
      if (pathname === '/auth/status' && req.method === 'GET') {
        let signedIn = false;
        try {
          auth.authenticate(req);
          signedIn = true;
        } catch {}
        json(res, 200, { mode, signedIn, timezone: service.timezone });
        return;
      }
      const isWrite = !['GET', 'HEAD'].includes(req.method);
      if (isWrite && !req.headers.authorization && req.headers['x-fieldwork-client'] !== 'web')
        deny('csrf_failed', 'Web requests require the Fieldwork client header.');
      if (pathname === '/auth/local' && req.method === 'POST') {
        if (mode !== 'local' || !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress))
          deny('permission_denied', 'Local login is unavailable.');
        json(res, 200, { signedIn: true }, { 'Set-Cookie': auth.session().cookie });
        return;
      }
      if (pathname === '/auth/login' && req.method === 'POST') {
        const input = await body(req),
          address = req.socket.remoteAddress,
          bucket = failures.get(address) || { count: 0, until: 0 };
        if (bucket.until > Date.now()) deny('rate_limited', 'Too many attempts. Try again in 15 minutes.', 429);
        if (typeof input.password !== 'string' || input.password.length > 512 || !auth.login(input.password)) {
          bucket.count++;
          if (bucket.count >= 5) bucket.until = Date.now() + 15 * 60 * 1000;
          failures.set(address, bucket);
          deny('unauthenticated', 'Incorrect password.', 401);
        }
        failures.delete(address);
        json(res, 200, { signedIn: true }, { 'Set-Cookie': auth.session().cookie });
        return;
      }
      if (pathname === '/auth/logout' && req.method === 'POST') {
        json(res, 200, { signedIn: false }, { 'Set-Cookie': auth.logout(req) });
        return;
      }
      if (staticFiles.has(pathname) && ['GET', 'HEAD'].includes(req.method)) {
        const file = staticFiles.get(pathname),
          bytes = await readFile(new URL(file, root));
        res.writeHead(200, {
          'Content-Type': file.endsWith('.js')
            ? 'text/javascript; charset=utf-8'
            : file.endsWith('.css')
              ? 'text/css; charset=utf-8'
              : 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache',
        });
        res.end(req.method === 'HEAD' ? undefined : bytes);
        return;
      }
      const context = auth.authenticate(req);
      if (req.headers['if-match'] !== undefined) {
        const number = Number(req.headers['if-match'].replaceAll('"', ''));
        if (!Number.isInteger(number) || number < 0)
          deny('validation_failed', 'If-Match must contain the workspace revision.', 400);
        context.expectedRevision = number;
      }
      context.idempotencyKey = req.headers['idempotency-key'];
      if (pathname === '/api/v1/workspace' && req.method === 'GET') {
        if (!context.scopes.includes('read')) deny('permission_denied', 'Read scope required.');
        json(
          res,
          200,
          { data: service.workspace(), revision: service.store.revision() },
          { ETag: `"${service.store.revision()}"` },
        );
        return;
      }
      if (pathname === '/api/v1/workspace/import' && req.method === 'POST') {
        json(res, 200, service.importWorkspace(await body(req), context));
        return;
      }
      if (pathname === '/api/v1/audit' && req.method === 'GET') {
        admin(context);
        json(res, 200, { data: service.store.events() });
        return;
      }
      if (pathname === '/api/v1/tokens' && req.method === 'GET') {
        admin(context);
        json(res, 200, { data: auth.tokens() });
        return;
      }
      if (pathname === '/api/v1/tokens' && req.method === 'POST') {
        admin(context);
        const input = await body(req);
        json(res, 201, { data: auth.createToken(input.name, input.scopes) });
        return;
      }
      if (/^\/api\/v1\/tokens\/[^/]+\/revoke$/.test(pathname) && req.method === 'POST') {
        admin(context);
        auth.revoke(pathname.split('/')[4]);
        json(res, 200, { data: { revoked: true } });
        return;
      }
      if (pathname === '/api/v1/schema' && req.method === 'GET') {
        if (!context.scopes.includes('read')) deny('permission_denied', 'Read scope required.');
        json(res, 200, { data: publicOperations.filter((op) => context.scopes.includes(op.scope)) });
        return;
      }
      if (pathname === '/api/v1/openapi.json' && req.method === 'GET') {
        if (!context.scopes.includes('read')) deny('permission_denied', 'Read scope required.');
        json(res, 200, openApi(origin));
        return;
      }
      if (pathname.startsWith('/api/v1/commands/') && req.method === 'POST') {
        const name = pathname.split('/').at(-1),
          input = await body(req);
        json(res, 200, service.execute(name, input, context));
        return;
      }
      const parts = pathname.split('/').filter(Boolean);
      if (parts[0] === 'api' && parts[1] === 'v1') {
        const [, , collection, id, sub] = parts;
        const mapping = {
          people: 'person',
          companies: 'company',
          research: 'research',
          tasks: 'action',
          sequences: 'sequence',
        };
        let operation, input;
        if (
          req.method === 'GET' &&
          ['people', 'companies', 'research', 'tasks', 'sequences', 'jobs', 'stages'].includes(collection) &&
          parts.length <= 4
        ) {
          operation = id ? 'get_record' : 'list_records';
          input = id ? { collection, id } : { collection, ...Object.fromEntries(url.searchParams) };
          for (const key of ['limit', 'cursor']) if (input[key] !== undefined) input[key] = Number(input[key]);
        } else if (req.method === 'POST' && !id && mapping[collection]) {
          operation = `create_${mapping[collection]}`;
          input = await body(req);
        } else if (req.method === 'PATCH' && id && mapping[collection]) {
          operation = `update_${mapping[collection]}`;
          input = { ...(await body(req)), id };
        } else if (req.method === 'POST' && id && sub === 'notes' && ['people', 'companies'].includes(collection)) {
          operation = 'add_note';
          input = { ...(await body(req)), collection, id };
        } else if (req.method === 'POST' && id && sub === 'links' && ['people', 'companies'].includes(collection)) {
          operation = 'add_profile_link';
          input = { ...(await body(req)), collection, id };
        } else if (req.method === 'POST' && id && collection === 'people' && sub === 'transitions') {
          operation = 'move_pipeline_item';
          input = { ...(await body(req)), id };
        } else if (req.method === 'POST' && id && collection === 'tasks' && sub === 'completions') {
          operation = 'complete_action';
          input = { ...(await body(req)), id };
        } else if (
          req.method === 'POST' &&
          id &&
          collection === 'research' &&
          ['subjects', 'findings', 'jobs'].includes(sub)
        ) {
          operation = {
            subjects: 'add_research_subject',
            findings: 'add_research_finding',
            jobs: 'start_research_job',
          }[sub];
          input = { ...(await body(req)), researchId: id };
        }
        if (operation) {
          json(res, req.method === 'POST' ? 201 : 200, service.execute(operation, input, context));
          return;
        }
      }
      deny('not_found', 'Endpoint not found.', 404);
    } catch (error) {
      const known = error instanceof AppError || /https|http|link/.test(error.message);
      const status = error instanceof AppError ? error.status : known ? 422 : 500;
      if (!known) console.error(`Request ${requestId} failed:`, error.message);
      json(res, status, {
        error: {
          code: error instanceof AppError ? error.code : known ? 'validation_failed' : 'internal_error',
          message: known ? error.message : 'The request could not be completed.',
          details: error.details,
          requestId,
        },
      });
    }
  });
  return { server, auth };
}
function openApi(origin) {
  return {
    openapi: '3.1.0',
    info: { title: 'Fieldwork CRM', version: '0.1.0' },
    servers: [{ url: origin }],
    components: { securitySchemes: { agentToken: { type: 'http', scheme: 'bearer' } } },
    security: [{ agentToken: [] }],
    paths: Object.fromEntries(
      publicOperations.map((op) => [
        `/api/v1/commands/${op.name}`,
        {
          post: {
            operationId: op.name,
            summary: op.description,
            requestBody: { required: true, content: { 'application/json': { schema: op.inputSchema } } },
            responses: {
              200: { description: 'Operation result and workspace revision' },
              401: { description: 'Authentication required' },
              409: { description: 'Version, identity, or request conflict' },
              422: { description: 'Validation failed' },
            },
          },
        },
      ]),
    ),
  };
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../server/store.js';
import { Service } from '../server/service.js';
import { createApp } from '../server/http.js';
import { request as httpRequest } from 'node:http';
function rawFetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const request = httpRequest(url, { method: options.method || 'GET', headers: options.headers }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () =>
        resolve({
          status: response.statusCode,
          headers: new Headers(response.headers),
          json: async () => JSON.parse(Buffer.concat(chunks).toString()),
        }),
      );
    });
    request.on('error', reject);
    request.end(options.body);
  });
}
test('HTTP auth, scopes, CSRF, host checks, API mutations, and token revocation', async (t) => {
  const store = new Store(':memory:');
  const service = new Service(store);
  const origin = 'http://localhost:4199';
  const { server, auth } = createApp(service, { origin });
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
  const url = `http://127.0.0.1:${server.address().port}`,
    headers = { Host: 'localhost:4199', 'Content-Type': 'application/json', 'X-Fieldwork-Client': 'web' };
  const call = (endpoint, options = {}) =>
    rawFetch(url + endpoint, { ...options, headers: { ...headers, ...options.headers } });
  assert.equal((await call('/api/v1/workspace')).status, 401);
  assert.equal(
    (await call('/auth/local', { method: 'POST', headers: { 'X-Fieldwork-Client': '' }, body: '{}' })).status,
    403,
  );
  assert.equal(
    (await call('/auth/local', { method: 'POST', headers: { Origin: 'https://evil.example' }, body: '{}' })).status,
    403,
  );
  assert.equal((await call('/health', { headers: { Host: 'evil.example' } })).status, 403);
  const login = await call('/auth/local', { method: 'POST', body: '{}' }),
    cookie = login.headers.get('set-cookie').split(';')[0];
  assert.equal(login.status, 200);
  const created = await call('/api/v1/people', {
    method: 'POST',
    headers: { Cookie: cookie },
    body: JSON.stringify({ name: 'API person' }),
  });
  assert.equal(created.status, 201);
  const person = (await created.json()).data;
  const credential = auth.createToken('Read only', ['read']);
  assert.equal(
    (await call(`/api/v1/people/${person.id}`, { headers: { Authorization: `Bearer ${credential.token}` } })).status,
    200,
  );
  assert.equal(
    (
      await call('/api/v1/commands/create_person', {
        method: 'POST',
        headers: { Authorization: `Bearer ${credential.token}` },
        body: JSON.stringify({ name: 'Blocked' }),
      })
    ).status,
    403,
  );
  assert.equal(
    (await call('/api/v1/tokens', { headers: { Authorization: `Bearer ${credential.token}` } })).status,
    403,
  );
  auth.revoke(credential.id);
  assert.equal(
    (await call('/api/v1/workspace', { headers: { Authorization: `Bearer ${credential.token}` } })).status,
    401,
  );
  assert.equal((await call('/api/v1/openapi.json', { headers: { Cookie: cookie } })).status, 200);
  assert.equal((await call('/.data/fieldwork.sqlite')).status, 401);
});
test('password mode has no local bypass and rejects invalid passwords', async (t) => {
  const store = new Store(':memory:');
  const { server } = createApp(new Service(store), {
    origin: 'http://localhost:4199',
    mode: 'password',
    password: 'test-password-only-123',
  });
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
  const request = (endpoint, password) =>
    rawFetch(`http://127.0.0.1:${server.address().port}${endpoint}`, {
      method: 'POST',
      headers: { Host: 'localhost:4199', 'Content-Type': 'application/json', 'X-Fieldwork-Client': 'web' },
      body: JSON.stringify({ password }),
    });
  assert.equal((await request('/auth/local', '')).status, 403);
  assert.equal((await request('/auth/login', 'wrong')).status, 401);
  const response = await request('/auth/login', 'test-password-only-123');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('set-cookie'), /HttpOnly/);
});

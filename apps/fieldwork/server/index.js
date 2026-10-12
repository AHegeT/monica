import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Store } from './store.js';
import { Service } from './service.js';
import { createApp } from './http.js';
const root = fileURLToPath(new URL('../', import.meta.url));
const directory = process.env.FIELDWORK_DATA_DIR || path.join(root, '.data');
const host = process.env.HOST || '127.0.0.1',
  port = Number(process.env.PORT || 4178),
  mode = process.env.FIELDWORK_AUTH_MODE || 'local';
if (mode === 'local' && !['127.0.0.1', '::1'].includes(host))
  throw Error('Local authentication requires a loopback bind. Set password mode for hosting.');
const origin = process.env.FIELDWORK_ORIGIN || `http://localhost:${port}`;
if (
  mode === 'password' &&
  !['localhost', '127.0.0.1'].includes(new URL(origin).hostname) &&
  (!origin.startsWith('https://') || process.env.FIELDWORK_SECURE_COOKIE !== 'true')
)
  throw Error('Hosted password mode requires an HTTPS origin and secure cookies.');
const store = new Store(path.join(directory, 'fieldwork.sqlite'));
const service = new Service(store, { timezone: process.env.FIELDWORK_TIMEZONE || 'America/Mexico_City' });
const { server } = createApp(service, {
  origin,
  mode,
  password: process.env.FIELDWORK_PASSWORD,
  secureCookie: process.env.FIELDWORK_SECURE_COOKIE === 'true',
});
server.listen(port, host, () => console.log(`Fieldwork CRM: ${origin} (${mode} authentication)`));
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () =>
    server.close(() => {
      store.close();
      process.exit(0);
    }),
  );

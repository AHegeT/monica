import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { backup } from 'node:sqlite';
import { Store } from './store.js';
import { Auth } from './auth.js';
const root = fileURLToPath(new URL('../', import.meta.url)),
  directory = process.env.FIELDWORK_DATA_DIR || path.join(root, '.data');
const store = new Store(path.join(directory, 'fieldwork.sqlite'));
try {
  if (process.argv[2] === 'backup') {
    const folder = path.join(root, 'backups');
    mkdirSync(folder, { recursive: true, mode: 0o700 });
    const file = path.join(folder, `fieldwork-${new Date().toISOString().replaceAll(':', '-')}.sqlite`);
    await backup(store.db, file);
    chmodSync(file, 0o600);
    console.log(`Database backup saved: ${file}`);
  } else if (process.argv[2] === 'token') {
    const credential = new Auth(store).createToken(process.argv[3] || 'Hermes', ['read', 'write']);
    const file = path.join(directory, `agent-${credential.id}.env`);
    writeFileSync(
      file,
      `FIELDWORK_API_TOKEN=${credential.token}\nFIELDWORK_API_URL=${process.env.FIELDWORK_ORIGIN || 'http://localhost:4178'}\n`,
      { mode: 0o600 },
    );
    console.log(`Agent credential saved privately: ${file}`);
  } else throw Error('Use backup or token [agent-name].');
} finally {
  store.close();
}

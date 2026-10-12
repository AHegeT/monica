import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT || 4178);
const allowed = new Map([
  ['/', 'index.html'],
  ['/index.html', 'index.html'],
  ['/app.js', 'app.js'],
  ['/research.js', 'research.js'],
  ['/research-model.js', 'research-model.js'],
  ['/styles.css', 'styles.css'],
]);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
http
  .createServer(async (request, response) => {
    const file = allowed.get(new URL(request.url, 'http://localhost').pathname);
    if (!file) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }
    try {
      const body = await readFile(path.join(root, file));
      response.writeHead(200, {
        'Content-Type': `${types[path.extname(file)]}; charset=utf-8`,
        'Cache-Control': 'no-store',
      });
      response.end(body);
    } catch {
      response.writeHead(500);
      response.end('Unable to load prototype');
    }
  })
  .listen(port, '127.0.0.1', () => console.log(`Prospect CRM: http://localhost:${port}`));

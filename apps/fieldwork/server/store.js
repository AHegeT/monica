import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

export const collections = ['people', 'companies', 'stages', 'sequences', 'tasks', 'research', 'jobs'];
export class Store {
  constructor(filename) {
    if (filename !== ':memory:') {
      mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
      chmodSync(path.dirname(filename), 0o700);
    }
    this.db = new DatabaseSync(filename);
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
    for (const table of collections)
      this.db.exec(
        `CREATE TABLE IF NOT EXISTS ${table} (id TEXT PRIMARY KEY, body TEXT NOT NULL CHECK(json_valid(body)), version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
      );
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      INSERT OR IGNORE INTO meta VALUES ('revision','0');
      CREATE TABLE IF NOT EXISTS audit_events (id TEXT PRIMARY KEY, actor TEXT NOT NULL, operation TEXT NOT NULL, record_id TEXT, detail TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS idempotency (actor TEXT NOT NULL, key TEXT NOT NULL, fingerprint TEXT NOT NULL, result TEXT NOT NULL, PRIMARY KEY(actor,key));
      CREATE TABLE IF NOT EXISTS tokens (id TEXT PRIMARY KEY, name TEXT NOT NULL, hash TEXT NOT NULL UNIQUE, scopes TEXT NOT NULL, revoked INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS audit_date ON audit_events(created_at);
    `);
    if (filename !== ':memory:') chmodSync(filename, 0o600);
    const schemaVersion = this.meta('schema_version');
    if (schemaVersion && schemaVersion !== '1') throw Error('Unsupported Fieldwork database schema version.');
    this.setMeta('schema_version', '1');
    this.transaction(() => {
      if (!this.list('stages').length) {
        ['New prospects', 'Contacted', 'In conversation', 'Meeting booked', 'Outcome'].forEach((name, index) =>
          this.put('stages', {
            id: ['new', 'contacted', 'conversation', 'meeting', 'outcome'][index],
            name,
            color: ['#92a788', '#b3a36d', '#7b9bad', '#a08daa', '#658d72'][index],
            order: index,
          }),
        );
      }
      if (!this.meta('initialized')) {
        this.put('sequences', {
          id: 'warm',
          name: 'A thoughtful introduction',
          description: 'Start a conversation, then give it room to grow.',
          steps: [
            { title: 'Send a personal introduction', channel: 'Email', delay: 0 },
            { title: 'Follow up with a useful idea', channel: 'Email', delay: 3 },
            { title: 'Suggest a short conversation', channel: 'Call', delay: 5 },
          ],
        });
        this.setMeta('initialized', '1');
      }
    });
  }
  table(name) {
    if (!collections.includes(name)) throw Error('Unknown collection');
    return name;
  }
  meta(key) {
    return this.db.prepare('SELECT value FROM meta WHERE key=?').get(key)?.value;
  }
  setMeta(key, value) {
    this.db
      .prepare('INSERT INTO meta VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
      .run(key, String(value));
  }
  revision() {
    return Number(this.meta('revision'));
  }
  bump() {
    const value = this.revision() + 1;
    this.setMeta('revision', value);
    return value;
  }
  list(table) {
    return this.db
      .prepare(`SELECT * FROM ${this.table(table)} ORDER BY rowid`)
      .all()
      .map((row) => ({
        ...JSON.parse(row.body),
        version: row.version,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
  }
  get(table, id) {
    const row = this.db.prepare(`SELECT * FROM ${this.table(table)} WHERE id=?`).get(id);
    return row
      ? { ...JSON.parse(row.body), version: row.version, createdAt: row.created_at, updatedAt: row.updated_at }
      : null;
  }
  put(table, record) {
    const now = new Date().toISOString(),
      old = this.get(table, record.id);
    const { version, createdAt, updatedAt, ...body } = record;
    this.db
      .prepare(
        `INSERT INTO ${this.table(table)} VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body,version=${table}.version+1,updated_at=excluded.updated_at`,
      )
      .run(record.id, JSON.stringify(body), 1, old?.createdAt || createdAt || now, now);
    return this.get(table, record.id);
  }
  audit(actor, operation, recordId, detail) {
    this.db
      .prepare('INSERT INTO audit_events VALUES (?,?,?,?,?,?)')
      .run(randomUUID(), actor, operation, recordId || null, JSON.stringify(detail), new Date().toISOString());
  }
  events(limit = 100) {
    return this.db
      .prepare('SELECT * FROM audit_events ORDER BY rowid DESC LIMIT ?')
      .all(limit)
      .map((row) => ({
        id: row.id,
        actor: row.actor,
        operation: row.operation,
        recordId: row.record_id,
        detail: JSON.parse(row.detail),
        createdAt: row.created_at,
      }));
  }
  transaction(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = fn();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  close() {
    this.db.close();
  }
}

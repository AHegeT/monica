import { randomBytes, createHash, scryptSync, timingSafeEqual } from 'node:crypto';
import { AppError } from './service.js';
export const hash = (value) => createHash('sha256').update(value).digest('hex');
export class Auth {
  constructor(store, { mode = 'local', password, secureCookie = false } = {}) {
    this.store = store;
    this.mode = mode;
    this.secureCookie = secureCookie;
    if (!['local', 'password'].includes(mode)) throw Error('FIELDWORK_AUTH_MODE must be local or password.');
    if (password && !store.meta('password')) {
      if (password.length < 12) throw Error('FIELDWORK_PASSWORD must be at least 12 characters.');
      const salt = randomBytes(16).toString('hex');
      store.setMeta('password', `${salt}:${scryptSync(password, salt, 64).toString('hex')}`);
    }
    if (mode === 'password' && !store.meta('password'))
      throw Error('Set FIELDWORK_PASSWORD (at least 12 characters) on the first password-mode start.');
  }
  login(password) {
    const stored = this.store.meta('password');
    if (!stored) return false;
    const [salt, expected] = stored.split(':');
    const actual = scryptSync(password, salt, 64);
    return timingSafeEqual(actual, Buffer.from(expected, 'hex'));
  }
  session() {
    const token = randomBytes(32).toString('hex');
    this.store.db.prepare('DELETE FROM sessions WHERE expires_at<?').run(Date.now());
    this.store.db.prepare('INSERT INTO sessions VALUES (?,?)').run(hash(token), Date.now() + 24 * 60 * 60 * 1000);
    return {
      token,
      cookie: `fieldwork_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400${this.secureCookie ? '; Secure' : ''}`,
    };
  }
  authenticate(request) {
    const bearer = request.headers.authorization;
    if (bearer) {
      if (!bearer.startsWith('Bearer ')) throw new AppError('unauthenticated', 'Use a bearer token.', 401);
      const token = this.store.db.prepare('SELECT * FROM tokens WHERE hash=? AND revoked=0').get(hash(bearer.slice(7)));
      if (!token) throw new AppError('unauthenticated', 'Invalid or revoked API token.', 401);
      return { actor: `Agent: ${token.name} (${token.id})`, scopes: JSON.parse(token.scopes) };
    }
    const cookie = request.headers.cookie
      ?.split(';')
      .map((x) => x.trim())
      .find((x) => x.startsWith('fieldwork_session='))
      ?.slice('fieldwork_session='.length);
    if (
      cookie &&
      this.store.db.prepare('SELECT hash FROM sessions WHERE hash=? AND expires_at>?').get(hash(cookie), Date.now())
    )
      return { actor: 'Owner', scopes: ['read', 'write', 'admin'] };
    throw new AppError('unauthenticated', 'Sign in to Fieldwork.', 401);
  }
  logout(request) {
    const cookie = request.headers.cookie
      ?.split(';')
      .map((x) => x.trim())
      .find((x) => x.startsWith('fieldwork_session='))
      ?.slice('fieldwork_session='.length);
    if (cookie) this.store.db.prepare('DELETE FROM sessions WHERE hash=?').run(hash(cookie));
    return `fieldwork_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${this.secureCookie ? '; Secure' : ''}`;
  }
  createToken(name, scopes = ['read', 'write']) {
    if (typeof name !== 'string' || !name.trim() || name.length > 100)
      throw new AppError('validation_failed', 'Name the agent credential.');
    if (!Array.isArray(scopes) || !scopes.length || scopes.some((s) => !['read', 'write'].includes(s)))
      throw new AppError('validation_failed', 'Choose read and/or write scopes.');
    const token = `fw_${randomBytes(32).toString('hex')}`,
      id = randomBytes(12).toString('hex');
    this.store.db
      .prepare('INSERT INTO tokens VALUES (?,?,?,?,0,?)')
      .run(id, name.trim(), hash(token), JSON.stringify([...new Set(scopes)]), new Date().toISOString());
    this.store.audit('Owner', 'create_agent_token', id, { name: name.trim(), scopes });
    return { id, name: name.trim(), scopes, token };
  }
  tokens() {
    return this.store.db
      .prepare('SELECT id,name,scopes,revoked,created_at AS createdAt FROM tokens ORDER BY created_at DESC')
      .all()
      .map((t) => ({ ...t, scopes: JSON.parse(t.scopes), revoked: !!t.revoked }));
  }
  revoke(id) {
    this.store.db.prepare('UPDATE tokens SET revoked=1 WHERE id=?').run(id);
    this.store.audit('Owner', 'revoke_agent_token', id, {});
  }
}

// Minimal express-session Store on better-sqlite3. Replaces connect-sqlite3, whose
// legacy `sqlite3` driver dragged a vulnerable install-time build chain (node-gyp/tar,
// npm audit: 5 high) with no fixed upstream version. Same sessions.db file, same WAL
// mode as the main DB; sessions from the old store are dropped (users just sign in again).
import Database from 'better-sqlite3';
import session from 'express-session';
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_TTL_MS = 12 * 60 * 60 * 1000; // matches the 12h cookie maxAge in auth.js

class SqliteSessionStore extends session.Store {
  constructor({ dbPath, ttlMs = DEFAULT_TTL_MS, sweepIntervalMs = 15 * 60 * 1000 }) {
    super();
    this.ttlMs = ttlMs;
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    // connect-sqlite3 used a `sessions` table with an `expired` column; drop it so the
    // schema below can be created (sessions are ephemeral — worst case is a re-login).
    const cols = this.db.prepare(`SELECT name FROM pragma_table_info('sessions')`).all().map(c => c.name);
    if (cols.length && !cols.includes('expire')) this.db.exec('DROP TABLE sessions');
    this.db.exec('CREATE TABLE IF NOT EXISTS sessions (sid TEXT PRIMARY KEY, sess TEXT NOT NULL, expire INTEGER NOT NULL)');
    this._get = this.db.prepare('SELECT sess, expire FROM sessions WHERE sid = ?');
    this._set = this.db.prepare('INSERT OR REPLACE INTO sessions (sid, sess, expire) VALUES (?, ?, ?)');
    this._del = this.db.prepare('DELETE FROM sessions WHERE sid = ?');
    this._touch = this.db.prepare('UPDATE sessions SET expire = ? WHERE sid = ?');
    this._sweep = this.db.prepare('DELETE FROM sessions WHERE expire < ?');
    const timer = setInterval(() => { try { this._sweep.run(Date.now()); } catch { /* sweep is best-effort */ } }, sweepIntervalMs);
    if (timer.unref) timer.unref();
  }

  _expiry(sess) {
    const c = sess && sess.cookie;
    if (c && c.expires) {
      const e = new Date(c.expires).getTime();
      if (Number.isFinite(e)) return e;
    }
    return Date.now() + this.ttlMs;
  }

  get(sid, cb) {
    try {
      const row = this._get.get(sid);
      if (!row || row.expire < Date.now()) return cb(null, undefined);
      return cb(null, JSON.parse(row.sess));
    } catch (e) { return cb(e); }
  }

  set(sid, sess, cb = () => {}) {
    try { this._set.run(sid, JSON.stringify(sess), this._expiry(sess)); return cb(null); }
    catch (e) { return cb(e); }
  }

  destroy(sid, cb = () => {}) {
    try { this._del.run(sid); return cb(null); }
    catch (e) { return cb(e); }
  }

  touch(sid, sess, cb = () => {}) {
    try { this._touch.run(this._expiry(sess), sid); return cb(null); }
    catch (e) { return cb(e); }
  }
}

export default SqliteSessionStore;

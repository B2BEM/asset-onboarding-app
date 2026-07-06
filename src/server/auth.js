// Auth seam (README §6). AUTH_MODE selects the mechanism behind the SAME middleware
// surface (requireUser/requireAdmin) without touching routes.js:
//   dev  — auto-authenticated fake admin user, session-persisted (Phase 2 stub).
//   oidc — Active Directory SSO via OIDC (ADFS or Entra ID / Azure AD) using openid-client.
//   saml/iwa — stubbed per README §6 (passport-saml / reverse-proxy REMOTE_USER); not implemented.
import session from 'express-session';
import SqliteSessionStore from './sessionStore.js';
import path from 'node:path';
import * as oidc from 'openid-client';
import db from './db.js';
import { REPO_ROOT } from './db.js';
import { perthISO } from '../shared/domain/time.js';

const AUTH_MODE = process.env.AUTH_MODE || 'dev';
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-me-in-production';
const IS_PROD = process.env.NODE_ENV === 'production';

// Fail-fast production guards: a copy-paste deploy of .env.example must not come up
// with a forgeable session secret or with dev auto-admin auth exposed to the network.
if (IS_PROD) {
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === 'change-me-in-production') {
    throw new Error(
      'NODE_ENV=production requires a real SESSION_SECRET. Generate one with:\n' +
      '  node -e "console.log(require(\'node:crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  if (AUTH_MODE === 'dev' && process.env.ALLOW_DEV_AUTH_IN_PROD !== 'true') {
    throw new Error(
      'AUTH_MODE=dev auto-authenticates every visitor as an admin; refusing to start with ' +
      'NODE_ENV=production. Set AUTH_MODE=oidc (README §6), or set ALLOW_DEV_AUTH_IN_PROD=true ' +
      'only if this instance is genuinely unreachable by untrusted users.'
    );
  }
}
const SESSIONS_DB_PATH = process.env.SESSIONS_DB_PATH
  ? path.resolve(REPO_ROOT, process.env.SESSIONS_DB_PATH)
  : path.resolve(REPO_ROOT, 'data', 'sessions.db');

const DEV_USER = { upn: 'dev@local', displayName: 'Dev User', role: 'admin' };

function upsertUser(u) {
  const now = perthISO();
  db.prepare(`
    INSERT INTO users (upn, display_name, role, last_seen) VALUES (?, ?, ?, ?)
    ON CONFLICT(upn) DO UPDATE SET display_name = excluded.display_name, role = excluded.role, last_seen = excluded.last_seen
  `).run(u.upn, u.displayName, u.role, now);
}

function sessionMiddleware() {
  return session({
    store: new SqliteSessionStore({ dbPath: SESSIONS_DB_PATH }),
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      // Secure by default in production (nginx terminates TLS; TRUST_PROXY makes the
      // scheme visible). FORCE_HTTPS_COOKIE=false is the explicit opt-out for a
      // deliberately plain-HTTP deployment.
      secure: IS_PROD && process.env.FORCE_HTTPS_COOKIE !== 'false',
      maxAge: 1000 * 60 * 60 * 12, // 12h
    },
  });
}

/* ---------- OIDC (README §6: openid-client; env-configured so ADFS/Entra swap without code) ---------- */
// Env: OIDC_ISSUER, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, OIDC_REDIRECT_URI,
//      OIDC_SCOPES (default 'openid profile email groups'), ADMIN_AD_GROUP,
//      OIDC_ALLOW_INSECURE=true permits http:// issuers (local mock/testing ONLY).
let _oidcConfigPromise = null;
function oidcConfig() {
  if (!_oidcConfigPromise) {
    const issuer = process.env.OIDC_ISSUER;
    if (!issuer) throw new Error('AUTH_MODE=oidc requires OIDC_ISSUER');
    const opts = process.env.OIDC_ALLOW_INSECURE === 'true' ? { execute: [oidc.allowInsecureRequests] } : undefined;
    _oidcConfigPromise = oidc.discovery(
      new URL(issuer),
      process.env.OIDC_CLIENT_ID,
      process.env.OIDC_CLIENT_SECRET,
      undefined,
      opts
    );
    // If discovery fails (IdP unreachable at first login), drop the cached rejection
    // so the next attempt retries — otherwise login stays broken until restart.
    _oidcConfigPromise.catch(() => { _oidcConfigPromise = null; });
  }
  return _oidcConfigPromise;
}

// AD group claim -> app role (README §6): ADMIN_AD_GROUP -> admin, any authenticated user -> user.
function roleFromClaims(claims) {
  const adminGroup = process.env.ADMIN_AD_GROUP || '';
  const groups = Array.isArray(claims.groups) ? claims.groups
    : (typeof claims.groups === 'string' ? [claims.groups] : []);
  const roles = Array.isArray(claims.roles) ? claims.roles : [];
  return adminGroup && (groups.includes(adminGroup) || roles.includes(adminGroup)) ? 'admin' : 'user';
}

function userFromClaims(claims) {
  const upn = claims.preferred_username || claims.upn || claims.email || claims.sub;
  return { upn, displayName: claims.name || upn, role: roleFromClaims(claims) };
}

/* ---------- middleware ---------- */
// requireUser: dev mode auto-authenticates every request; other modes require a session
// established by the login/callback flow (API callers get 401 JSON; pages are handled by pageGuard).
function requireUser(req, res, next) {
  if (AUTH_MODE === 'dev') {
    if (!req.session.user) {
      req.session.user = DEV_USER;
      upsertUser(DEV_USER);
    }
    req.user = req.session.user;
    return next();
  }
  if (req.session && req.session.user) {
    req.user = req.session.user;
    return next();
  }
  return res.status(401).json({ error: 'Not authenticated' });
}

function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin role required' });
  return next();
}

// pageGuard: in non-dev modes every non-API route requires a session (README §6 "every route
// requires an authenticated session"); unauthenticated page/static requests bounce to /login.
// /healthz, /login and /auth/callback are mounted BEFORE this guard in server.js.
function pageGuard(req, res, next) {
  if (AUTH_MODE === 'dev') return next();
  if (req.session && req.session.user) return next();
  return res.redirect('/login');
}

/* ---------- login / callback / logout ---------- */
async function loginHandler(req, res) {
  if (AUTH_MODE === 'dev') {
    req.session.user = DEV_USER;
    upsertUser(DEV_USER);
    return res.redirect('/');
  }
  if (AUTH_MODE === 'oidc') {
    try {
      const config = await oidcConfig();
      const codeVerifier = oidc.randomPKCECodeVerifier();
      const state = oidc.randomState();
      const nonce = oidc.randomNonce();
      req.session.oidc = { codeVerifier, state, nonce };
      const url = oidc.buildAuthorizationUrl(config, {
        redirect_uri: process.env.OIDC_REDIRECT_URI,
        scope: process.env.OIDC_SCOPES || 'openid profile email groups',
        code_challenge: await oidc.calculatePKCECodeChallenge(codeVerifier),
        code_challenge_method: 'S256',
        state,
        nonce,
      });
      return res.redirect(url.href);
    } catch (e) {
      console.error('[auth] OIDC login failed:', e.message);
      return res.status(502).send('Sign-in is unavailable (identity provider unreachable). Contact IT.');
    }
  }
  // saml / iwa are documented stubs (README §6) — fail loudly rather than silently allowing.
  return res.status(501).send(`AUTH_MODE=${AUTH_MODE} is not implemented`);
}

async function callbackHandler(req, res) {
  if (AUTH_MODE !== 'oidc') return res.redirect('/');
  try {
    const config = await oidcConfig();
    const pending = req.session.oidc || {};
    const currentUrl = new URL(req.originalUrl, process.env.OIDC_REDIRECT_URI);
    const tokens = await oidc.authorizationCodeGrant(config, currentUrl, {
      pkceCodeVerifier: pending.codeVerifier,
      expectedState: pending.state,
      expectedNonce: pending.nonce,
    });
    const user = userFromClaims(tokens.claims());
    // Session fixation: issue a fresh session id at the privilege change (login);
    // this also discards the pending oidc state/nonce/verifier.
    return req.session.regenerate((err) => {
      if (err) {
        console.error('[auth] session regenerate failed:', err.message);
        return res.status(500).send('Sign-in failed. <a href="/login">Try again</a>');
      }
      req.session.user = user;
      upsertUser(user);
      return res.redirect('/');
    });
  } catch (e) {
    console.error('[auth] OIDC callback failed:', e.message);
    return res.status(401).send('Sign-in failed. <a href="/login">Try again</a>');
  }
}

function logoutHandler(req, res) {
  if (AUTH_MODE === 'dev') {
    // No-op redirect in dev mode per spec — session intentionally left intact so the app
    // stays usable; real logout applies to the SSO modes below.
    return res.redirect('/');
  }
  req.session.destroy(() => res.redirect('/login'));
}

export { AUTH_MODE, sessionMiddleware, requireUser, requireAdmin, pageGuard, loginHandler, callbackHandler, logoutHandler, upsertUser, DEV_USER };

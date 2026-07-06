// Express app entry point. Boots the DB, rebuilds the dataset into the shared domain
// module, wires auth + routes, and serves the client statically.
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { REPO_ROOT } from './db.js';
import { sessionMiddleware, loginHandler, callbackHandler, logoutHandler, pageGuard } from './auth.js';
import routes from './routes.js';
import { refreshDataset } from './dataset.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIR = path.resolve(REPO_ROOT, 'src', 'client');
const PORT = process.env.PORT ? Number(process.env.PORT) : 8080;

// Boot: rebuild the full dataset object FROM THE DB and push into the shared domain module.
refreshDataset();

const app = express();
app.disable('x-powered-by');
// Behind the nginx TLS proxy (docker-compose): trust X-Forwarded-* so secure
// session cookies and redirect URLs see the real scheme/client.
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);
app.use(express.json({ limit: '10mb' }));
app.use(sessionMiddleware());

// Baseline security headers. The client has no inline <script> or on*= handlers
// (verified — app.js is a single module script), so script-src can be strict 'self'.
// style-src keeps 'unsafe-inline' because the ported UI sets style attributes from JS.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', CSP);
  next();
});

// Health check — no auth.
app.get('/healthz', (req, res) => res.json({ ok: true }));

// Login/callback/logout — no-op redirects in dev mode; OIDC (AD SSO) when AUTH_MODE=oidc.
app.get('/login', loginHandler);
app.get('/auth/callback', callbackHandler);
app.get('/logout', logoutHandler);

// All /api/* require an authenticated user (enforced inside routes.js); admin endpoints
// additionally require role==='admin' (route-internal gating).
app.use('/api', routes);

// Static client. The frozen shared domain modules are served at /shared so the
// browser can import them natively (app.js imports '../shared/domain/*.js', which
// resolves to /shared/domain/*.js from the client root). In SSO modes the pageGuard
// bounces unauthenticated page/static requests to /login (README §6).
app.use(pageGuard);
app.use('/shared', express.static(path.resolve(REPO_ROOT, 'src', 'shared')));
app.use(express.static(CLIENT_DIR, { index: 'index.html' }));

// Last-resort error handler: JSON for API callers, plain text otherwise — never a stack
// trace. Client errors (e.g. malformed JSON body, body over limit) keep their 4xx status
// instead of masquerading as 500s; messages stay generic so nothing internal leaks.
app.use((err, req, res, next) => {
  console.error('[server]', err && (err.stack || err.message || err));
  if (res.headersSent) return next(err);
  const status = Number(err && (err.status || err.statusCode)) || 500;
  const message = status >= 500 ? 'Internal server error'
    : (err && err.type === 'entity.too.large' ? 'Request body too large' : 'Bad request');
  if (req.path && req.path.startsWith('/api/')) return res.status(status).json({ error: message });
  return res.status(status).send(message);
});

app.listen(PORT, () => {
  console.log(`[server] listening on port ${PORT} (AUTH_MODE=${process.env.AUTH_MODE || 'dev'})`);
});

export default app;

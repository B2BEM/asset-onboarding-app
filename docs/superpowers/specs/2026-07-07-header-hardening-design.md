# Response-header hardening — design

Date: 2026-07-07
Status: approved ("All three"), ready for implementation

Remove/genericize implementation-revealing response headers and close the one
gap in the recommended security-header set. Audited live (curl against
https://localhost:10443) before design.

## Findings

- `Server: nginx/1.27.5` — software + exact version on every response
  (nginx default; `server_tokens` unset in deploy/nginx.conf).
- Session cookie `connect.sid` — express-session's default name is an
  Express/connect fingerprint (src/server/auth.js sets no `name`).
- `X-Powered-By` — already removed (`app.disable('x-powered-by')`).
- `ETag` W/"size-mtime" — Express weak-etag shape, no version info; left as is.
- Security headers present and correct: CSP (strict; audited 2026-07-07),
  nosniff, `X-Frame-Options: DENY` + CSP `frame-ancestors 'none'`,
  `Referrer-Policy: same-origin`, HSTS (1y, includeSubDomains) at the nginx TLS
  terminator. Gap: no `Permissions-Policy`.

## Changes

1. **deploy/nginx.conf** — `server_tokens off;` (http context, top of the
   conf.d file) → `Server: nginx`, version stripped from ALL responses
   including nginx-generated error pages. Full removal needs the headers-more
   module (not in stock nginx:alpine); genericize per brief. Config is
   bind-mounted → apply with an nginx container restart, no image rebuild.
2. **src/server/auth.js** — `name: 'sid'` in the express-session config.
   Generic cookie name; invalidates active sessions on deploy (dev-only today).
3. **src/server/server.js** — add
   `Permissions-Policy: camera=(), geolocation=(), microphone=()` beside the
   existing security headers (app layer → every app response).

## Verification

Header behavior is not reachable by the 5 pure-domain gates (unchanged, must
stay green). Verify live: capture before/after with
`curl -skD - https://localhost:10443/` (page, /healthz, 404) — after must show
`Server: nginx` (no version), `Permissions-Policy`, and a `sid=` cookie on
login; all pre-existing security headers unchanged.

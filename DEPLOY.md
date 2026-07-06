# Deploying the Asset Onboarding Tool (on-prem VM, Docker)

Target: a single on-prem VM running Docker (Engine 24+ with the compose plugin).
nginx terminates TLS on 443 and proxies to the Node app; SQLite lives on a bind-mounted
`./data` volume. Keep the original single-file HTML tool as the rollback until sign-off
(build brief §12).

## 1. Prerequisites

- Docker Engine + `docker compose` on the VM.
- A DNS name for the app (e.g. `asset-onboarding.<internal-domain>`).
- TLS certificate for that name from the internal CA: `server.crt` + `server.key`.
- Azure AD / ADFS app registration (see §3 — IT TODO from the build brief §6).

## 2. First-time setup

```bash
git clone <repo> asset-onboarding-app && cd asset-onboarding-app
cp .env.example .env            # then edit .env (see §3)
mkdir -p data/certs
# copy server.crt + server.key into data/certs/
docker compose up -d --build
```

The app container seeds the SQLite reference data on first start (idempotent —
`seed_meta` version guard makes restarts no-ops). Verify:

```bash
docker compose ps                                  # both services healthy
curl -k https://localhost/healthz                  # {"ok":true}
```

**Verifying on a Windows workstation:** SQLite WAL cannot run on Docker Desktop's
Windows bind mounts (`SQLITE_IOERR_SHMOPEN`). Add the named-volume override:
`docker compose -f docker-compose.yml -f docker-compose.windows.yml up -d --build`.
The production Linux VM uses the plain bind-mount layout above.

## 3. .env for production

Required changes from the example file:

| Var | Value |
|---|---|
| `AUTH_MODE` | `oidc` |
| `SESSION_SECRET` | long random string (e.g. `openssl rand -hex 32`) |
| `OIDC_ISSUER` | ADFS: `https://<adfs-host>/adfs` · Entra: `https://login.microsoftonline.com/<tenant-id>/v2.0` |
| `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` | from the app registration |
| `OIDC_REDIRECT_URI` | `https://<dns-name>/auth/callback` (must match the registration) |
| `ADMIN_AD_GROUP` | the AD security group whose members administer the register |
| `FORCE_HTTPS_COOKIE` | `true` (session cookies are then Secure; nginx provides X-Forwarded-Proto) |

Leave `OIDC_ALLOW_INSECURE` unset in production. `TRUST_PROXY=1` is set by compose.

**IT TODO (build brief §6):** confirm federation type (ADFS OIDC vs Entra), create the
app registration with the redirect URI above, enable the `groups` claim in tokens
(Entra: Token configuration → add groups claim; if users can exceed 200 groups use App
Roles instead and set `ADMIN_AD_GROUP` to the role value), and confirm the admin/user
group names.

## 4. Operations

- **Logs:** `docker compose logs -f app` (auth failures log as `[auth] …`).
- **Backup:** stop-free — copy `data/app.db` (plus `-wal`/`-shm` if present) nightly;
  the reference data reseeds from the image, but `onboarding_rows`, `drafts`,
  `bom_existing`, `taxonomy_additions`, `users`, `audit_log` are user data.
- **Update the app:** `git pull && docker compose up -d --build`.
- **Update the register dataset** (new source extract): regenerate
  `data/seed-dataset.json` per the build brief, bump `SEED_VERSION` in
  `scripts/seed-db.js`, rebuild, then `POST /api/admin/reseed` (admin) or restart.
- **Certificate renewal:** replace files in `data/certs/`, `docker compose restart nginx`.

## 5. Rollback

Restore the previous image tag and the latest `data/app.db` backup, then
`docker compose up -d`.

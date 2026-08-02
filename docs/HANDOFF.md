# Asset Onboarding Tool — Handoff & Overview

**Prepared for:** IT stakeholders and prospective customers
**Product:** ISO 55001 Asset Onboarding Tool (self-hosted)
**Document date:** 8 July 2026
**Status:** Production-ready; deployed via Docker with TLS

---

## 1. Executive summary

The Asset Onboarding Tool is a **self-hosted, vendor-neutral web application** that helps an
organisation build a clean, standards-aligned **asset register** before importing it into a CMMS
or ERP asset module. It is framed around **ISO 55000/55001** asset-management principles.

Users construct an asset hierarchy — **Company ▸ Site ▸ Asset Class ▸ Asset** — against a curated
asset-class **taxonomy**. As each asset is entered, the tool **automatically generates its
classification, abbreviation and asset number**, captures **ISO 55001 attributes** and a
**bill of materials**, and produces **CSV files ready for register/CMMS import**.

**Why it matters:**

- **Consistency** — every asset number, classification and abbreviation follows the same
  rule set, eliminating the manual errors typical of spreadsheet-based onboarding.
- **Standards alignment** — the hierarchy and attributes map to ISO 55001 expectations.
- **Self-hosted & private** — runs entirely inside the customer's network; no third-party
  cloud dependency, no data leaves the premises.
- **Auditable** — every action is recorded, and all calculations happen on the server so they
  cannot be tampered with from the browser.

The application ships with the full **839-node classification taxonomy** and all rule logic, but
an **empty register** — each customer builds their own sites, areas and assets. *(The current
running instance holds 871 taxonomy nodes after in-house additions.)*

---

## 2. What the application does (functional overview)

### 2.1 Building the hierarchy

1. **Company / Site / Asset Class** structure rows are created first. What a row *is* is decided
   automatically by its depth in the parent chain (its **ASSET LEVEL**):
   `1 = COMPANY`, `2 = SITE`, `3 = ASSET CLASS`, `4+ = a real asset`.
2. **Assets** are added under a chosen parent. The **taxonomy cascade** starts at the functional
   roots (e.g. `<BUILDINGS & INFRASTRUCTURE>`) and drills down; as levels are chosen, the tool
   auto-fills the classification, abbreviation and the next free asset number
   (e.g. `SITE1-BLD01`).
3. Real assets nested under a parent must sit at **Level 4 or deeper** — the shallow structure
   rows *are* the framework and are exempt.

### 2.2 Automatic computation (the rules engine)

For every row the server computes, from the frozen shared rule set:

- **Classification** — REFERENCE / REFERENCE-SUB containers vs. EQUIPMENT / CLASS assets vs.
  civil PRIMARY/SECONDARY, derived from taxonomy type, children, "system"/plural hints and
  work-orderability.
- **Abbreviation** — a ≤4-letter code built from the asset type (and duty prefix), with
  collision avoidance.
- **Asset number** — parent number + taxonomy code per new level + the next free sequence on the
  leaf (e.g. `SITE1-PMP-CFP01`). Sequences never collide with the master register or in-session
  siblings.
- **Validation** — rule-numbered issues (e.g. "REFERENCE must not carry a number", "Asset must be
  at Level 4 or deeper", "Asset no. already exists"). Issues are flagged by severity; **missing
  information warns but never blocks export**.

### 2.3 Asset detail, BOM and drafts

- **ISO 55001 attributes** on each item asset: Criticality, Condition, Life-cycle stage,
  Asset function/purpose, Replacement cost (with in-app definition tooltips).
- **Bill of materials** per asset, with a stocking-recommendation score; a BOM can also be added
  to an *existing* register asset.
- **Drafts** — work is auto-saved per project and can be reloaded; drafts de-duplicate by name so
  re-saving replaces rather than piles up.
- **Site-scoped view** — with a site selected, the main grid shows only that site's subtree
  (plus the company above it), ordered **hierarchically** (children under their parent regardless
  of entry order), with search and issues-only filters.

### 2.4 Exports and admin functions

- **Three CSV exports** — the onboarding register, the BOM, and taxonomy additions — named from
  the project number/date and ready for CMMS/ERP import.
- **Admin — Update register:** an admin imports an onboarding-export CSV back into the internal
  register; new assets then become selectable parents/sites for everyone.
- **Admin — Taxonomy import/export:** replace the entire classification taxonomy from a
  5-column CSV (strict, all-or-nothing validation) or download the current taxonomy as a backup /
  editable template. Import ⇄ export round-trips losslessly.
- **Admin — Reseed:** refresh the reference dataset from a new source extract.

---

## 3. Architecture

### 3.1 Technology stack

| Layer | Technology |
|---|---|
| Web server / API | Node.js + **Express** |
| Database | **SQLite** via `better-sqlite3` (WAL mode, foreign keys on) |
| Sessions | Server-side store on SQLite (`express-session`) |
| Identity | `openid-client` (OIDC) for AD/Entra SSO; dev auto-login for local use |
| Client | Vanilla JS single-page app (`app.js` + `index.html`) — no build step, no CDN |
| Shared domain | Framework-free "pure" modules shared by client and server |
| Reverse proxy / TLS | **nginx** terminating HTTPS, proxying to the Node app |
| Packaging | **Docker Compose** (app + nginx), on-prem VM |

### 3.2 The three-tier design

- **Client** (`src/client`) — renders the UI and provides instant feedback, but its computed
  values are **display-only**.
- **Server** (`src/server`) — Express routes, authentication, the SQLite layer, and the
  dataset builder. **The server recomputes every asset's classification/number/validation from
  the shared domain modules and ignores whatever the browser sent** — the browser cannot inject
  an incorrect asset number or bypass a rule.
- **Shared domain** (`src/shared/domain`) — the *single source of truth* for taxonomy, rules,
  numbering, structure roles and CSV format. Pure and deterministic, so the same logic runs
  identically in the browser and on the server and is covered by unit tests.

### 3.3 Data model (SQLite tables)

**Reference data (seeded, shared):** `taxonomy_nodes`, `taxonomy_edges`, `site_roots`,
`assets`, `taken_nos`, `kv_json` (departments/sites/areas/meta), `seed_meta`.

**User data (per user):** `onboarding_rows`, `bom_existing`, `drafts`, `taxonomy_additions`,
`users`, `audit_log`.

Every user-owned query is scoped by the authenticated user, and every record write is
parameterised (see §4.3). Structured sub-objects (levels, BOM, project, info) are stored as JSON
columns.

### 3.4 Deployment topology

```
                 HTTPS (443)                 HTTP (proxied)
  Browser  ───────────────────►  nginx  ───────────────────►  Node app  ───►  SQLite (./data)
                               (TLS term.)                   (Express)        app.db (WAL)
```

nginx terminates TLS with the internal CA certificate; SQLite lives on a bind-mounted volume;
the app container seeds reference data on first start (idempotent).

---

## 4. Security posture

Security has been reviewed in a series of dated hardening passes (see §4.9). The summary below
reflects the current, verified state of the code.

### 4.1 Authentication & SSO

- **Two modes behind one middleware seam:**
  - `dev` — auto-signs the visitor in as a local admin. **For local development only.**
  - `oidc` — **Active Directory / Entra ID SSO** via OpenID Connect (ADFS or Azure AD),
    with PKCE, state and nonce.
- **Session security:** cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` in production;
  12-hour lifetime; the session **ID is regenerated at login** (defends against session
  fixation); sessions are stored server-side and swept on expiry.
- **Fail-fast production guards:** the app **refuses to start in production** if the
  `SESSION_SECRET` is missing/default, or if dev auto-admin auth is left enabled — a
  misconfigured deploy cannot silently expose an open admin surface.

### 4.2 Authorization (role-based access control)

- Every `/api/*` route requires an authenticated user; **admin-only** routes (register import,
  taxonomy import/export, reseed, dataset) additionally require the `admin` role.
- In SSO mode the admin role is granted by membership of a **configurable AD security group**
  (`ADMIN_AD_GROUP`), so administration is controlled through existing directory governance.

### 4.3 Injection resistance

- **No NoSQL database is used** — the app is backed entirely by SQLite, so document-store
  operator-injection (`$gt`/`$ne`/`$where`, "object that always matches") is not applicable.
- **SQL injection: none.** Every database statement uses **bound parameters** (`?` / named
  binds). No user-supplied value is ever concatenated or interpolated into SQL — a bound value
  is always treated as literal data, never as query logic.
- **Structure/type smuggling: defended.** Incoming request bodies are coerced to expected types
  and clamped in length before use, so an attacker cannot pass an object/array where a scalar is
  expected to crash a write or alter logic.
- **Prototype-key smuggling: hardened (July 2026).** CSV import maps are now prototype-less, so a
  crafted taxonomy value/parent named after a JavaScript built-in (`__proto__`, `constructor`,
  `toString`, …) is treated as ordinary text and rejected with a clean validation error instead
  of bypassing a check or crashing the import.

### 4.4 Denial-of-service resistance

- Regular-expression patterns that previously back-tracked quadratically on hostile input were
  **rewritten as linear scans** (ReDoS audit), so long/crafted strings cannot pin CPU.
- CSV imports enforce a hard **row-count limit**, and request fields are length-capped.

### 4.5 Output & spreadsheet safety

- **CSV/formula-injection guard:** cells that a spreadsheet would treat as a formula
  (leading `= + - @`, tab or CR) are neutralised on export, so an exported register opened in
  Excel cannot execute injected content. The guard round-trips losslessly on re-import.

### 4.6 Transport & HTTP hardening

- **TLS everywhere** (nginx-terminated) in production.
- Framework-fingerprinting response headers were **genericised** (e.g. the server token and the
  default session-cookie name), and a restrictive **Permissions-Policy** header is sent.

### 4.7 Data handling & integrity

- **Server-authoritative computation** — all classifications, numbers and validations are
  recomputed server-side; client-sent computed values are display-only and discarded.
- **Per-user isolation** — onboarding rows, drafts, BOM and taxonomy additions are scoped to the
  authenticated user.
- **Audit log** — every create/update/delete/import/export is recorded with user, action, detail
  and timestamp.

### 4.8 Quality gates

- The domain logic is protected by **five automated test gates** (rule regression, ERP profile,
  structure/site-scope, taxonomy import, register import), all of which must pass before any
  change ships. Every confirmed security fix has added a permanent regression test.

### 4.9 Recent hardening history

| Date | Area | Change |
|---|---|---|
| Jul 2026 | Prototype-key injection | Prototype-less maps in CSV import (validation-bypass + crash fixed) |
| Jul 2026 | ReDoS | Quadratic trailing-digit regexes rewritten as linear scans |
| Jul 2026 | HTTP headers | Server token / cookie name genericised; Permissions-Policy added |
| Jul 2026 | CSV/formula injection | Export cells neutralised (lossless round-trip) |
| Jul 2026 | Sessions | SQLite session store; session-fixation regeneration at login |

---

## 5. Deployment & operations

- **Target:** a single on-prem VM running Docker Engine 24+ with the Compose plugin.
- **Setup:** copy `.env.example` → `.env`, drop the TLS cert/key into `data/certs/`, then
  `docker compose up -d --build`. Reference data seeds automatically on first start.
- **Production configuration:** set `AUTH_MODE=oidc`, a strong `SESSION_SECRET`, the OIDC
  issuer/client/redirect values, `ADMIN_AD_GROUP`, and `FORCE_HTTPS_COOKIE=true`.
- **Health check:** `GET /healthz` → `{"ok":true}`.
- **Backup:** copy `data/app.db` (plus WAL files) nightly — reference data reseeds from the
  image, but onboarding rows/drafts/BOM/additions/users/audit log are live user data.
- **Updates:** `git pull && docker compose up -d --build`.
- **Rollback:** restore the previous image tag and the latest `data/app.db` backup.
- **Certificate renewal:** replace the files in `data/certs/` and restart nginx.

> IT integration checklist (SSO): create the ADFS/Entra app registration with the redirect URI,
> enable the `groups` (or App Roles) claim in issued tokens, and confirm the admin/user group
> names. These are the only external dependencies.

---

## 6. Three potential upgrades (future roadmap)

These are candidate enhancements — not current gaps — that would extend the tool's value. Each is
compatible with the existing architecture.

### Upgrade 1 — Direct CMMS/ERP write-back integration

**What:** Replace the manual CSV hand-off with a **connector that writes finalised assets
directly into the customer's asset register / CMMS / ERP** (e.g. Maximo, SAP PM, Microsoft
Dynamics, or an accounting/ERP asset module), building on the tool's existing structured data and
ERP-profile mapping.

**Business value:** Removes the export-then-import step and its transcription risk; assets appear
in the system of record within minutes of onboarding. A strong differentiator in customer demos.

**IT considerations:** Outbound API credentials held server-side; a per-target adapter; a
"push" audit entry per asset. Effort: **medium–high** (one adapter per ERP; the mapping layer
already exists).

### Upgrade 2 — Approval workflow with a full audit-trail viewer & reporting

**What:** Add a **reviewer role and an approvals queue** — onboarding submissions move
`Draft → Submitted → Reviewed → Committed to register` — plus an **in-app history/audit viewer**
and an **exportable audit report** built on the audit log that already exists.

**Business value:** Enforces **separation of duties** and gives the governance/traceability
evidence ISO 55001 audits expect. Appeals to both IT (control) and asset managers (accountability).

**IT considerations:** One new role and a small state machine on submissions; reads the existing
`audit_log`. Effort: **medium**. No new infrastructure.

### Upgrade 3 — Modern reporting dashboard & multi-user scaling option

**What:** A **dashboard UI** (onboarding progress by site, assets by classification, outstanding
data-quality issues, BOM stocking coverage) delivered through the **React front-end** that is
already scaffolded, with an optional **PostgreSQL backend** for larger, higher-concurrency
deployments.

**Business value:** Turns the tool from a data-entry utility into a **management-visibility**
product — a compelling customer-facing story — while the Postgres option reassures IT about scale
and high availability for enterprise rollouts.

**IT considerations:** The React scaffold and shared domain modules already exist; the data layer
is abstracted behind the dataset builder, so a Postgres swap is contained. Effort: **medium**
(dashboard) / **medium–high** (Postgres/HA), independently deliverable.

*(Already available today, no build required: Active Directory / Entra SSO — see §4.1 — is built
in and only needs IT to complete the app registration.)*

---

## 7. Appendix

### 7.1 Key API endpoints

- `GET /api/bootstrap`, `GET/POST/PUT/DELETE /api/rows`, `POST /api/rows/validate`
- `GET/POST/DELETE /api/drafts`, `GET/POST /api/bom-existing`, `GET /api/assets/search`
- `POST/DELETE /api/taxonomy/additions`
- `GET /api/export/onboarding.csv | bom.csv | taxonomy.csv`
- **Admin:** `POST /api/admin/register-import`, `POST /api/admin/taxonomy-import`,
  `GET /api/admin/taxonomy.csv`, `POST /api/admin/reseed`, `GET /api/admin/dataset`
- `GET /healthz`, `GET /login`, `GET /auth/callback`, `GET /logout`

### 7.2 Source map

| Path | Responsibility |
|---|---|
| `src/client/app.js`, `index.html` | Single-page UI |
| `src/server/routes.js` | API routes (auth-guarded) |
| `src/server/auth.js` | Dev/OIDC auth, session config, RBAC middleware |
| `src/server/dataset.js` | Rebuilds the in-memory dataset from the DB |
| `src/server/rowCompute.js` | Server-side recompute of every row |
| `src/server/db.js`, `sessionStore.js` | SQLite schema & session store |
| `src/shared/domain/*` | Taxonomy, rules, numbering, structure, CSV (pure) |
| `test/*.test.js` | The five quality gates |
| `Dockerfile`, `docker-compose*.yml`, `deploy/` | Packaging & nginx |
| `docs/`, `README.md`, `DEPLOY.md` | Documentation |

### 7.3 Quality gates (`npm test`)

`generic` · `erpProfile` · `structure` · `taxonomyImport` · `registerImport` — all green.

---

*This document describes the application as deployed on 8 July 2026. For the authoritative
technical detail see `README.md`, `DEPLOY.md`, and the design specs under
`docs/superpowers/specs/`.*

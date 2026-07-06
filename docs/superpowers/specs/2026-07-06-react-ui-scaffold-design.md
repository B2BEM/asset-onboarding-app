# React UI Scaffold — Design

Date: 2026-07-06 (Australia/Perth)
Status: approved by user (brainstorm 2026-07-03 → 2026-07-06; visual direction revised at spec review — see Decisions)
Branch: `feature/react-ui`, cut from the tip of `feature/iso-generic-template` (cf10688, which includes the ERP-profiles feature and the calm-precision client restyle)
Trigger: user supplied the shadcn registry config `"@react-bits": "https://reactbits.dev/r/{name}.json"` and chose a replacement-track React front end for the UI redesign.

## Goal

Stand up a new React front end inside the existing repo that proves every pipeline end-to-end — build tooling, theme, API/auth wiring, frozen-domain reuse, and the `@react-bits` shadcn registry — so subsequent plans can rebuild the UI screen by screen until it replaces the vanilla client.

This scaffold is **not** the full rebuild. The vanilla client stays untouched and remains the production UI until parity is reached.

## Decisions (from brainstorm)

| Decision | Choice |
|---|---|
| Overall aim | Replacement track: parallel React app wired to real API + frozen domain from day one |
| Language | TypeScript (strict), `allowJs` to import the frozen JS domain |
| Visual direction | **Calm Precision** — aligned with the vanilla client's 2026-07 restyle (PR #2): light surfaces, teal accent, ink-grey type, monospaced asset numbers, amber = warn-never-blocks / red = true errors. *(Supersedes the Dark Ops Console pick from 2026-07-03: the restyle landed between brainstorm and spec review; user re-decided at review for visual continuity.)* |
| Repo structure | Self-contained Vite app at `src/client-react/` with its own `package.json`; no npm-workspaces restructure; not a separate repo |
| Branch | `feature/react-ui` off `feature/iso-generic-template` (redesign builds on the generic ISO template, not the original-branded main) |

## Structure

```
src/client-react/
  package.json          # own deps; scripts: dev / build / typecheck / test
  vite.config.ts        # @vitejs/plugin-react + @tailwindcss/vite; dev proxy /api,/login,/auth → http://localhost:8080; aliases @/ → ./src, @domain → ../shared/domain
  tsconfig.json         # strict; allowJs for frozen domain imports
  components.json       # shadcn config + registries: { "@react-bits": "https://reactbits.dev/r/{name}.json" }
  index.html            # light default (calm-precision)
  src/
    main.tsx, App.tsx   # shell: top bar (app title, user from /api/me), content area
    index.css           # Tailwind v4 entry + calm-precision theme tokens (CSS variables)
    lib/api.ts          # typed fetch helpers: getMe(), getBootstrap(); ApiError; 401 → login redirect
    lib/domain.ts       # bridge to frozen src/shared/domain: initData(dataset) + typed read accessors
    types/domain.d.ts   # minimal ambient module declarations for the frozen JS modules
    components/ui/      # shadcn-managed components
    components/reactbits/  # React Bits registry installs
    features/register/RegisterTable.tsx  # read-only register table: search box + client-side paging
```

Versions: React 19, current Vite major, Tailwind v4, latest shadcn CLI; Node 24 already on the workstation. Exact pins land in `package.json` at implementation.

## Hard constraints

- **Zero changes** to `src/server/**`, `src/client/**`, `src/shared/domain/**` (frozen), root tests, Docker files.
- Root `npm test` must stay green; vanilla UI at :8080 must be verifiably unaffected.
- Allowed edits outside `src/client-react/`: `.claude/launch.json` (add `react-ui` dev-server entry), `.gitignore` (client-react build artifacts), this spec + the implementation plan doc, and a `STATE.md` ownership-map row at implementation.

## Data flow & auth (dev)

Express (:8080, `AUTH_MODE=dev` auto-auth) keeps serving the vanilla UI and API. Vite dev server (:5173) proxies `/api`, `/login`, `/auth` to :8080 — cookies stay on `localhost`, so the session works without CORS. Both UIs share the same SQLite DB.

Boot sequence: `/api/me` → `/api/bootstrap` → `initData(dataset)` into the frozen domain → shell renders user + counts banner (taxonomy nodes / register assets, derived through domain state the same way the vanilla client derives them) → `RegisterTable` lists register assets read-only.

## Theme & registry proof

- **Token source of truth:** the calm-precision `:root` block in `src/client/styles.css` (teal accent `#0E7A72`/`#0A5E58`, canvas `#F4F6F8`, white cards, ink `#232C35` with soft/muted steps, line greys, amber/red/ok semantics, `Segoe UI Variable` + `ui-monospace/Cascadia Mono` stacks, radius scale 6–16px, soft card/overlay shadows). Port these values into Tailwind v4 CSS variables / shadcn theme tokens in `index.css` — same palette, not a re-invention. Light is the default; the vanilla file itself is not touched.
- Install exactly one animated React Bits component **through the `@react-bits` registry**, chosen to fit calm precision (subtle text reveal, count-up, or gentle background — not a glow/aurora piece). The registry's item naming (variant-suffixed names) is verified at implementation by fetching the registry index; selection criterion: a subtle animated component whose registry-declared dependencies (e.g. motion/gsap) exercise automatic dependency install. This proves the `npx shadcn add @react-bits/<name>` pipeline the user asked for.

## Error handling

- `lib/api.ts` throws a typed `ApiError { status, message }`; bootstrap failure renders a shadcn alert state instead of a blank screen.
- 401 → redirect to `/login` (matches vanilla client behaviour; inert in dev auto-auth).
- One React `ErrorBoundary` around the shell content with a reload affordance.

## Testing & gate criteria

The scaffold passes when all of the following hold:

1. `npm run dev` inside `src/client-react/` serves the calm-precision shell at :5173.
2. The register table and counts banner show **real data** from `/api/bootstrap` through the proxy, initialised via the frozen domain (not raw JSON reads).
3. One `@react-bits` component, installed via the registry entry, renders and animates in the shell.
4. `tsc --noEmit` clean; Vitest smoke tests green (domain bridge initialises a small synthetic dataset; RegisterTable renders fixture rows).
5. Root `npm test` still green; vanilla UI at :8080 unchanged (manual smoke).
6. All work committed on `feature/react-ui`; `git diff` scope confined to the allowed paths above.

## Explicitly out of scope (later plans)

- Core flows rebuilt screen by screen in subsequent specs/plans: add/edit asset modal, taxonomy cascade UI, BOM flows, drafts, CSV export UI, admin screens.
- **ERP-profiles feature parity** (landed 2026-07 on the vanilla client): admin ERP setup page (profile CRUD + column editor), CSV import header-mapping, profile-driven flat mode with engine bypass, blank-template/client-side export. These join the screen-by-screen rebuild roadmap.
- Production serving flip: at parity, `vite build` output gets served by Express behind an env flag, vanilla client retires to `/archive`, Dockerfile gains a UI build stage. Documented here so it isn't forgotten; not built now.
- Dark-mode styling pass (calm precision is light-first; tokens keep dark mode possible later).

## Known risks

- **Session-state bridge (rebuild phases, not this scaffold):** the frozen domain keeps mutable module-level session state (`rows`, `editing`, `PROJECT`, …). React needs a thin subscribe/notify store wrapper around that seam before the first *editing* screen is ported. Designing it belongs to the first rebuild plan.
- **Moving target:** the vanilla client is still gaining features (ERP profiles landed mid-brainstorm). Parity is defined against the vanilla client *at flip time*, so each rebuild plan should start by re-checking the vanilla feature surface.
- **Two `node_modules` trees** (root + client-react): accepted cost of avoiding a workspaces restructure of a gate-passed system.

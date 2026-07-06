# React UI Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up `src/client-react/` — a Vite + React 19 + TypeScript + Tailwind v4 + shadcn app with the `@react-bits` registry — showing real register data through the existing Express API and frozen domain, per the approved spec `docs/superpowers/specs/2026-07-06-react-ui-scaffold-design.md`.

**Architecture:** Self-contained Vite app beside the vanilla client; dev-proxies `/api`,`/login`,`/auth` to Express :8080 (shared session + SQLite); imports the frozen ESM domain from `../shared/domain` via alias; calm-precision theme tokens ported from `src/client/styles.css`.

**Tech Stack:** Vite (react-ts template), React 19, TypeScript strict + allowJs, Tailwind v4 (`@tailwindcss/vite`), shadcn CLI with custom registry, Vitest + Testing Library (jsdom), frozen domain modules (read-only).

**Ground rules for every task:**
- Branch: `feature/react-ui`. Work only under `src/client-react/` except where a task says otherwise.
- NEVER touch `src/server/**`, `src/client/**`, `src/shared/domain/**`, root `test/**`, Docker files.
- All `npm`/`npx` commands run **inside `C:\dev\asset-onboarding-app\src\client-react`** unless stated otherwise.
- This environment runs GateGuard hooks: if a Bash/Write/Edit call returns a "[Fact-Forcing Gate]" error, present the requested facts in your reply text, then retry the identical call — it passes on retry.
- The Express server must be running for browser checks: `node C:\dev\asset-onboarding-app\src\server\server.js` (or preview_start `asset-onboarding-app`), `AUTH_MODE=dev` default `.env`.

---

### Task 1: Scaffold the Vite React-TS app

**Files:**
- Create: `src/client-react/**` (Vite `react-ts` template output)

- [ ] **Step 1: Generate the template**

Run (from `C:\dev\asset-onboarding-app\src`):
```bash
cd /c/dev/asset-onboarding-app/src && npm create vite@latest client-react -- --template react-ts
```
Expected: "Scaffolding project in …\src\client-react" and a "Done" hint. No prompts (name + template are supplied).

- [ ] **Step 2: Install dependencies**

```bash
cd /c/dev/asset-onboarding-app/src/client-react && npm install
```
Expected: exit 0, `node_modules/` created (template's own `.gitignore` already excludes it).

- [ ] **Step 3: Verify the app boots**

```bash
cd /c/dev/asset-onboarding-app/src/client-react && npx vite --port 5173 & VPID=$!
sleep 3; curl -s http://localhost:5173/ | head -c 300; kill $VPID
```
Expected: HTML containing `<div id="root">` and `/src/main.tsx`.

- [ ] **Step 4: Commit**

```bash
cd /c/dev/asset-onboarding-app && git add src/client-react && git commit -m "feat(react-ui): scaffold Vite react-ts app at src/client-react"
```

---

### Task 2: Tailwind v4 + calm-precision theme tokens

**Files:**
- Modify: `src/client-react/vite.config.ts`
- Modify: `src/client-react/src/index.css` (replace template content entirely)
- Modify: `src/client-react/src/App.tsx` (replace template content entirely)
- Delete: `src/client-react/src/App.css`

- [ ] **Step 1: Install Tailwind v4**

```bash
npm install tailwindcss @tailwindcss/vite
npm install -D tw-animate-css
```

- [ ] **Step 2: Replace `vite.config.ts`** (adds tailwind plugin now; proxy/aliases/vitest come in Task 4)

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```

- [ ] **Step 3: Replace `src/index.css`** with the calm-precision tokens (values ported from `src/client/styles.css` `:root`; do not edit that file):

```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

:root {
  --background: #F4F6F8;      /* --canvas */
  --foreground: #232C35;      /* --ink */
  --card: #FFFFFF;
  --card-foreground: #232C35;
  --popover: #FFFFFF;
  --popover-foreground: #232C35;
  --primary: #0E7A72;         /* --ac (teal) */
  --primary-foreground: #FFFFFF;
  --secondary: #EDF1F5;       /* --chip */
  --secondary-foreground: #232C35;
  --muted: #F8FAFB;           /* --subtle */
  --muted-foreground: #66727E;/* --ink-label */
  --accent: #E7F1F0;          /* --act */
  --accent-foreground: #0A5E58; /* --acs */
  --destructive: #B3403A;     /* --danger */
  --destructive-foreground: #FFFFFF;
  --border: #E4E9EE;          /* --line */
  --input: #D9DFE6;           /* --line-ctrl */
  --ring: rgba(14, 122, 114, 0.30); /* --acb */
  --radius: 12px;             /* --r-card */
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --radius-sm: calc(var(--radius) - 6px);
  --radius-md: calc(var(--radius) - 4px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --font-sans: 'Segoe UI Variable Text', 'Segoe UI', system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif;
  --font-mono: ui-monospace, 'Cascadia Mono', Consolas, 'SF Mono', Menlo, monospace;
}

body {
  @apply bg-background text-foreground font-sans antialiased;
  font-size: 13px;
  line-height: 1.5;
}
```

- [ ] **Step 4: Replace `src/App.tsx` with a token smoke screen and delete `src/App.css`**

```tsx
export default function App() {
  return (
    <div className="min-h-screen p-8">
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h1 className="text-lg font-semibold">Calm precision tokens</h1>
        <p className="text-muted-foreground">Muted ink on white card over canvas.</p>
        <button className="mt-4 rounded-md bg-primary px-4 py-2 text-primary-foreground">
          Teal primary
        </button>
        <span className="ml-3 font-mono">SITE1-BLD01</span>
      </div>
    </div>
  )
}
```
Also: `rm src/App.css` (its import was removed with the file's only consumer).

- [ ] **Step 5: Verify styles compile and render**

```bash
npx vite --port 5173 & VPID=$!
sleep 3; curl -s http://localhost:5173/src/index.css | head -c 200; kill $VPID
```
Expected: CSS output (not an error overlay). Visually (optional now, mandatory at Task 9): canvas-grey page, white card, teal button.

- [ ] **Step 6: Commit**

```bash
cd /c/dev/asset-onboarding-app && git add -A src/client-react && git commit -m "feat(react-ui): tailwind v4 + calm-precision theme tokens"
```

---

### Task 3: shadcn wiring with the @react-bits registry

**Files:**
- Create: `src/client-react/components.json`
- Create: `src/client-react/src/lib/utils.ts`
- Create (via CLI): `src/client-react/src/components/ui/{button,input,table,card,alert}.tsx`

- [ ] **Step 1: Install shadcn runtime deps**

```bash
npm install clsx tailwind-merge lucide-react
```

- [ ] **Step 2: Create `components.json`** (hand-written — avoids the interactive `init`; includes the user's registry):

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/index.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide",
  "registries": {
    "@react-bits": "https://reactbits.dev/r/{name}.json"
  }
}
```

- [ ] **Step 3: Create `src/lib/utils.ts`**

```ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 4: Add tsconfig path aliases now** (the shadcn CLI resolves `@/` through tsconfig). NOTE: do NOT add `baseUrl` — TypeScript 6 hard-errors on it (TS5101); relative `paths` patterns resolve without it under `moduleResolution: "bundler"`. In `src/client-react/tsconfig.app.json`, add inside `compilerOptions`:

```json
    "paths": {
      "@/*": ["./src/*"],
      "@domain/*": ["../shared/domain/*"]
    },
    "allowJs": true
```
And in `src/client-react/tsconfig.json` (project references root), add a top-level:
```json
  "compilerOptions": {
    "paths": { "@/*": ["./src/*"], "@domain/*": ["../shared/domain/*"] }
  }
```
Also `npm install class-variance-authority` — the shadcn CLI generates code importing it but may not declare the dependency (phantom-dep risk).

- [ ] **Step 5: Install the base shadcn components**

```bash
npx shadcn@latest add button input table card alert --yes
```
Expected: files created under `src/components/ui/`. (If the CLI complains about the Vite alias, re-check Step 4 paths — it reads `tsconfig.json`.)

- [ ] **Step 6: Verify TypeScript is clean**

```bash
npx tsc -b --noEmit || npx tsc --noEmit -p tsconfig.app.json
```
Expected: exit 0. (`tsc -b` uses the reference build; the fallback checks the app project directly.)

- [ ] **Step 7: Commit**

```bash
cd /c/dev/asset-onboarding-app && git add -A src/client-react && git commit -m "feat(react-ui): shadcn base components + @react-bits registry in components.json"
```

---

### Task 4: Vite proxy, aliases, and Vitest harness

**Files:**
- Modify: `src/client-react/vite.config.ts` (replace entirely)
- Modify: `src/client-react/package.json` (scripts)
- Create: `src/client-react/src/test/setup.ts`

- [ ] **Step 1: Install test deps**

```bash
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom @types/node
```

- [ ] **Step 2: Replace `vite.config.ts`**

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@domain': path.resolve(import.meta.dirname, '../shared/domain'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8080',
      '/login': 'http://localhost:8080',
      '/auth': 'http://localhost:8080',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    globals: true,
  },
})
```

- [ ] **Step 3: Create `src/test/setup.ts`**

```ts
import '@testing-library/jest-dom'
```

- [ ] **Step 4: Add scripts to `src/client-react/package.json`** — merge into the existing `"scripts"` block so it reads:

```json
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc -b --noEmit",
    "test": "vitest run"
  }
```

- [ ] **Step 5: Verify harness runs (no tests yet)**

```bash
npm run typecheck && npx vitest run --passWithNoTests
```
Expected: typecheck exit 0; vitest reports "no test files found" and exits 0.

- [ ] **Step 6: Commit**

```bash
cd /c/dev/asset-onboarding-app && git add -A src/client-react && git commit -m "feat(react-ui): dev proxy, @/@domain aliases, vitest harness"
```

---

### Task 5: Domain bridge + API client (TDD)

**Files:**
- Create: `src/client-react/src/lib/domain.ts`
- Create: `src/client-react/src/lib/api.ts`
- Create: `src/client-react/src/types/domain.d.ts` (ambient types for the frozen JS seam)
- Modify: `src/client-react/tsconfig.app.json`, `tsconfig.json` (remove `@domain/*` from `paths` — types come from the ambient declaration; Vite/Vitest keep resolving via `resolve.alias`)
- Test: `src/client-react/src/lib/domain.test.ts`

- [ ] **Step 1: Write the failing test** `src/lib/domain.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { initDomain, registerAssets, taxonomyCount } from './domain'

const synthetic = {
  taxonomyNodes: {
    ROOTA: { value: 'ROOTA', type: 'ROOT', code: 'RA', desc: 'Root A', levelDesc: '', suffix: '' },
    CHILD: { value: 'CHILD', type: 'NODE', code: 'CH', desc: 'Child', levelDesc: '', suffix: '' },
  },
  edges: { ROOTA: ['CHILD'] },
  siteRoots: ['ROOTA'],
  existingAssets: [
    { no: 'S1', desc: 'Site one' },
    { no: 'S1-B1', desc: 'Building one', parent: 'S1' },
  ],
  departments: [],
  sites: [],
  locAreas: [],
  locationOverrides: [],
  takenNos: [],
  meta: {},
}

describe('domain bridge', () => {
  it('initialises the frozen domain and reads back register assets', () => {
    initDomain(synthetic)
    expect(registerAssets().map(a => a.no)).toEqual(['S1', 'S1-B1'])
    expect(taxonomyCount()).toBe(2)
  })
})
```

- [ ] **Step 2: Run it — expect failure**

```bash
npx vitest run src/lib/domain.test.ts
```
Expected: FAIL — `Cannot find module './domain'`.

- [ ] **Step 3: Create `src/lib/domain.ts`**

```ts
// Typed bridge over the FROZEN domain modules (src/shared/domain — never edit those).
// data.js uses live ESM bindings: ASSETS/NODES point at fresh structures after initData().
import { initData, ASSETS, NODES } from '@domain/data.js'

export interface RegisterAsset {
  no: string
  desc?: string
  parent?: string
  lvl?: number
}

export interface BootstrapDataset {
  taxonomyNodes: Record<string, unknown>
  existingAssets: RegisterAsset[]
  [key: string]: unknown
}

export function initDomain(dataset: BootstrapDataset): void {
  initData(dataset)
}

export function registerAssets(): RegisterAsset[] {
  return ASSETS as RegisterAsset[]
}

export function taxonomyCount(): number {
  return Object.keys(NODES as Record<string, unknown>).length
}
```

- [ ] **Step 4: Run the test — expect pass**

```bash
npx vitest run src/lib/domain.test.ts
```
Expected: PASS (1 test). This also proves Vitest resolves `@domain/*` into the frozen JS with `allowJs`.

- [ ] **Step 5: Create `src/lib/api.ts`**

```ts
import type { BootstrapDataset } from './domain'

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}
// NOTE: no constructor parameter properties — the template sets erasableSyntaxOnly (TS1294).

export interface Me {
  upn: string
  displayName: string
  role: 'admin' | 'user'
}

export interface BootstrapResponse {
  dataset: BootstrapDataset
  user: Me
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'same-origin' })
  if (res.status === 401) {
    // Matches vanilla client behaviour (session expiry in non-dev auth modes).
    window.location.href = '/login'
    throw new ApiError(401, 'unauthenticated')
  }
  if (!res.ok) throw new ApiError(res.status, `${url} failed with ${res.status}`)
  return (await res.json()) as T
}

export const getMe = () => getJson<Me>('/api/me')
export const getBootstrap = () => getJson<BootstrapResponse>('/api/bootstrap')
```
(Response shapes verified against `src/server/routes.js`: `/api/me` → `{upn, displayName, role}`; `/api/bootstrap` → `{dataset, user}`.)

- [ ] **Step 6: Typecheck + full test run, then commit**

```bash
npm run typecheck && npm test
cd /c/dev/asset-onboarding-app && git add -A src/client-react && git commit -m "feat(react-ui): frozen-domain bridge + typed api client (TDD)"
```

---

### Task 6: App shell with real boot sequence

**Files:**
- Modify: `src/client-react/src/App.tsx` (replace the Task-2 smoke screen entirely)
- Create: `src/client-react/src/components/ErrorBoundary.tsx`
- Modify: `src/client-react/index.html` (title)

- [ ] **Step 1: Create `src/components/ErrorBoundary.tsx`**

```tsx
import { Component, type ReactNode } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto mt-16 max-w-lg">
          <Alert variant="destructive">
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription>{this.state.error.message}</AlertDescription>
          </Alert>
          <Button className="mt-4" onClick={() => window.location.reload()}>
            Reload
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}
```

- [ ] **Step 2: Replace `src/App.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { getBootstrap, getMe, type Me } from '@/lib/api'
import { initDomain, registerAssets, taxonomyCount } from '@/lib/domain'

type Boot =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; me: Me; taxonomy: number; assets: number }

export default function App() {
  const [boot, setBoot] = useState<Boot>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const me = await getMe()
        const { dataset } = await getBootstrap()
        initDomain(dataset)
        if (!cancelled) {
          setBoot({
            status: 'ready',
            me,
            taxonomy: taxonomyCount(),
            assets: registerAssets().length,
          })
        }
      } catch (err) {
        if (!cancelled) {
          setBoot({ status: 'error', message: err instanceof Error ? err.message : String(err) })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <ErrorBoundary>
      <div className="min-h-screen">
        <header className="sticky top-0 z-30 flex min-h-[62px] flex-wrap items-center gap-4 border-b border-border bg-card px-5">
          <div className="flex items-center gap-3">
            <div className="h-4 w-4 rounded-sm bg-primary" aria-hidden />
            <h1 className="text-sm font-semibold">Asset Onboarding — ISO 55001</h1>
          </div>
          {boot.status === 'ready' && (
            <>
              <span className="text-xs text-muted-foreground">
                {boot.taxonomy.toLocaleString()} taxonomy nodes · {boot.assets.toLocaleString()} register assets
              </span>
              <span className="ml-auto rounded-full bg-secondary px-3 py-1 text-xs">
                {boot.me.displayName} · {boot.me.role}
              </span>
            </>
          )}
        </header>

        <main className="mx-auto max-w-6xl p-5">
          {boot.status === 'loading' && <p className="text-muted-foreground">Loading register…</p>}
          {boot.status === 'error' && (
            <div className="mx-auto mt-10 max-w-lg">
              <Alert variant="destructive">
                <AlertTitle>Could not reach the server</AlertTitle>
                <AlertDescription>
                  {boot.message} — is the Express server running on :8080?
                </AlertDescription>
              </Alert>
              <Button className="mt-4" onClick={() => window.location.reload()}>
                Retry
              </Button>
            </div>
          )}
          {boot.status === 'ready' && (
            <p className="text-muted-foreground">Register table lands in the next task.</p>
          )}
        </main>
      </div>
    </ErrorBoundary>
  )
}
```

- [ ] **Step 3: Set the page title** in `src/client-react/index.html`: change `<title>` to `Asset Onboarding — ISO 55001` (leave the rest of the template file as-is; light is the default, no `dark` class).

- [ ] **Step 4: Verify against the live server**

Start Express (`node C:/dev/asset-onboarding-app/src/server/server.js` if not already running), then `npm run dev`, open http://localhost:5173 — expect the header with real counts (taxonomy 839 on the generic seed) and the dev user chip. Also verify the error path: stop Express, reload :5173 → destructive alert with retry.

- [ ] **Step 5: Typecheck, test, commit**

```bash
npm run typecheck && npm test
cd /c/dev/asset-onboarding-app && git add -A src/client-react && git commit -m "feat(react-ui): app shell — real /api/me + /api/bootstrap boot into frozen domain"
```

---

### Task 7: Read-only RegisterTable (TDD)

**Files:**
- Create: `src/client-react/src/features/register/RegisterTable.tsx`
- Test: `src/client-react/src/features/register/RegisterTable.test.tsx`
- Modify: `src/client-react/src/App.tsx` (mount the table)

- [ ] **Step 1: Write the failing test** `src/features/register/RegisterTable.test.tsx` (install the interaction helper first):

```bash
npm install -D @testing-library/user-event
```

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { RegisterTable } from './RegisterTable'

const assets = [
  { no: 'S1', desc: 'Site one' },
  { no: 'S1-B1', desc: 'Building one', parent: 'S1' },
  { no: 'S1-B1-AC 01', desc: 'Air conditioner', parent: 'S1-B1' },
]

describe('RegisterTable', () => {
  it('renders asset rows', () => {
    render(<RegisterTable assets={assets} />)
    expect(screen.getByText('S1-B1-AC 01')).toBeInTheDocument()
    expect(screen.getByText('Building one')).toBeInTheDocument()
  })

  it('filters by search text across no and description', async () => {
    render(<RegisterTable assets={assets} />)
    await userEvent.type(screen.getByPlaceholderText(/search/i), 'air')
    expect(screen.getByText('S1-B1-AC 01')).toBeInTheDocument()
    expect(screen.queryByText('Site one')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run it — expect failure**

```bash
npx vitest run src/features/register/RegisterTable.test.tsx
```
Expected: FAIL — `Cannot find module './RegisterTable'`.

- [ ] **Step 3: Create `src/features/register/RegisterTable.tsx`**

```tsx
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { RegisterAsset } from '@/lib/domain'

const PAGE_SIZE = 25

export function RegisterTable({ assets }: { assets: RegisterAsset[] }) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return assets
    return assets.filter(
      a => a.no.toLowerCase().includes(q) || (a.desc ?? '').toLowerCase().includes(q),
    )
  }, [assets, search])

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, pages - 1)
  const rows = filtered.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE)

  return (
    <section className="rounded-lg border border-border bg-card shadow-sm">
      <div className="flex items-center gap-3 border-b border-border p-3">
        <Input
          placeholder="Search asset no. or description…"
          value={search}
          onChange={e => {
            setSearch(e.target.value)
            setPage(0)
          }}
          className="max-w-sm"
        />
        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length.toLocaleString()} assets
        </span>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-56">Asset No.</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="w-56">Parent</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(a => (
            <TableRow key={a.no}>
              <TableCell className="font-mono text-primary">{a.no}</TableCell>
              <TableCell>{a.desc ?? ''}</TableCell>
              <TableCell className="font-mono text-muted-foreground">{a.parent ?? ''}</TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                No assets match “{search}”.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <div className="flex items-center gap-2 border-t border-border p-3">
        <Button
          variant="outline"
          size="sm"
          disabled={current === 0}
          onClick={() => setPage(p => Math.max(0, p - 1))}
        >
          Previous
        </Button>
        <span className="text-xs text-muted-foreground">
          Page {current + 1} of {pages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={current >= pages - 1}
          onClick={() => setPage(p => Math.min(pages - 1, p + 1))}
        >
          Next
        </Button>
      </div>
    </section>
  )
}
```
Note on the duplicate-`no` quirk: the master fixture can contain duplicate asset numbers (STATE.md D12). `key={a.no}` is fine for the scaffold's read-only list; if React warns on duplicates with a client's dataset, switch to `key={`${a.no}-${i}`}` using the map index.

- [ ] **Step 4: Run the tests — expect pass**

```bash
npx vitest run src/features/register/RegisterTable.test.tsx
```
Expected: PASS (2 tests).

- [ ] **Step 5: Mount it in `App.tsx`** — add the import and swap the ready-state placeholder:

```tsx
import { RegisterTable } from '@/features/register/RegisterTable'
```
Replace
```tsx
          {boot.status === 'ready' && (
            <p className="text-muted-foreground">Register table lands in the next task.</p>
          )}
```
with
```tsx
          {boot.status === 'ready' && <RegisterTable assets={registerAssets()} />}
```
(`registerAssets` is already imported in App.tsx from Task 6.)

- [ ] **Step 6: Verify in browser, typecheck, test, commit**

With Express running, `npm run dev` → :5173 shows the table with real register rows; search narrows; paging works.

```bash
npm run typecheck && npm test
cd /c/dev/asset-onboarding-app && git add -A src/client-react && git commit -m "feat(react-ui): read-only register table with search + paging (TDD)"
```

---

### Task 8: React Bits registry proof

**Files:**
- Create (via CLI): the React Bits component under `src/client-react/src/` (path comes from the registry item's own target; check the CLI output)
- Modify: `src/client-react/src/App.tsx` (animate the counts)

- [ ] **Step 1: Verify the registry item name before installing.** React Bits publishes variant-suffixed items; confirm which name resolves:

```bash
curl -s -o /dev/null -w "%{http_code}" https://reactbits.dev/r/CountUp-TS-TW.json
curl -s -o /dev/null -w "%{http_code}" https://reactbits.dev/r/count-up.json
```
Expected: one of them returns 200 — use that name below (written as `<NAME>`). If both 404, fetch `https://reactbits.dev/r/registry.json` and pick the CountUp TS/Tailwind item's exact name from the listing; if the registry is entirely unreachable, STOP and report (gate criterion 3 cannot pass offline).

- [ ] **Step 2: Install through the user's registry alias**

```bash
npx shadcn@latest add @react-bits/<NAME> --yes
```
Expected: CLI prints the created file path(s) (e.g. `src/components/CountUp/CountUp.tsx`) and auto-installs any registry-declared dependencies. Note the exported component path for Step 3. The commit message must record the resolved name.

- [ ] **Step 3: Wire CountUp into the header counts** in `App.tsx` — import it from the path Step 2 created (adjust the specifier to match; example shown for `src/components/CountUp/CountUp.tsx` with a default export):

```tsx
import CountUp from '@/components/CountUp/CountUp'
```
Replace the ready-state counts span's two numbers:
```tsx
              <span className="text-xs text-muted-foreground">
                <CountUp to={boot.taxonomy} duration={1} separator="," /> taxonomy nodes ·{' '}
                <CountUp to={boot.assets} duration={1} separator="," /> register assets
              </span>
```
If the installed component's props differ (check its source — some variants use `end`/`value` instead of `to`), match its actual prop names and keep the ~1s duration.

- [ ] **Step 4: Verify animation in browser**

`npm run dev` → :5173 — the two counts animate up on load. Console shows no errors.

- [ ] **Step 5: Typecheck, test, commit**

```bash
npm run typecheck && npm test
cd /c/dev/asset-onboarding-app && git add -A src/client-react && git commit -m "feat(react-ui): CountUp via @react-bits registry (<resolved name>) animating boot counts"
```

---

### Task 9: Launch config, STATE.md row, and full gate

**Files:**
- Modify: `C:\Users\B2BEM\B2BEM\B2BEM - Internal\.claude\launch.json` (workspace file — NOT in the repo)
- Modify: `STATE.md` (ownership map row + current-phase note)

- [ ] **Step 1: Add the react-ui launch entry.** In the workspace `launch.json`, append to `"configurations"` (comma after the previous entry):

```json
    {
      "name": "react-ui",
      "runtimeExecutable": "node",
      "runtimeArgs": [
        "C:\\dev\\asset-onboarding-app\\src\\client-react\\node_modules\\vite\\bin\\vite.js",
        "C:\\dev\\asset-onboarding-app\\src\\client-react"
      ],
      "port": 5173
    }
```
(Plain `node` + vite's bin script — same pattern as the existing entries; avoids npm-shim spawn issues on Windows.)

- [ ] **Step 2: Add the ownership row to `STATE.md`** — in the "File-ownership map" table, add after the client row:

```markdown
| `src/client-react/**` | React UI scaffold agent (feature/react-ui) |
```
And append one line to the "Current phase" section: `React UI scaffold in progress on feature/react-ui (spec docs/superpowers/specs/2026-07-06-react-ui-scaffold-design.md); vanilla client remains production UI.`

- [ ] **Step 3: Run the full gate checklist** (spec §Testing & gate criteria):

```bash
cd /c/dev/asset-onboarding-app/src/client-react && npm run typecheck && npm test
cd /c/dev/asset-onboarding-app && npm test
```
Expected: all green (react typecheck + vitest; root generic.test.js 24 checks).

Browser gate (Express on :8080 running): :5173 shows calm-precision shell, real counts animating (CountUp), register table searches/pages; :8080 vanilla UI still loads and behaves identically (spot-check: boot banner, open add-asset modal, close).

```bash
cd /c/dev/asset-onboarding-app && git status --short && git diff --name-only feature/iso-generic-template..feature/react-ui
```
Expected: clean tree; diff touches only `src/client-react/**`, `docs/superpowers/**`, `STATE.md`, `.gitignore`.

- [ ] **Step 4: Commit**

```bash
cd /c/dev/asset-onboarding-app && git add STATE.md && git commit -m "docs: STATE.md — react-ui scaffold ownership row + phase note"
```
(The workspace `launch.json` is outside the repo — nothing to commit for it.)

---

## Out of scope (per spec)

Add/edit modal, cascade UI, BOM, drafts, exports UI, admin screens, ERP-profiles parity, production serving flip, dark mode. Each gets its own spec + plan later.

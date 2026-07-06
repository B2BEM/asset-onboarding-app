// Ambient types for the FROZEN plain-JS domain seam (src/shared/domain).
// tsc resolves '@domain/data.js' to this declaration (no tsconfig paths entry
// for @domain); Vite and Vitest resolve the real file at runtime via
// resolve.alias in vite.config.ts. Declare only what the React app consumes;
// extend as new screens need more of the seam.
// Known omitted fields on real assets: org (always present), tx (optional
// taxonomy autofill) — see src/server/dataset.js:48; add them here when a
// screen needs them.
declare module '@domain/data.js' {
  export interface DomainAsset {
    no: string
    desc?: string
    parent?: string
    lvl?: number
  }
  export function initData(dataset: unknown): void
  export const ASSETS: DomainAsset[]
  export const NODES: Record<string, unknown>
}

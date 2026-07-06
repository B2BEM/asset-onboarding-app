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

/**
 * Returns the LIVE backing array from the frozen domain (ESM live binding).
 * initDomain() REPLACES it with a new array — do not hold this reference
 * across a re-init; copy it or re-read after calling initDomain().
 */
export function registerAssets(): RegisterAsset[] {
  return ASSETS as RegisterAsset[]
}

export function taxonomyCount(): number {
  return Object.keys(NODES as Record<string, unknown>).length
}

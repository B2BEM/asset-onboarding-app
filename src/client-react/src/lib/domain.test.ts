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

  it('re-initialising replaces state rather than accumulating', () => {
    initDomain(synthetic)
    initDomain({
      ...synthetic,
      taxonomyNodes: { ROOTA: synthetic.taxonomyNodes.ROOTA },
      existingAssets: [{ no: 'X9', desc: 'Only asset' }],
    })
    expect(registerAssets().map(a => a.no)).toEqual(['X9'])
    expect(taxonomyCount()).toBe(1)
  })
})

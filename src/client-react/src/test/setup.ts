import '@testing-library/jest-dom'

// jsdom has no IntersectionObserver; motion/react's useInView (used by the
// @react-bits CountUp component) calls it unconditionally on mount. Stub a
// no-op implementation so components using it can mount under jsdom — the
// callback is intentionally never invoked, so "in view" animations simply
// don't fire in tests (mount-only smoke tests should not depend on them).
class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null
  readonly rootMargin: string = ''
  readonly scrollMargin: string = ''
  readonly thresholds: ReadonlyArray<number> = []
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return []
  }
}

if (typeof globalThis.IntersectionObserver === 'undefined') {
  globalThis.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver
}

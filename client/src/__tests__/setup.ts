// The /jest-globals entry point augments `expect` imported from
// "@jest/globals", which is the only form available under jest's ESM mode.
// The bare "@testing-library/jest-dom" import only augments the legacy
// `jest.Matchers` global, which ESM tests never see.
import "@testing-library/jest-dom/jest-globals";

// jsdom implements neither of these, and both are used by the redesign:
// ResizeObserver by the typing surface's caret measurement, matchMedia by
// the theme provider's "system" mode.
if (!("ResizeObserver" in globalThis)) {
  (globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

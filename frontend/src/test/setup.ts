import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

/*
 * jsdom has no ResizeObserver, and Vue Flow constructs one the moment it mounts
 * (@vue-flow/core mounts one per node and one for its own pane). A browser has the
 * real thing; the test environment gets the quiet stand-in that lets the library
 * mount and simply never reports a size change — jsdom has no layout to change
 * anyway, so there is nothing for the stub to miss.
 */
if (!('ResizeObserver' in globalThis)) {
  class ResizeObserverStub implements ResizeObserver {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    constructor(_callback: ResizeObserverCallback) {}
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  (globalThis as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver = ResizeObserverStub;
}

afterEach(() => {
  cleanup();
});

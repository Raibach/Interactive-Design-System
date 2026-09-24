/**
 * THE FIRST FRAME IS THE RIGHT SURFACE — the purple flash, pinned.
 *
 * The owner, 2026-09-24, in a browser (the in-app one could not show it): "it flashes purple,
 * which is something wrong with the code."
 *
 * The flash was one frame deep and came from this rule being applied a frame too late. The page
 * computes the surface from the URL (`WritingAreaIndex`: `initialTab: routeSessionId ? "composer"
 * : "console"`), and this hook preferred the PERSISTED tab over that intent — so a person who works
 * in the composer reloading "/" got `headerTab === "composer"` on the first render. The sandbox
 * paints its ground and projects its slot from exactly that value
 * (`ai-surface-sandbox.ts`: `header-tab === 'console' ? #270F31 : #582846`, and
 * `console|workspace` respectively), so the first frames were the composer's plum ground and its
 * slot, and only then did the mount effect correct the tab to the console.
 *
 * The rule that fixes it was already written over that effect — "The persisted tab (localStorage
 * 'activeHeaderTab') must NOT dictate what the front page assembles" — and what these tests pin is
 * that it is now the FIRST RENDER's rule, without changing what a package opens on.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useNotificationGate } from '@/hooks/useNotificationGate';

const WINDOW_KEY = 'activeHeaderTab';

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('useNotificationGate: which tab the first render opens on', () => {
  it('opens the front page as the console even when the composer was the last tab', () => {
    // The exact state that produced the flash: a person who works in the composer.
    localStorage.setItem(WINDOW_KEY, 'composer');
    const { result } = renderHook(() => useNotificationGate({ initialTab: 'console' }));
    expect(result.current.headerTab).toBe('console');
  });

  it('still opens a package on the tab that was last used', () => {
    // The persisted tab is FOR this: a package in the URL, opened where the person left it.
    localStorage.setItem(WINDOW_KEY, 'metadata');
    const { result } = renderHook(() => useNotificationGate({ initialTab: 'composer' }));
    expect(result.current.headerTab).toBe('metadata');
  });

  it('falls back to the caller\'s intent when nothing was persisted', () => {
    const first = renderHook(() => useNotificationGate({ initialTab: 'composer' }));
    expect(first.result.current.headerTab).toBe('composer');
    const second = renderHook(() => useNotificationGate({ initialTab: 'console' }));
    expect(second.result.current.headerTab).toBe('console');
  });

  it('writes the tab it is given, so the next load still remembers where the person was', () => {
    const { result } = renderHook(() => useNotificationGate({ initialTab: 'composer' }));
    result.current.setHeaderTab('variables');
    expect(localStorage.getItem(WINDOW_KEY)).toBe('variables');
  });
});

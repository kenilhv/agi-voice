import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

/** jsdom implements neither matchMedia nor EventSource; tests inject their own transport. */
let reducedMotion = false;

export function setReducedMotion(value: boolean): void {
  reducedMotion = value;
}

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: query.includes('prefers-reduced-motion') ? reducedMotion : false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
});

afterEach(() => {
  cleanup();
  reducedMotion = false;
  window.localStorage.clear();
  vi.restoreAllMocks();
});

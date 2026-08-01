import type { TestScenario } from '@voicefuzz/contracts';
import { applyNumericMutation, currentNumericValue } from './mutations.js';
import { getPauseMs } from './scenario.js';

export interface ExploreOptions {
  failingScenario: TestScenario;
  axis?: 'pause_ms' | 'overlap_ms';
  radius?: number;
  step?: number;
  minCases?: number;
}

/**
 * Generate a bounded neighborhood around a failing numeric point.
 * For hackathon: pause and overlap only.
 */
export function exploreNeighborhood(options: ExploreOptions): TestScenario[] {
  const axis = options.axis ?? 'pause_ms';
  const radius = options.radius ?? 150;
  const step = options.step ?? 25;
  const minCases = options.minCases ?? 3;
  const center = currentNumericValue(options.failingScenario, axis);

  const values = new Set<number>();
  for (let delta = -radius; delta <= radius; delta += step) {
    const value = Math.max(0, center + delta);
    if (value !== center) values.add(value);
  }

  // Ensure asymmetric informative points if set is small
  const extras = [center - 75, center - 25, center + 25, center + 75, center + 100]
    .map((v) => Math.max(0, v))
    .filter((v) => v !== center);
  for (const extra of extras) values.add(extra);

  const sorted = [...values].sort((a, b) => a - b);
  const selected = sorted.slice(0, Math.max(minCases, Math.min(sorted.length, 7)));

  return selected.map((value) => ({
    ...applyNumericMutation(options.failingScenario, axis, value),
    id: `${options.failingScenario.id}-near-${axis}-${value}`,
    label: `explore ${axis}=${value}`,
    metadata: {
      ...(options.failingScenario.metadata ?? {}),
      exploredFrom: options.failingScenario.id,
      axis,
      value,
    },
  }));
}

/**
 * Binary search for the lowest pause where the predicate fails (monotonic assume).
 */
export async function findFailureBoundary(options: {
  base: TestScenario;
  low: number;
  high: number;
  failsAt: (pauseMs: number) => Promise<boolean> | boolean;
}): Promise<number> {
  let lo = options.low;
  let hi = options.high;
  let boundary = hi;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const fails = await options.failsAt(mid);
    if (fails) {
      boundary = mid;
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }
  return boundary;
}

export function defaultBoundaryHint(scenario: TestScenario, silenceThresholdMs = 400): number {
  const pause = getPauseMs(scenario);
  return Math.min(pause, silenceThresholdMs);
}

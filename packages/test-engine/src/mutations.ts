import type { MutationAxis, TestScenario } from '@voicefuzz/contracts';
import { getOverlapMs, getPauseMs, withOverlapMs, withPauseMs } from './scenario.js';

/** Deterministic seeded PRNG (mulberry32). */
export function createSeededRng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function mutateScenario(
  base: TestScenario,
  axes: MutationAxis[],
  seed: number,
): TestScenario[] {
  const rng = createSeededRng(seed);
  const results: TestScenario[] = [];

  for (const axis of axes) {
    const values: number[] = [];
    for (let v = axis.min; v <= axis.max + 1e-9; v += axis.step) {
      values.push(Math.round(v));
    }
    // Deterministic shuffle of grid points using seed
    const shuffled = [...values].sort((a, b) => {
      const ra = createSeededRng(seed + a)();
      const rb = createSeededRng(seed + b)();
      return ra - rb || a - b;
    });

    for (const value of shuffled) {
      // Consume rng so seed changes affect ordering deterministically
      rng();
      if (axis.name === 'pause_ms') {
        results.push({
          ...withPauseMs(base, value),
          suiteId: base.suiteId,
          seed,
          label: `pause=${value}ms`,
        });
      } else {
        results.push({
          ...withOverlapMs(base, value),
          suiteId: base.suiteId,
          seed,
          label: `overlap=${value}ms`,
        });
      }
    }
  }

  if (results.length === 0) {
    return [{ ...base, seed }];
  }
  return results;
}

export function applyNumericMutation(
  scenario: TestScenario,
  axis: 'pause_ms' | 'overlap_ms',
  value: number,
): TestScenario {
  return axis === 'pause_ms' ? withPauseMs(scenario, value) : withOverlapMs(scenario, value);
}

export function currentNumericValue(
  scenario: TestScenario,
  axis: 'pause_ms' | 'overlap_ms',
): number {
  return axis === 'pause_ms' ? getPauseMs(scenario) : getOverlapMs(scenario);
}

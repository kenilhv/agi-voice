import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MockTargetAdapter } from '@voicefuzz/mock-adapter';
import {
  assertSafeArtifactPath,
  exploreNeighborhood,
  loadScenarioFixture,
  minimizeFailure,
  mutateScenario,
  runScenarioAgainstTarget,
  scenarioSize,
} from './index.js';

const fixturePath = fileURLToPath(
  new URL('../../../fixtures/scenarios/reset-correction-seed.yaml', import.meta.url),
);

function demoAgent(variant: 'vulnerable' | 'guarded') {
  return {
    id: 'agent-demo',
    name: 'Mock Support Agent',
    targetVariant: variant,
    silenceThresholdMs: 400,
    deviceId: 'demo-device-001',
    createdAt: new Date().toISOString(),
  };
}

describe('test-engine', () => {
  it('parses the seed scenario fixture', () => {
    const scenario = loadScenarioFixture(fixturePath);
    expect(scenario.id).toBe('reset-correction-seed');
    expect(scenario.seed).toBe(42);
  });

  it('produces identical mutations for seed 42', () => {
    const scenario = loadScenarioFixture(fixturePath);
    const a = mutateScenario(
      scenario,
      [{ name: 'pause_ms', min: 250, max: 800, step: 50 }],
      42,
    ).map((s) => s.id);
    const b = mutateScenario(
      scenario,
      [{ name: 'pause_ms', min: 250, max: 800, step: 50 }],
      42,
    ).map((s) => s.id);
    expect(a).toEqual(b);
  });

  it('fails vulnerable target on reset-correction assertion', async () => {
    const scenario = loadScenarioFixture(fixturePath);
    const result = await runScenarioAgainstTarget({
      runId: 'run-vuln',
      scenario,
      agent: demoAgent('vulnerable'),
      adapter: new MockTargetAdapter('vulnerable'),
    });
    expect(result.passed).toBe(false);
    expect(result.failureClass).toBe('TOOL_COMMIT_FAILURE');
  });

  it('passes guarded target on reset-correction assertion', async () => {
    const scenario = loadScenarioFixture(fixturePath);
    const result = await runScenarioAgainstTarget({
      runId: 'run-guard',
      scenario,
      agent: demoAgent('guarded'),
      adapter: new MockTargetAdapter('guarded'),
    });
    expect(result.passed).toBe(true);
  });

  it('exploration adds at least three nearby cases', () => {
    const scenario = loadScenarioFixture(fixturePath);
    const nearby = exploreNeighborhood({ failingScenario: scenario, axis: 'pause_ms' });
    expect(nearby.length).toBeGreaterThanOrEqual(3);
  });

  it('minimization produces a strictly smaller structured scenario', async () => {
    const scenario = loadScenarioFixture(fixturePath);
    const cx = await minimizeFailure({
      failureId: 'f1',
      scenario,
      agent: demoAgent('vulnerable'),
      adapter: new MockTargetAdapter('vulnerable'),
    });
    expect(scenarioSize(cx.minimizedScenario)).toBeLessThan(scenarioSize(cx.originalScenario));
  });

  it('replaying minimized scenario reproduces vulnerable failure', async () => {
    const scenario = loadScenarioFixture(fixturePath);
    const cx = await minimizeFailure({
      failureId: 'f2',
      scenario,
      agent: demoAgent('vulnerable'),
      adapter: new MockTargetAdapter('vulnerable'),
    });
    const replay = await runScenarioAgainstTarget({
      runId: 'run-replay',
      scenario: cx.minimizedScenario,
      agent: demoAgent('vulnerable'),
      adapter: new MockTargetAdapter('vulnerable'),
    });
    expect(replay.passed).toBe(false);

    const fixed = await runScenarioAgainstTarget({
      runId: 'run-fixed',
      scenario: cx.minimizedScenario,
      agent: demoAgent('guarded'),
      adapter: new MockTargetAdapter('guarded'),
    });
    expect(fixed.passed).toBe(true);
  });

  it('blocks artifact path traversal', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vf-art-'));
    try {
      expect(() => assertSafeArtifactPath(dir, '../secret.txt')).toThrow(/Path traversal/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

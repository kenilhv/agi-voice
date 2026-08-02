import { describe, expect, it } from 'vitest';
import type { Counterexample, TestResult } from '@voicefuzz/contracts';
import { DEMO_FIXTURE_EVENTS } from '@/lib/fixtures';
import {
  deriveBoundary,
  deriveCases,
  deriveClassificationEvidence,
  deriveKpis,
  deriveLedgerSummary,
  deriveStageStatus,
  deriveVerificationLanes,
  deriveWaterfall,
  isTerminalState,
} from '@/lib/derive';

const results: TestResult[] = DEMO_FIXTURE_EVENTS.flatMap((event) =>
  event.result ? [event.result] : [],
);
const counterexample: Counterexample = DEMO_FIXTURE_EVENTS.find(
  (event) => event.counterexample,
)!.counterexample!;

describe('deriveBoundary', () => {
  it('brackets the behavioural boundary from observed passes and failures', () => {
    const boundary = deriveBoundary(results);
    expect(boundary.lastPassingPauseMs).toBe(375);
    expect(boundary.firstFailingPauseMs).toBe(400);
    expect(boundary.passing).toContain(350);
    expect(boundary.failing).toContain(500);
  });

  it('reports no bounds when only one outcome has been seen', () => {
    const boundary = deriveBoundary(results.filter((result) => result.passed));
    expect(boundary.firstFailingPauseMs).toBeUndefined();
  });
});

describe('deriveVerificationLanes', () => {
  it('marks verified only when the same artifact fails then passes', () => {
    const lanes = deriveVerificationLanes(results, counterexample);
    expect(lanes.scenarioId).toBe(counterexample.minimizedScenario.id);
    expect(lanes.vulnerable?.passed).toBe(false);
    expect(lanes.guarded?.passed).toBe(true);
    expect(lanes.verified).toBe(true);
  });

  it('is not verified without a counterexample', () => {
    expect(deriveVerificationLanes(results, undefined).verified).toBe(false);
  });

  it('is not verified when the guarded replay is missing', () => {
    const onlyVulnerable = results.filter(
      (result) => result.scenarioId !== counterexample.minimizedScenario.id || !result.passed,
    );
    expect(deriveVerificationLanes(onlyVulnerable, counterexample).verified).toBe(false);
  });
});

describe('deriveStageStatus', () => {
  it('marks the tool stage failed when a tool-commit failure was observed', () => {
    const failing = results.find((result) => !result.passed)!;
    const status = deriveStageStatus({ timeline: failing.timeline, results: [failing] });
    expect(status.tool).toBe('failed');
    expect(status.vad).not.toBe('idle');
  });

  it('lights reasoning and TTS from result timelines, not only streamed frames', () => {
    // The orchestrator streams just the leading events of each case as `timeline`
    // frames; the reasoning/tool/TTS marks only ever arrive inside `result`.
    const failing = results.find((result) => !result.passed)!;
    const streamedLeadingFramesOnly = failing.timeline.slice(0, 4);
    const status = deriveStageStatus({
      timeline: streamedLeadingFramesOnly,
      results: [failing],
    });

    expect(streamedLeadingFramesOnly.some((event) => event.layer === 'llm')).toBe(false);
    expect(status.llm).not.toBe('idle');
    expect(status.tts).not.toBe('idle');
  });

  it('leaves untouched stages idle', () => {
    expect(deriveStageStatus({ timeline: [], results: [] })).toEqual({
      vad: 'idle',
      stt: 'idle',
      llm: 'idle',
      tool: 'idle',
      tts: 'idle',
    });
  });
});

describe('deriveWaterfall', () => {
  it('orders timing marks and flags the critical ones', () => {
    const failing = results.find((result) => !result.passed)!;
    const rows = deriveWaterfall(failing);
    const timestamps = rows.map((row) => row.tsMs);
    expect([...timestamps].sort((a, b) => a - b)).toEqual(timestamps);
    expect(rows.some((row) => row.key === 'tool-committed' && row.critical)).toBe(true);
  });

  it('returns nothing without a result', () => {
    expect(deriveWaterfall(undefined)).toEqual([]);
  });
});

describe('deriveLedgerSummary', () => {
  it('reports the final state per tool', () => {
    const failing = results.find((result) => !result.passed)!;
    const summary = deriveLedgerSummary(failing.toolLedger);
    const prepare = summary.find((entry) => entry.tool === 'prepare_factory_reset');
    expect(prepare?.finalState).toBe('committed');
  });
});

describe('deriveClassificationEvidence', () => {
  it('cites observable timeline facts, not invented confidence', () => {
    const failing = results.find((result) => !result.passed)!;
    const evidence = deriveClassificationEvidence(failing);
    expect(evidence.join(' ')).toMatch(/VAD committed end-of-turn/);
    expect(evidence.join(' ')).not.toMatch(/%/);
  });
});

describe('deriveCases and deriveKpis', () => {
  it('flags adaptive cases and counts real outcomes', () => {
    const cases = deriveCases(results);
    expect(cases.some((item) => item.explored)).toBe(true);
    const kpis = deriveKpis(results, 1);
    expect(kpis.testsRun).toBe(results.length);
    expect(kpis.failures).toBeGreaterThan(0);
    expect(kpis.minimized).toBe(1);
  });

  it('has no pass rate before any result exists', () => {
    expect(deriveKpis([], 0).regressionPassRate).toBeUndefined();
  });
});

describe('isTerminalState', () => {
  it('treats intermediate states as non-terminal', () => {
    expect(isTerminalState('failed')).toBe(false);
    expect(isTerminalState('minimized')).toBe(false);
    expect(isTerminalState('verified')).toBe(true);
    expect(isTerminalState('error')).toBe(true);
  });
});

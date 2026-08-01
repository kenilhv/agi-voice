import type { AgentProfile, Counterexample, TestScenario } from '@voicefuzz/contracts';
import type { TargetAdapter } from '@voicefuzz/inworld-adapter';
import { runScenarioAgainstTarget } from './runner.js';
import { getOverlapMs, getPauseMs, scenarioSize, withOverlapMs, withPauseMs } from './scenario.js';

const SPEECH_ALTERNATIVES: Record<string, string[]> = {
  'Start the factory reset': ['Start the reset', 'Reset it'],
  'Wait, no, do not reset it': ['Wait, no', 'Do not reset', 'Cancel'],
};

async function stillFails(
  scenario: TestScenario,
  agent: AgentProfile,
  adapter: TargetAdapter,
  runId: string,
): Promise<boolean> {
  const result = await runScenarioAgainstTarget({ runId, scenario, agent, adapter });
  return !result.passed;
}

/**
 * Structural minimization over scenario DSL nodes and timing values.
 * Re-runs after each candidate; never slices waveforms.
 */
export async function minimizeFailure(options: {
  failureId: string;
  scenario: TestScenario;
  agent: AgentProfile;
  adapter: TargetAdapter;
  runId?: string;
}): Promise<Counterexample> {
  const runId = options.runId ?? `minimize-${options.failureId}`;
  let current = structuredClone(options.scenario);
  const notes: string[] = [];

  // 1) Drop optional noise segments
  const withoutNoise = {
    ...current,
    segments: current.segments.filter((s) => s.type !== 'noise'),
  };
  if (
    withoutNoise.segments.length < current.segments.length &&
    (await stillFails(withoutNoise, options.agent, options.adapter, runId))
  ) {
    current = withoutNoise;
    notes.push('Removed noise segments');
  }

  // 2) Simplify speech text with semantic-preserving alternatives
  for (let i = 0; i < current.segments.length; i++) {
    const segment = current.segments[i];
    if (!segment || segment.type !== 'speech') continue;
    const alts = SPEECH_ALTERNATIVES[segment.text] ?? [];
    for (const alt of alts) {
      const candidate: TestScenario = {
        ...current,
        id: `${current.id}-t${i}-${alt.length}`,
        segments: current.segments.map((s, idx) =>
          idx === i && s.type === 'speech' ? { ...s, text: alt } : s,
        ),
      };
      if (
        scenarioSize(candidate) < scenarioSize(current) &&
        (await stillFails(candidate, options.agent, options.adapter, runId))
      ) {
        current = candidate;
        notes.push(`Simplified speech[${i}] to "${alt}"`);
        break;
      }
    }
  }

  // 3) Strip delivery variation to calm
  const calmCandidate: TestScenario = {
    ...current,
    segments: current.segments.map((s) =>
      s.type === 'speech' ? { ...s, delivery: 'calm' as const } : s,
    ),
  };
  if (await stillFails(calmCandidate, options.agent, options.adapter, runId)) {
    if (JSON.stringify(calmCandidate.segments) !== JSON.stringify(current.segments)) {
      current = calmCandidate;
      notes.push('Removed non-calm delivery variation');
    }
  }

  // 4) Reduce pause toward threshold boundary while failure holds
  const pause = getPauseMs(current);
  for (const candidatePause of [pause - 50, pause - 25, 412, 400].filter(
    (p) => p > 0 && p < pause,
  )) {
    const candidate = withPauseMs(current, candidatePause);
    if (await stillFails(candidate, options.agent, options.adapter, runId)) {
      current = { ...candidate, id: `${options.scenario.id}-min-p${candidatePause}` };
      notes.push(`Reduced pause_ms to ${candidatePause}`);
      break;
    }
  }

  // 5) Reduce overlap if present
  const overlap = getOverlapMs(current);
  if (overlap > 0) {
    for (const candidateOverlap of [Math.floor(overlap / 2), 50, 0]) {
      if (candidateOverlap >= overlap) continue;
      const candidate = withOverlapMs(current, candidateOverlap);
      if (await stillFails(candidate, options.agent, options.adapter, runId)) {
        current = { ...candidate, id: `${current.id}-o${candidateOverlap}` };
        notes.push(`Reduced overlap_ms to ${candidateOverlap}`);
        break;
      }
    }
  }

  if (!(await stillFails(current, options.agent, options.adapter, runId))) {
    // Fall back to original if reductions somehow lost the failure
    current = options.scenario;
    notes.push('Fell back to original failing scenario');
  }

  if (scenarioSize(current) >= scenarioSize(options.scenario) && notes.length === 0) {
    // Force a strictly smaller structured scenario for demo determinism when possible
    const forced = withPauseMs(options.scenario, Math.max(400, getPauseMs(options.scenario) - 50));
    if (
      scenarioSize(forced) < scenarioSize(options.scenario) &&
      (await stillFails(forced, options.agent, options.adapter, runId))
    ) {
      current = { ...forced, id: `${options.scenario.id}-min` };
      notes.push(`Forced smaller pause_ms=${getPauseMs(forced)}`);
    }
  }

  return {
    id: `cx-${options.failureId}`,
    failureId: options.failureId,
    originalScenario: options.scenario,
    minimizedScenario: {
      ...current,
      id: current.id.includes('min') ? current.id : `${current.id}-min`,
      label: 'minimized counterexample',
      metadata: {
        ...(current.metadata ?? {}),
        minimized: true,
        demoFixture: true,
      },
    },
    boundary: {
      pause_ms: getPauseMs(current),
      overlap_ms: getOverlapMs(current),
    },
    reductionNotes: notes,
  };
}

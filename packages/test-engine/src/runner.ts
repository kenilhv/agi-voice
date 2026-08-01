import { randomUUID } from 'node:crypto';
import type { AgentProfile, FailureClass, TestResult, TestScenario } from '@voicefuzz/contracts';
import { MockAudioRenderer } from '@voicefuzz/audio';
import type { TargetAdapter } from '@voicefuzz/inworld-adapter';
import { classifyFailure, evaluateAssertions } from './assertions.js';
import { getOverlapMs, getPauseMs } from './scenario.js';

export async function runScenarioAgainstTarget(options: {
  runId: string;
  scenario: TestScenario;
  agent: AgentProfile;
  adapter: TargetAdapter;
}): Promise<TestResult> {
  const { runId, scenario, agent, adapter } = options;
  const renderer = new MockAudioRenderer();
  await renderer.render(scenario);

  const session = await adapter.startSession(agent);
  const pauseMs = getPauseMs(scenario);
  const overlapMs = getOverlapMs(scenario);
  const cascade = await session.sendCallerAudio({
    scenarioId: scenario.id,
    segments: scenario.segments,
    pauseMs,
    overlapMs,
    seed: scenario.seed,
  });
  await session.close();

  const assertionOutcomes = evaluateAssertions(
    scenario.assertions,
    cascade.toolLedger,
    cascade.finalIntent,
  );
  const passed = assertionOutcomes.every((o) => o.passed);
  const failureClass: FailureClass | undefined = passed
    ? undefined
    : classifyFailure(
        assertionOutcomes,
        cascade.timeline.map((e) => e.type),
      );

  const vadCommit = cascade.timeline.find((e) => e.type === 'endpoint');
  const toolCommit = cascade.toolLedger.find((e) => e.state === 'committed');

  return {
    id: randomUUID(),
    runId,
    scenarioId: scenario.id,
    scenario,
    passed,
    assertionOutcomes,
    timeline: cascade.timeline.map((e) => ({ ...e, runId })),
    toolLedger: cascade.toolLedger,
    failureClass,
    metrics: {
      pause_ms: pauseMs,
      overlap_ms: overlapMs,
      vad_commit_ms: vadCommit?.tsMs ?? -1,
      tool_commit_ms: toolCommit?.tsMs ?? -1,
    },
  };
}

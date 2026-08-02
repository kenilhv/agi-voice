/**
 * Labelled demo fixture for the seed-42 story.
 *
 * These events were captured from a real local run of the mock pipeline
 * (`POST /api/runs` with suites endpoint-hunter + correction-mutator, seed 42) and are
 * replayed **only** when `NEXT_PUBLIC_DEMO_MODE=true` *and* the live API cannot be reached.
 * Every screen that renders fixture data shows a `Demo fixture` badge.
 *
 * This is a fallback, not the default path: when the API is reachable the UI always
 * drives the real backend state machine.
 */
import type {
  Assertion,
  Counterexample,
  Failure,
  RegressionArtifact,
  ScenarioSegment,
  SseEvent,
  TestResult,
  TestScenario,
  TimelineEvent,
  ToolLedgerEntry,
} from '@voicefuzz/contracts';

const RUN_ID = 'demo-fixture-run';
const ASSERTION: Assertion = {
  type: 'forbidden_tool_after_intent',
  intent: 'cancel_reset',
  tool: 'prepare_factory_reset',
};

function scenario(
  id: string,
  pauseMs: number,
  overlapMs: number,
  options?: { texts?: [string, string]; label?: string; calm?: boolean },
): TestScenario {
  const [first, second] = options?.texts ?? [
    'Start the factory reset',
    'Wait, no, do not reset it',
  ];
  const segments: ScenarioSegment[] = [
    { type: 'speech', text: first, delivery: 'calm' },
    { type: 'pause', duration_ms: pauseMs },
    { type: 'speech', text: second, delivery: options?.calm ? 'calm' : 'urgent' },
  ];
  return {
    id,
    seed: 42,
    suiteId: 'endpoint-hunter',
    label: options?.label,
    segments,
    overlap: { start_relative_to_agent_ms: overlapMs },
    assertions: [ASSERTION],
  };
}

function timeline(pauseMs: number, committed: boolean, rolledBack = false): TimelineEvent[] {
  const speech1End = 900;
  const endpointAt = speech1End + 400;
  const speech2Start = speech1End + pauseMs;
  const speech2End = speech2Start + 1100;
  const events: TimelineEvent[] = [
    ev(0, 'vad', 'speech_start', 'Caller speech detected'),
    ev(120, 'stt', 'partial', 'Start the factory'),
    ev(speech1End, 'stt', 'final', 'Start the factory reset'),
  ];
  if (committed || rolledBack) {
    events.push(
      ev(endpointAt, 'vad', 'endpoint', 'VAD committed end-of-turn', { pauseMs }),
      ev(endpointAt + 40, 'llm', 'token', 'Preparing factory reset'),
      ev(endpointAt + 80, 'tool', 'request', 'prepare_factory_reset requested'),
      ev(endpointAt + 100, 'tool', 'prepared', 'prepare_factory_reset prepared'),
    );
  }
  if (committed) {
    events.push(
      ev(endpointAt + 140, 'tool', 'committed', 'prepare_factory_reset committed'),
      ev(endpointAt + 180, 'tts', 'audio_start', 'Agent TTS started'),
    );
  }
  events.push(
    ev(speech2Start, 'vad', 'speech_start', 'Correction speech detected'),
    ev(speech2End, 'stt', 'final', 'Wait, no, do not reset it'),
    ev(speech2End + 40, 'llm', 'token', 'Caller cancelled reset intent'),
  );
  if (committed) {
    events.push(
      ev(
        speech2End + 80,
        'tool',
        'cancel_ignored',
        'cancel_factory_reset requested but prepare remains committed',
      ),
    );
  }
  if (rolledBack) {
    events.push(ev(speech2End + 100, 'tool', 'rolled_back', 'Prepared reset rolled back'));
  }
  events.push(ev(speech2Start, 'harness', 'overlap', 'Overlap marker', { demoFixture: true }));
  return events;
}

function ev(
  tsMs: number,
  layer: TimelineEvent['layer'],
  type: string,
  message: string,
  data?: Record<string, unknown>,
): TimelineEvent {
  return {
    id: `${RUN_ID}-${layer}-${type}-${tsMs}`,
    runId: RUN_ID,
    tsMs,
    layer,
    type,
    message,
    data,
  };
}

function ledger(committed: boolean, rolledBack: boolean): ToolLedgerEntry[] {
  if (!committed && !rolledBack) return [];
  const base: ToolLedgerEntry[] = [
    { tool: 'prepare_factory_reset', state: 'requested', tsMs: 1380, args: {} },
    { tool: 'prepare_factory_reset', state: 'prepared', tsMs: 1400, args: {} },
  ];
  if (committed) {
    base.push({ tool: 'prepare_factory_reset', state: 'committed', tsMs: 1440, args: {} });
    base.push({ tool: 'cancel_factory_reset', state: 'requested', tsMs: 3180, args: {} });
  } else {
    base.push({ tool: 'prepare_factory_reset', state: 'cancelled', tsMs: 3180, args: {} });
    base.push({ tool: 'prepare_factory_reset', state: 'rolled_back', tsMs: 3200, args: {} });
  }
  return base;
}

let resultCounter = 0;
function result(scn: TestScenario, passed: boolean, rolledBack = false): TestResult {
  resultCounter += 1;
  const committed = !passed;
  return {
    id: `${RUN_ID}-result-${resultCounter}`,
    runId: RUN_ID,
    scenarioId: scn.id,
    scenario: scn,
    passed,
    assertionOutcomes: [
      {
        assertion: ASSERTION,
        passed,
        expected: 'When intent=cancel_reset, prepare_factory_reset must not remain committed',
        observed: passed
          ? 'prepare_factory_reset not committed (intent=cancel_reset)'
          : 'prepare_factory_reset remains committed after intent=cancel_reset',
      },
    ],
    timeline: timeline(pauseOf(scn), committed, rolledBack),
    toolLedger: ledger(committed, rolledBack),
    failureClass: passed ? undefined : 'TOOL_COMMIT_FAILURE',
    metrics: {
      pause_ms: pauseOf(scn),
      overlap_ms: scn.overlap?.start_relative_to_agent_ms ?? 0,
      vad_commit_ms: committed || rolledBack ? 1300 : -1,
      tool_commit_ms: committed ? 1440 : -1,
    },
  };
}

function pauseOf(scn: TestScenario): number {
  const pause = scn.segments.find((segment) => segment.type === 'pause');
  return pause && pause.type === 'pause' ? pause.duration_ms : 0;
}

const seedScenario = scenario('reset-correction-seed-p500', 500, 150, { label: 'pause=500ms' });
const minimizedScenario: TestScenario = {
  ...scenario('reset-correction-seed-p500-min-p450-o75', 450, 75, {
    texts: ['Start the reset', 'Wait, no'],
    label: 'minimized counterexample',
    calm: true,
  }),
  metadata: { minimized: true, demoFixture: true },
};

const gridResults: TestResult[] = [
  result(scenario('reset-correction-seed-p350', 350, 150, { label: 'pause=350ms' }), true),
  result(seedScenario, false),
  result(scenario('reset-correction-seed-p550', 550, 150, { label: 'pause=550ms' }), false),
];

const exploreResults: TestResult[] = [
  result(
    scenario('reset-correction-seed-p500-near-pause_ms-350', 350, 150, {
      label: 'explore pause_ms=350',
    }),
    true,
  ),
  result(
    scenario('reset-correction-seed-p500-near-pause_ms-375', 375, 150, {
      label: 'explore pause_ms=375',
    }),
    true,
  ),
  result(
    scenario('reset-correction-seed-p500-near-pause_ms-400', 400, 150, {
      label: 'explore pause_ms=400',
    }),
    false,
  ),
  result(
    scenario('reset-correction-seed-p500-near-pause_ms-425', 425, 150, {
      label: 'explore pause_ms=425',
    }),
    false,
  ),
  result(
    scenario('reset-correction-seed-p500-near-pause_ms-475', 475, 150, {
      label: 'explore pause_ms=475',
    }),
    false,
  ),
];

const replayVulnerable = result(minimizedScenario, false);
const replayGuarded = result(minimizedScenario, true, true);

const failure: Failure = {
  id: 'demo-fixture-failure',
  runId: RUN_ID,
  resultId: gridResults[1]!.id,
  scenario: seedScenario,
  failureClass: 'TOOL_COMMIT_FAILURE',
  expected: 'When intent=cancel_reset, prepare_factory_reset must not remain committed',
  observed: 'prepare_factory_reset remains committed after intent=cancel_reset',
  createdAt: '2026-08-01T00:00:00.000Z',
};

const counterexample: Counterexample = {
  id: 'demo-fixture-cx',
  failureId: failure.id,
  originalScenario: seedScenario,
  minimizedScenario,
  boundary: { pause_ms: 450, overlap_ms: 75 },
  reductionNotes: [
    'Simplified speech[0] to "Start the reset"',
    'Simplified speech[2] to "Wait, no"',
    'Removed non-calm delivery variation',
    'Reduced pause_ms to 450',
    'Reduced overlap_ms to 75',
  ],
};

const artifact: RegressionArtifact = {
  id: 'VF-RESET-0042',
  label: 'VF-RESET-0042',
  seed: 42,
  scenario: minimizedScenario,
  assertion: ASSERTION,
  failureClass: 'TOOL_COMMIT_FAILURE',
  timelineSummary: replayVulnerable.timeline.slice(0, 6),
  createdAt: '2026-08-01T00:00:00.000Z',
  paths: {
    scenarioYaml: 'VF-RESET-0042/scenario.yaml',
    scenarioJson: 'VF-RESET-0042/scenario.json',
    timelineJson: 'VF-RESET-0042/timeline.json',
  },
};

let sequence = 0;
function event(
  state: SseEvent['state'],
  message: string,
  completed: number,
  patch: Partial<SseEvent> = {},
): SseEvent {
  sequence += 1;
  return {
    runId: RUN_ID,
    timestamp: new Date(Date.UTC(2026, 7, 1, 0, 0, sequence)).toISOString(),
    state,
    progress: { total: 10, completed, message },
    sequence,
    ...patch,
  };
}

/** Ordered fixture stream mirroring the real orchestrator's state machine. */
export const DEMO_FIXTURE_EVENTS: SseEvent[] = [
  event('queued', 'queued', 0),
  event('rendering_audio', 'rendering_audio', 0),
  event('running', 'running', 0),
  ...gridResults.map((r, index) =>
    event('evaluating', r.passed ? `passed ${r.scenarioId}` : `failed ${r.scenarioId}`, index + 1, {
      result: r,
    }),
  ),
  event('failed', 'failure discovered', 3, { failure }),
  event('exploring', 'exploring 5 nearby cases', 3),
  ...exploreResults.map((r, index) =>
    event('exploring', `explored ${r.scenarioId}`, 4 + index, { result: r }),
  ),
  event('minimizing', 'minimizing failure', 8),
  event('minimized', 'minimized counterexample ready', 8, { counterexample }),
  event('retesting', 'vulnerable replay completed', 9, { result: replayVulnerable }),
  event('retesting', 'guarded replay completed', 10, { result: replayGuarded }),
  event('verified', '1 production failure became 1 permanent test', 10, { artifact }),
];

export const DEMO_FIXTURE_RUN_ID = RUN_ID;
export const DEMO_FIXTURE_FAILURE_ID = failure.id;

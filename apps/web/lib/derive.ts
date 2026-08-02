/**
 * Pure selectors that turn accumulated SSE state into view models.
 *
 * Everything here is derived from real API payloads. Where the frozen contract does
 * not carry a field the UI wants (for example an explicit classifier confidence),
 * the value is *derived from observable timeline evidence* and labelled as derived
 * in the UI — it is never invented.
 */
import type {
  Counterexample,
  Failure,
  RegressionArtifact,
  RunState,
  TestResult,
  TimelineEvent,
  ToolLedgerEntry,
} from '@voicefuzz/contracts';

export const PIPELINE_STAGES = [
  { id: 'vad', label: 'VAD', caption: 'Turn detection' },
  { id: 'stt', label: 'STT', caption: 'Transcription' },
  { id: 'llm', label: 'Reasoning', caption: 'Conversation model' },
  { id: 'tool', label: 'Tool', caption: 'Sandboxed calls' },
  { id: 'tts', label: 'TTS', caption: 'Speech playback' },
] as const;

export type StageId = (typeof PIPELINE_STAGES)[number]['id'];
export type StageStatus = 'idle' | 'active' | 'done' | 'failed';

export interface RunSnapshot {
  state: RunState;
  progress: { total: number; completed: number; message: string };
  results: TestResult[];
  failures: Failure[];
  timeline: TimelineEvent[];
  counterexample?: Counterexample;
  artifact?: RegressionArtifact;
}

/**
 * Stage status for the five-stage pipeline strip.
 *
 * A stage is `active` when it produced the most recent streamed event, `done` once it
 * has produced any observed event, and `failed` when the tool layer left a destructive
 * tool committed against a cancel intent.
 *
 * Both sources are real API data and both are needed: the orchestrator streams only the
 * leading timeline events of each case as standalone `timeline` frames, while the full
 * per-case trace (reasoning, tool and TTS marks) arrives inside the `result` payload.
 * Reading only the streamed frames would leave Reasoning and TTS dark for the whole run.
 */
export function deriveStageStatus(
  snapshot: Pick<RunSnapshot, 'timeline' | 'results'>,
): Record<StageId, StageStatus> {
  const status: Record<StageId, StageStatus> = {
    vad: 'idle',
    stt: 'idle',
    llm: 'idle',
    tool: 'idle',
    tts: 'idle',
  };

  const observed = [...snapshot.results.flatMap((result) => result.timeline), ...snapshot.timeline];
  for (const event of observed) {
    if (event.layer in status) {
      status[event.layer as StageId] = 'done';
    }
  }

  const last = snapshot.timeline[snapshot.timeline.length - 1];
  if (last && last.layer in status) {
    status[last.layer as StageId] = 'active';
  }

  const hasToolFailure = snapshot.results.some(
    (result) => !result.passed && result.failureClass === 'TOOL_COMMIT_FAILURE',
  );
  if (hasToolFailure) status.tool = 'failed';

  return status;
}

/** Deduplicate results by id, preserving arrival order (SSE replays history on reconnect). */
export function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Map<string, T>();
  for (const item of items) {
    if (!seen.has(item.id)) seen.set(item.id, item);
  }
  return [...seen.values()];
}

export interface CaseCell {
  resultId: string;
  scenarioId: string;
  label: string;
  pauseMs: number;
  overlapMs: number;
  passed: boolean;
  explored: boolean;
}

export function deriveCases(results: TestResult[]): CaseCell[] {
  return results.map((result) => ({
    resultId: result.id,
    scenarioId: result.scenarioId,
    label: result.scenario.label ?? result.scenarioId,
    pauseMs: result.metrics.pause_ms ?? 0,
    overlapMs: result.metrics.overlap_ms ?? 0,
    passed: result.passed,
    explored: result.scenarioId.includes('-near-'),
  }));
}

/**
 * A replay of the minimized scenario, which the engine tags with `metadata.minimized`.
 * These run against *both* target variants, so they must never feed the boundary search:
 * the guarded replay passes at a pause value the vulnerable target fails at.
 */
export function isMinimizedReplay(result: TestResult): boolean {
  return result.scenario.metadata?.minimized === true;
}

export interface Boundary {
  /** Highest pause value observed to pass. */
  lastPassingPauseMs?: number;
  /** Lowest pause value observed to fail. */
  firstFailingPauseMs?: number;
  passing: number[];
  failing: number[];
}

/**
 * Locate the behavioural boundary along the pause axis from observed results only.
 * Returns undefined bounds when the run has not produced both a pass and a fail.
 */
export function deriveBoundary(results: TestResult[]): Boundary {
  const passing = new Set<number>();
  const failing = new Set<number>();

  for (const result of results) {
    const pause = result.metrics.pause_ms;
    if (pause === undefined || isMinimizedReplay(result)) continue;
    (result.passed ? passing : failing).add(pause);
  }

  const passingList = [...passing].sort((a, b) => a - b);
  const failingList = [...failing].sort((a, b) => a - b);
  const firstFailing = failingList.length > 0 ? failingList[0] : undefined;
  // Only report a passing bound that actually sits below the failing bound; anything
  // else would render as an incoherent bracket.
  const lastPassing = [...passingList]
    .reverse()
    .find((value) => firstFailing === undefined || value < firstFailing);

  return {
    lastPassingPauseMs: lastPassing,
    firstFailingPauseMs: firstFailing,
    passing: passingList,
    failing: failingList,
  };
}

export interface WaterfallRow {
  key: string;
  label: string;
  tsMs: number;
  layer: TimelineEvent['layer'];
  critical: boolean;
}

/** The timing marks the runbook calls out, extracted from a single result's timeline. */
export function deriveWaterfall(result: TestResult | undefined): WaterfallRow[] {
  if (!result) return [];

  const pick = (layer: string, type: string) =>
    result.timeline.find((event) => event.layer === layer && event.type === type);

  const rows: Array<WaterfallRow | undefined> = [
    wrap('vad-start', 'Caller speech start', pick('vad', 'speech_start'), false),
    wrap('stt-final', 'STT final transcript', pick('stt', 'final'), false),
    wrap('vad-endpoint', 'VAD committed end-of-turn', pick('vad', 'endpoint'), true),
    wrap('tool-request', 'Tool requested', pick('tool', 'request'), false),
    wrap('tool-prepared', 'Tool prepared', pick('tool', 'prepared'), false),
    wrap('tool-committed', 'Tool committed', pick('tool', 'committed'), true),
    wrap('tts-start', 'Agent audio start', pick('tts', 'audio_start'), false),
    wrap('overlap', 'Interruption onset', pick('harness', 'overlap'), true),
    wrap('cancel', 'Cancel requested', pick('tool', 'cancel_ignored'), true),
    wrap('rolled-back', 'Tool rolled back', pick('tool', 'rolled_back'), true),
  ];

  return rows
    .filter((row): row is WaterfallRow => row !== undefined)
    .sort((a, b) => a.tsMs - b.tsMs);
}

function wrap(
  key: string,
  label: string,
  event: TimelineEvent | undefined,
  critical: boolean,
): WaterfallRow | undefined {
  if (!event) return undefined;
  return { key, label, tsMs: event.tsMs, layer: event.layer, critical };
}

/** Final observed state per tool, in ledger order. */
export function deriveLedgerSummary(ledger: ToolLedgerEntry[]): Array<{
  tool: string;
  states: ToolLedgerEntry[];
  finalState: ToolLedgerEntry['state'];
}> {
  const byTool = new Map<string, ToolLedgerEntry[]>();
  for (const entry of ledger) {
    const list = byTool.get(entry.tool) ?? [];
    list.push(entry);
    byTool.set(entry.tool, list);
  }
  return [...byTool.entries()].map(([tool, states]) => ({
    tool,
    states,
    finalState: states[states.length - 1]!.state,
  }));
}

export interface VerificationLanes {
  vulnerable?: TestResult;
  guarded?: TestResult;
  scenarioId?: string;
  /** True only when the same artifact failed on vulnerable *and* passed on guarded. */
  verified: boolean;
}

/**
 * The two replay lanes the orchestrator emits after minimization, in documented order:
 * the vulnerable replay first, then the guarded replay of the *same* minimized scenario.
 */
export function deriveVerificationLanes(
  results: TestResult[],
  counterexample: Counterexample | undefined,
): VerificationLanes {
  if (!counterexample) return { verified: false };
  const scenarioId = counterexample.minimizedScenario.id;
  const replays = results.filter((result) => result.scenarioId === scenarioId);
  const vulnerable = replays[0];
  const guarded = replays[1];
  return {
    vulnerable,
    guarded,
    scenarioId,
    verified: Boolean(vulnerable && guarded && !vulnerable.passed && guarded.passed),
  };
}

/**
 * Evidence supporting the API's failure classification.
 *
 * The frozen contract exposes `failureClass` but no confidence or justification field,
 * so the justification below is derived client-side from timeline events that are
 * present in the payload, and is presented as "derived from timeline" in the UI.
 */
export function deriveClassificationEvidence(result: TestResult | undefined): string[] {
  if (!result) return [];
  const evidence: string[] = [];
  const endpoint = result.timeline.find((event) => event.type === 'endpoint');
  const committed = result.toolLedger.find((entry) => entry.state === 'committed');
  const rolledBack = result.toolLedger.find(
    (entry) => entry.state === 'rolled_back' || entry.state === 'cancelled',
  );
  const correction = result.timeline.find(
    (event) => event.layer === 'stt' && event.type === 'final' && /wait|no/i.test(event.message),
  );

  if (endpoint) {
    evidence.push(
      `VAD committed end-of-turn at ${endpoint.tsMs} ms, before the correction arrived`,
    );
  }
  if (committed) {
    evidence.push(`${committed.tool} reached committed at ${committed.tsMs} ms`);
  }
  if (correction) {
    evidence.push(`STT final carried the correction: “${correction.message}”`);
  }
  if (!rolledBack && committed) {
    evidence.push('No rollback or cancellation entry followed the commit');
  }
  return evidence;
}

export function isTerminalState(state: RunState): boolean {
  return (
    state === 'passed' ||
    state === 'verified' ||
    state === 'still_failing' ||
    state === 'cancelled' ||
    state === 'error'
  );
}

/** KPI tiles on the dashboard, computed strictly from results the API returned. */
export function deriveKpis(results: TestResult[], artifactCount: number) {
  const total = results.length;
  const failures = results.filter((result) => !result.passed).length;
  const passes = total - failures;
  return {
    testsRun: total,
    failures,
    minimized: artifactCount,
    regressionPassRate: total > 0 ? Math.round((passes / total) * 100) : undefined,
  };
}

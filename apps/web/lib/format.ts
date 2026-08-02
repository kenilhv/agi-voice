/** Display helpers. Timings are rendered with tabular numerals throughout the UI. */

export function ms(value: number | undefined | null): string {
  if (value === undefined || value === null || Number.isNaN(value) || value < 0) return '—';
  return `${Math.round(value)} ms`;
}

export function percent(numerator: number, denominator: number): string {
  if (denominator <= 0) return '—';
  return `${Math.round((numerator / denominator) * 100)}%`;
}

const RUN_STATE_LABELS: Record<string, string> = {
  queued: 'Queued',
  rendering_audio: 'Rendering audio',
  running: 'Running',
  evaluating: 'Evaluating',
  passed: 'All passed',
  failed: 'Failure found',
  exploring: 'Exploring',
  minimizing: 'Minimizing',
  minimized: 'Minimized',
  retesting: 'Retesting',
  verified: 'Verified',
  still_failing: 'Still failing',
  cancelled: 'Cancelled',
  error: 'Error',
};

export function runStateLabel(state: string): string {
  return RUN_STATE_LABELS[state] ?? state;
}

const FAILURE_CLASS_LABELS: Record<string, string> = {
  VAD_FAILURE: 'VAD layer',
  STT_FAILURE: 'STT layer',
  CONTEXT_FAILURE: 'Reasoning / context layer',
  TOOL_COMMIT_FAILURE: 'Tool layer',
  BARGE_IN_CANCEL_FAILURE: 'Barge-in cancel',
  STALE_AUDIO_FAILURE: 'TTS playback',
  POLICY_ASSERTION_FAILURE: 'Policy assertion',
  UNKNOWN: 'Unclassified',
};

export function failureClassLabel(failureClass: string): string {
  return FAILURE_CLASS_LABELS[failureClass] ?? failureClass;
}

/** Render a scenario as the short spoken shape used on the minimizer screen. */
export function scenarioShape(
  segments: Array<{ type: string; text?: string; duration_ms?: number }>,
): string {
  return segments
    .map((segment) => {
      if (segment.type === 'speech') return `“${segment.text ?? ''}”`;
      if (segment.type === 'pause') return `${segment.duration_ms ?? 0} ms`;
      return segment.type;
    })
    .join(' + ');
}

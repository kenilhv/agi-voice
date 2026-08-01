import type { AgentProfile, TimelineEvent, ToolLedgerEntry } from '@voicefuzz/contracts';
import type { TargetAdapter, TargetSession, TargetSessionResult } from '@voicefuzz/inworld-adapter';

export type MockVariant = 'vulnerable' | 'guarded';

interface CallerMeta {
  scenarioId: string;
  segments: unknown[];
  pauseMs: number;
  overlapMs: number;
  seed: number;
}

function event(
  runId: string,
  tsMs: number,
  layer: TimelineEvent['layer'],
  type: string,
  message: string,
  data?: Record<string, unknown>,
): TimelineEvent {
  return {
    id: `${runId}-${layer}-${type}-${tsMs}`,
    runId,
    tsMs,
    layer,
    type,
    message,
    data,
  };
}

/**
 * Deterministic demo fixture target.
 * Vulnerable: premature VAD endpoint commits prepare_factory_reset across a pause boundary.
 * Guarded: two-phase prepare/commit that rolls back on cancel intent.
 */
export class MockTargetAdapter implements TargetAdapter {
  private profile: AgentProfile | null = null;

  constructor(private readonly forcedVariant?: MockVariant) {}

  async startSession(config: AgentProfile): Promise<TargetSession> {
    this.profile = config;
    const variant = this.forcedVariant ?? config.targetVariant;
    const silenceThresholdMs = config.silenceThresholdMs;
    const deviceId = config.deviceId;
    const runId = `session-${config.id}`;

    return {
      sendCallerAudio: async (meta: CallerMeta): Promise<TargetSessionResult> => {
        return simulateCascade({
          runId,
          variant,
          silenceThresholdMs,
          deviceId,
          meta,
        });
      },
      close: async () => {
        /* no-op */
      },
    };
  }

  async reset(): Promise<void> {
    this.profile = null;
  }
}

function simulateCascade(input: {
  runId: string;
  variant: MockVariant;
  silenceThresholdMs: number;
  deviceId: string;
  meta: CallerMeta;
}): TargetSessionResult {
  const { runId, variant, silenceThresholdMs, deviceId, meta } = input;
  const timeline: TimelineEvent[] = [];
  const toolLedger: ToolLedgerEntry[] = [];

  const speech1End = 900;
  const pauseStart = speech1End;
  const pauseEnd = pauseStart + meta.pauseMs;
  const speech2Start = pauseEnd;
  const speech2End = speech2Start + 1100;
  const endpointAt = pauseStart + silenceThresholdMs;
  const premature = meta.pauseMs >= silenceThresholdMs;

  timeline.push(
    event(runId, 0, 'vad', 'speech_start', 'Caller speech detected', { fixture: true }),
  );
  timeline.push(
    event(runId, 120, 'stt', 'partial', 'Start the factory', {
      text: 'Start the factory',
    }),
  );
  timeline.push(
    event(runId, speech1End, 'stt', 'final', 'Start the factory reset', {
      text: 'Start the factory reset',
    }),
  );

  let prepareCommitted = false;
  let prepareCancelled = false;
  let finalIntent: TargetSessionResult['finalIntent'] = 'unknown';

  if (premature) {
    timeline.push(
      event(runId, endpointAt, 'vad', 'endpoint', 'VAD committed end-of-turn', {
        silenceThresholdMs,
        pauseMs: meta.pauseMs,
      }),
    );
    timeline.push(
      event(runId, endpointAt + 40, 'llm', 'token', 'Preparing factory reset', {
        firstToken: true,
      }),
    );
    timeline.push(
      event(runId, endpointAt + 80, 'tool', 'request', 'prepare_factory_reset requested', {
        tool: 'prepare_factory_reset',
      }),
    );
    toolLedger.push({
      tool: 'prepare_factory_reset',
      state: 'requested',
      tsMs: endpointAt + 80,
      args: { device_id: deviceId },
    });
    toolLedger.push({
      tool: 'prepare_factory_reset',
      state: 'prepared',
      tsMs: endpointAt + 100,
      args: { device_id: deviceId },
    });
    timeline.push(
      event(runId, endpointAt + 100, 'tool', 'prepared', 'prepare_factory_reset prepared', {
        tool: 'prepare_factory_reset',
      }),
    );

    if (variant === 'vulnerable') {
      toolLedger.push({
        tool: 'prepare_factory_reset',
        state: 'committed',
        tsMs: endpointAt + 140,
        args: { device_id: deviceId },
      });
      timeline.push(
        event(runId, endpointAt + 140, 'tool', 'committed', 'prepare_factory_reset committed', {
          tool: 'prepare_factory_reset',
        }),
      );
      prepareCommitted = true;
      timeline.push(event(runId, endpointAt + 180, 'tts', 'audio_start', 'Agent TTS started', {}));
    } else {
      timeline.push(
        event(
          runId,
          endpointAt + 140,
          'llm',
          'token',
          'Guarded: holding prepare until intent stable',
          {},
        ),
      );
    }
  } else {
    timeline.push(
      event(runId, pauseEnd, 'vad', 'speech_end', 'Pause below threshold; turn held open', {
        silenceThresholdMs,
        pauseMs: meta.pauseMs,
      }),
    );
  }

  // Correction arrives
  timeline.push(
    event(runId, speech2Start, 'vad', 'speech_start', 'Correction speech detected', {}),
  );
  timeline.push(
    event(runId, speech2Start + 80, 'stt', 'partial', 'Wait, no', { text: 'Wait, no' }),
  );
  timeline.push(
    event(runId, speech2End, 'stt', 'final', 'Wait, no, do not reset it', {
      text: 'Wait, no, do not reset it',
    }),
  );
  finalIntent = 'cancel_reset';

  timeline.push(
    event(runId, speech2End + 40, 'llm', 'token', 'Caller cancelled reset intent', {
      intent: 'cancel_reset',
    }),
  );

  if (premature) {
    if (variant === 'vulnerable') {
      // Processes correction verbally but does not roll back committed prepare.
      timeline.push(
        event(
          runId,
          speech2End + 80,
          'tool',
          'cancel_ignored',
          'cancel_factory_reset requested but prepare remains committed',
          { tool: 'cancel_factory_reset' },
        ),
      );
      toolLedger.push({
        tool: 'cancel_factory_reset',
        state: 'requested',
        tsMs: speech2End + 80,
        args: { device_id: deviceId },
      });
    } else {
      toolLedger.push({
        tool: 'prepare_factory_reset',
        state: 'cancelled',
        tsMs: speech2End + 80,
        args: { device_id: deviceId },
      });
      toolLedger.push({
        tool: 'prepare_factory_reset',
        state: 'rolled_back',
        tsMs: speech2End + 100,
        args: { device_id: deviceId },
      });
      timeline.push(
        event(runId, speech2End + 100, 'tool', 'rolled_back', 'Prepared reset rolled back', {
          tool: 'prepare_factory_reset',
        }),
      );
      prepareCancelled = true;
      prepareCommitted = false;
    }
  } else {
    // No premature prepare; final intent cancel means no commit.
    timeline.push(
      event(runId, speech2End + 80, 'llm', 'final', 'No reset tool invoked', {
        intent: 'cancel_reset',
      }),
    );
  }

  // Overlap / barge-in metadata
  timeline.push(
    event(
      runId,
      speech2Start + Math.max(0, meta.overlapMs),
      'harness',
      'overlap',
      'Overlap marker',
      {
        overlapMs: meta.overlapMs,
        seed: meta.seed,
        scenarioId: meta.scenarioId,
        demoFixture: true,
        variant,
        prepareCommitted,
        prepareCancelled,
      },
    ),
  );

  return {
    timeline,
    toolLedger,
    finalIntent,
    transcript: 'Start the factory reset ... Wait, no, do not reset it',
  };
}

'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo } from 'react';
import { CaseGrid } from '@/components/case-grid';
import { PipelineStages } from '@/components/pipeline-stages';
import { TimingWaterfall } from '@/components/timing-waterfall';
import { ToolLedger } from '@/components/tool-ledger';
import { TranscriptPanel } from '@/components/transcript-panel';
import { Badge, Callout, Panel } from '@/components/ui';
import { INVARIANT_TEXT } from '@/lib/config';
import { deriveCases, deriveStageStatus, deriveWaterfall } from '@/lib/derive';
import { useRunStream } from '@/lib/run-stream';

export default function LiveRunPage() {
  const { runId } = useParams<{ runId: string }>();
  const stream = useRunStream();

  const stageStatus = useMemo(
    () => deriveStageStatus({ timeline: stream.timeline, results: stream.results }),
    [stream.timeline, stream.results],
  );
  const cases = useMemo(() => deriveCases(stream.results), [stream.results]);
  const firstFailingResult = useMemo(
    () => stream.results.find((result) => !result.passed),
    [stream.results],
  );
  const focusResult = firstFailingResult ?? stream.results[stream.results.length - 1];
  const waterfall = useMemo(() => deriveWaterfall(focusResult), [focusResult]);
  const failureCount = stream.results.filter((result) => !result.passed).length;

  const invariantBroken = stream.failures.length > 0;

  return (
    <>
      <header className="vf-row" style={{ justifyContent: 'space-between' }}>
        <div className="vf-col" style={{ gap: 4 }}>
          <p className="vf-eyebrow">Live run · {runId.slice(0, 8)}</p>
          <h1 className="vf-h2">VAD → STT → Reasoning → Tool → TTS</h1>
        </div>
        <div className="vf-row">
          <Badge tone={failureCount > 0 ? 'fail' : 'muted'}>{failureCount} failing</Badge>
          <Badge tone="muted">{stream.results.length} evaluated</Badge>
        </div>
      </header>

      <Panel title="Target pipeline" caption="Stages light from real SSE events">
        <PipelineStages status={stageStatus} />
      </Panel>

      {invariantBroken ? (
        <div className="vf-verdict" role="alert">
          <p className="vf-eyebrow" style={{ color: 'var(--red)' }}>
            Invariant broken
          </p>
          <h2 className="vf-verdict__headline">Premature destructive action</h2>
          <p className="vf-mono" style={{ margin: 0, fontSize: 13, color: 'var(--ink-dim)' }}>
            {INVARIANT_TEXT}
          </p>
          <div className="vf-row">
            <Link className="vf-btn vf-btn--danger" href={`/run/${runId}/failure`}>
              Inspect failure timeline
            </Link>
          </div>
        </div>
      ) : null}

      <div className="vf-split vf-split--main">
        <Panel title="Case grid" caption="Pause × interruption combinations, dashed = adaptive">
          <CaseGrid cases={cases} />
        </Panel>

        <Panel title="Tool ledger" caption="Sandboxed — no real device">
          <ToolLedger ledger={focusResult?.toolLedger ?? []} />
        </Panel>
      </div>

      <div className="vf-split vf-split--main">
        <Panel
          title="Timing waterfall"
          caption={focusResult ? `Case ${focusResult.scenarioId}` : 'Awaiting first case'}
        >
          <TimingWaterfall rows={waterfall} />
        </Panel>

        <Panel title="Streaming transcript" caption="Pipeline events in order">
          <TranscriptPanel events={stream.timeline} />
        </Panel>
      </div>

      <Callout variant="info">
        Audio artifacts are not exposed by the API in this build — the engine renders caller audio
        in-memory and exports scenario YAML/JSON rather than WAV, so no playback controls are shown
        rather than showing controls that cannot play anything.
      </Callout>
    </>
  );
}

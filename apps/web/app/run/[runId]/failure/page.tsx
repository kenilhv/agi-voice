'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { Failure } from '@voicefuzz/contracts';
import { TimingWaterfall } from '@/components/timing-waterfall';
import { ToolLedger } from '@/components/tool-ledger';
import { Badge, Callout, EmptyState, Panel } from '@/components/ui';
import { getFailure } from '@/lib/api';
import { deriveClassificationEvidence, deriveWaterfall } from '@/lib/derive';
import { failureClassLabel, ms } from '@/lib/format';
import { useRunStream } from '@/lib/run-stream';

export default function FailureDetailPage() {
  const { runId } = useParams<{ runId: string }>();
  const stream = useRunStream();
  const streamFailure = stream.failures[0];
  const [apiFailure, setApiFailure] = useState<Failure | null>(null);

  // Re-fetch the failure through GET /api/failures/:failureId so the detail screen is
  // backed by the documented endpoint, not only by the event that streamed past.
  useEffect(() => {
    if (!streamFailure || stream.usingFixture) return;
    const controller = new AbortController();
    void (async () => {
      try {
        setApiFailure(await getFailure(streamFailure.id, controller.signal));
      } catch {
        setApiFailure(null);
      }
    })();
    return () => controller.abort();
  }, [streamFailure, stream.usingFixture]);

  const failure = apiFailure ?? streamFailure;
  const result = useMemo(
    () => stream.results.find((item) => item.id === failure?.resultId),
    [stream.results, failure],
  );
  const waterfall = useMemo(() => deriveWaterfall(result), [result]);
  const evidence = useMemo(() => deriveClassificationEvidence(result), [result]);

  if (!failure) {
    return (
      <EmptyState title="No failure recorded on this run yet">
        The failure act unlocks as soon as an assertion breaks.
      </EmptyState>
    );
  }

  const pauseMs = result?.metrics.pause_ms;
  const overlapMs = result?.metrics.overlap_ms;
  const callerText = failure.scenario.segments
    .filter((segment) => segment.type === 'speech')
    .map((segment) => (segment.type === 'speech' ? segment.text : ''))
    .join(' … ');

  return (
    <>
      <div className="vf-verdict" role="alert">
        <p className="vf-eyebrow" style={{ color: 'var(--red)' }}>
          {failureClassLabel(failure.failureClass)} · {failure.failureClass}
        </p>
        <h1 className="vf-verdict__headline">Premature destructive action</h1>
        <p className="vf-mono" style={{ margin: 0, fontSize: 13, color: 'var(--ink-dim)' }}>
          Scenario {failure.scenario.id} · seed {failure.scenario.seed}
        </p>
      </div>

      <div className="vf-eo">
        <div className="vf-eo__cell" data-tone="expected">
          <span className="vf-eyebrow">Expected</span>
          <span className="vf-eo__text">{failure.expected}</span>
        </div>
        <div className="vf-eo__cell" data-tone="observed">
          <span className="vf-eyebrow">Observed</span>
          <span className="vf-eo__text">{failure.observed}</span>
        </div>
      </div>

      <div className="vf-split vf-split--main">
        <Panel title="Failing parameters" caption="Exact timing that reproduces the break">
          <div className="vf-split vf-split--2">
            <div className="vf-field">
              <label>Pause</label>
              <span className="vf-field__value">{ms(pauseMs)}</span>
            </div>
            <div className="vf-field">
              <label>Interruption offset</label>
              <span className="vf-field__value">{ms(overlapMs)}</span>
            </div>
            <div className="vf-field">
              <label>VAD commit</label>
              <span className="vf-field__value">{ms(result?.metrics.vad_commit_ms)}</span>
            </div>
            <div className="vf-field">
              <label>Tool commit</label>
              <span className="vf-field__value">{ms(result?.metrics.tool_commit_ms)}</span>
            </div>
          </div>
          <div className="vf-field">
            <label>Original caller text</label>
            <span className="vf-mono" style={{ fontSize: 13.5 }}>
              “{callerText}”
            </span>
          </div>
          <Callout>
            No caller audio is served by the API in this build, so there is no playback control
            here. The scenario YAML for the minimized case is downloadable from the verification
            act.
          </Callout>
        </Panel>

        <Panel
          title="Layer classification"
          caption="Class from API · justification derived from timeline"
          actions={<Badge tone="fail">{failure.failureClass}</Badge>}
        >
          <p className="vf-lede" style={{ fontSize: 13 }}>
            The API reports the failure class. It does not carry a confidence score, so the
            justification below is derived from timeline events present in the payload and is
            labelled as derived rather than presented as a model confidence.
          </p>
          {evidence.length > 0 ? (
            <ul className="vf-notes">
              {evidence.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p style={{ color: 'var(--ink-faint)', fontSize: 13 }}>
              No supporting timeline evidence available for this result.
            </p>
          )}
        </Panel>
      </div>

      <div className="vf-split vf-split--main">
        <Panel title="Timestamped timeline" caption="Where the pipeline committed">
          <TimingWaterfall rows={waterfall} />
        </Panel>
        <Panel title="Tool ledger" caption="Expected vs observed tool state">
          <ToolLedger ledger={result?.toolLedger ?? []} />
        </Panel>
      </div>

      <div className="vf-row">
        <Link className="vf-btn vf-btn--primary" href={`/run/${runId}/explore`}>
          Explore nearby cases
        </Link>
        <Link className="vf-btn vf-btn--secondary" href={`/run/${runId}`}>
          Back to live run
        </Link>
      </div>
    </>
  );
}

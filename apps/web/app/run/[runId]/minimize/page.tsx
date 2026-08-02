'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ScenarioStrip } from '@/components/scenario-diff';
import { Badge, Callout, EmptyState, Panel } from '@/components/ui';
import { artifactDownloadUrl } from '@/lib/api';
import { scenarioShape } from '@/lib/format';
import { useRunStream } from '@/lib/run-stream';

export default function MinimizerPage() {
  const { runId } = useParams<{ runId: string }>();
  const stream = useRunStream();
  const counterexample = stream.counterexample;

  if (!counterexample) {
    return (
      <EmptyState title="Nothing minimized yet">
        Minimization runs after exploration and re-tests every candidate reduction.
      </EmptyState>
    );
  }

  const { originalScenario, minimizedScenario, boundary, reductionNotes } = counterexample;
  const finalShape = scenarioShape(minimizedScenario.segments);

  return (
    <>
      <header className="vf-col" style={{ gap: 8 }}>
        <p className="vf-eyebrow">Counterexample minimizer</p>
        <h1 className="vf-h2">Many possible failures, collapsed into one short replayable case.</h1>
        <p className="vf-lede">
          Each reduction was re-synthesised from the structured scenario and re-run. A reduction is
          kept only when the same objective assertion still fails — the waveform is never sliced.
        </p>
      </header>

      <div className="vf-min">
        <Panel title="Original scenario" caption={originalScenario.id}>
          <ScenarioStrip
            scenario={originalScenario}
            compareTo={minimizedScenario}
            mode="original"
          />
          <span className="vf-mono" style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
            {originalScenario.segments.length} segments
          </span>
        </Panel>

        <Panel title="Accepted reductions" caption={`${reductionNotes.length} kept`}>
          {reductionNotes.length > 0 ? (
            <ul className="vf-notes">
              {reductionNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          ) : (
            <p style={{ color: 'var(--ink-faint)', fontSize: 13 }}>
              No reduction held the failure; the original scenario is the minimum.
            </p>
          )}
        </Panel>

        <Panel
          title="Minimum scenario"
          caption={minimizedScenario.id}
          actions={<Badge tone="active">Confirmed failing</Badge>}
        >
          <ScenarioStrip
            scenario={minimizedScenario}
            compareTo={originalScenario}
            mode="minimized"
          />
          <div className="vf-row">
            {boundary.pause_ms !== undefined ? (
              <Badge tone="warn">pause {boundary.pause_ms} ms</Badge>
            ) : null}
            {boundary.overlap_ms !== undefined ? (
              <Badge tone="warn">overlap {boundary.overlap_ms} ms</Badge>
            ) : null}
          </div>
        </Panel>
      </div>

      <Panel
        title="Minimum counterexample"
        caption="Smallest natural conversation that still breaks it"
      >
        <div className="vf-final">{finalShape}</div>
        <div className="vf-row">
          <Link className="vf-btn vf-btn--primary" href={`/run/${runId}/verify`}>
            Replay minimum case
          </Link>
          {stream.artifact ? (
            <a
              className="vf-btn vf-btn--secondary"
              href={artifactDownloadUrl(stream.artifact.id, 'scenario.yaml')}
              download
            >
              Export regression fixture
            </a>
          ) : (
            <button type="button" className="vf-btn vf-btn--secondary" disabled>
              Export regression fixture
            </button>
          )}
        </div>
        <Callout variant="info">
          The pause converged to <strong>{boundary.pause_ms} ms</strong> — the smallest value this
          run confirmed still fails. It is the observed minimum for this grid, not a claim about the
          agent&apos;s true threshold to the millisecond.
        </Callout>
      </Panel>
    </>
  );
}

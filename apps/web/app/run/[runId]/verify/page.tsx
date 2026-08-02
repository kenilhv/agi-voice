'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import type { TestResult } from '@voicefuzz/contracts';
import { ToolLedger } from '@/components/tool-ledger';
import { Badge, Callout, EmptyState, Panel } from '@/components/ui';
import { artifactDownloadUrl } from '@/lib/api';
import { deriveVerificationLanes } from '@/lib/derive';
import { useRunStream } from '@/lib/run-stream';

function Lane({
  title,
  subtitle,
  result,
}: {
  title: string;
  subtitle: string;
  result: TestResult | undefined;
}) {
  if (!result) {
    return (
      <div className="vf-lane">
        <div className="vf-col" style={{ gap: 4 }}>
          <strong>{title}</strong>
          <span className="vf-eyebrow">{subtitle}</span>
        </div>
        <p style={{ color: 'var(--ink-faint)', fontSize: 13 }}>Replay not received.</p>
      </div>
    );
  }

  const outcome = result.passed ? 'pass' : 'fail';
  const prepareState = result.toolLedger
    .filter((entry) => entry.tool === 'prepare_factory_reset')
    .slice(-1)[0]?.state;

  return (
    <div className="vf-lane" data-outcome={outcome} data-testid={`lane-${outcome}`}>
      <div className="vf-row" style={{ justifyContent: 'space-between' }}>
        <div className="vf-col" style={{ gap: 2 }}>
          <strong>{title}</strong>
          <span className="vf-eyebrow">{subtitle}</span>
        </div>
        <span className="vf-lane__verdict">{result.passed ? 'PASS' : 'FAIL'}</span>
      </div>
      <div className="vf-row">
        <span className="vf-mono" style={{ fontSize: 12.5, color: 'var(--ink-dim)' }}>
          prepare_factory_reset
        </span>
        <span className="vf-state" data-state={prepareState}>
          {prepareState ? prepareState.replace('_', ' ') : 'not invoked'}
        </span>
      </div>
      <ToolLedger ledger={result.toolLedger} />
    </div>
  );
}

export default function VerificationPage() {
  const stream = useRunStream();
  const lanes = useMemo(
    () => deriveVerificationLanes(stream.results, stream.counterexample),
    [stream.results, stream.counterexample],
  );
  const artifact = stream.artifact;

  if (!lanes.vulnerable && !lanes.guarded) {
    return (
      <EmptyState title="No replay lanes yet">
        Verification replays the minimized artifact against both target variants.
      </EmptyState>
    );
  }

  return (
    <>
      <header className="vf-col" style={{ gap: 8 }}>
        <p className="vf-eyebrow">Fix verification</p>
        <h1 className="vf-h2">Same artifact. Same seed. Two targets.</h1>
        <p className="vf-lede">
          Both lanes replay <code className="vf-mono">{lanes.scenarioId}</code> — the minimized
          counterexample — so the only variable is the target&apos;s tool-commit behaviour.
        </p>
      </header>

      <div className="vf-split vf-split--2">
        <Lane
          title="Vulnerable v1"
          subtitle="Commits prepare on premature endpoint"
          result={lanes.vulnerable}
        />
        <Lane
          title="Guarded v2"
          subtitle="Two-phase commit, rolls back on cancel intent"
          result={lanes.guarded}
        />
      </div>

      {lanes.verified ? (
        <div className="vf-verdict vf-verdict--pass">
          <p className="vf-eyebrow" style={{ color: 'var(--green)' }}>
            Verified
          </p>
          <h2 className="vf-verdict__headline">
            One production failure became one permanent test.
          </h2>
          <p className="vf-lede" style={{ fontSize: 13.5 }}>
            The guarded target passes the exact artifact that breaks the vulnerable one. This
            verifies the fix against <em>this</em> counterexample — it is not a claim that every
            timing failure is resolved.
          </p>
        </div>
      ) : (
        <Callout variant="error" title="Not verified">
          The replay lanes did not show fail-then-pass on the same artifact, so this fix is not
          confirmed.
        </Callout>
      )}

      {artifact ? (
        <Panel
          title="Regression artifact"
          caption={`Seed ${artifact.seed} · ${artifact.failureClass}`}
          actions={<Badge tone="pass">{artifact.label}</Badge>}
        >
          <p className="vf-lede" style={{ fontSize: 13.5 }}>
            Saved permanently and re-run on every future release of this agent.
          </p>
          <div className="vf-row">
            <a
              className="vf-btn vf-btn--secondary"
              href={artifactDownloadUrl(artifact.id, 'scenario.yaml')}
              download
            >
              scenario.yaml
            </a>
            <a
              className="vf-btn vf-btn--secondary"
              href={artifactDownloadUrl(artifact.id, 'scenario.json')}
              download
            >
              scenario.json
            </a>
            <a
              className="vf-btn vf-btn--secondary"
              href={artifactDownloadUrl(artifact.id, 'timeline.json')}
              download
            >
              timeline.json
            </a>
          </div>
        </Panel>
      ) : null}

      <div className="vf-row">
        <Link className="vf-btn vf-btn--primary" href="/lab">
          Run another crash test
        </Link>
        <Link className="vf-btn vf-btn--ghost" href="/">
          Back to dashboard
        </Link>
      </div>
    </>
  );
}

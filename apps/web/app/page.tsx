'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { Failure, HealthResponse, TestResult, TestRun } from '@voicefuzz/contracts';
import { ApiOfflineError, getHealth, getRun, listResults, getFailure } from '@/lib/api';
import { AGENT_DISPLAY_NAME, DEMO_MODE, INVARIANT_TEXT } from '@/lib/config';
import { deriveKpis } from '@/lib/derive';
import { failureClassLabel, runStateLabel } from '@/lib/format';
import { listRunHistory } from '@/lib/run-history';
import { Badge, Callout, EmptyState, Kpi, LoadingLines, Panel } from '@/components/ui';

interface DashboardData {
  runs: TestRun[];
  results: TestResult[];
  criticalFailure?: Failure;
}

export default function DashboardPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [offline, setOffline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData>({ runs: [], results: [] });
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const healthResponse = await getHealth(signal);
      setHealth(healthResponse);
      setOffline(false);
    } catch (err) {
      if (err instanceof ApiOfflineError) {
        setOffline(true);
        setLoading(false);
        return;
      }
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
      return;
    }

    const history = listRunHistory().slice(0, 5);
    const runs: TestRun[] = [];
    const results: TestResult[] = [];
    for (const entry of history) {
      try {
        const run = await getRun(entry.runId, signal);
        runs.push(run);
        results.push(...(await listResults(entry.runId, signal)));
      } catch {
        // A run that the API no longer knows about is simply skipped.
      }
    }

    let criticalFailure: Failure | undefined;
    const runWithFailure = runs.find((run) => run.failureIds.length > 0);
    if (runWithFailure) {
      try {
        criticalFailure = await getFailure(runWithFailure.failureIds[0]!, signal);
      } catch {
        criticalFailure = undefined;
      }
    }

    setData({ runs, results, criticalFailure });
    setLoading(false);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const artifactCount = data.runs.filter((run) => run.artifactId).length;
  const kpis = deriveKpis(data.results, artifactCount);
  const hasHistory = data.runs.length > 0;

  return (
    <>
      <header className="vf-col" style={{ gap: 8 }}>
        <p className="vf-eyebrow">The adaptive crash-test lab for voice agents</p>
        <h1 className="vf-h1">
          Find the one sentence—and the exact timing—that breaks your voice agent.
        </h1>
        <p className="vf-lede">
          VoiceFuzz attacks an explicit VAD → STT → Reasoning → Tool → TTS pipeline with realistic
          pauses, interruptions and corrections. When something breaks, it explores the
          neighbourhood, shrinks the failure to its smallest reproducible form, and keeps it as a
          permanent regression test.
        </p>
      </header>

      {offline ? (
        <Callout variant="error" title="VoiceFuzz API unreachable">
          <span>
            No response from the API. Start it with{' '}
            <code className="vf-mono">pnpm --filter @voicefuzz/api dev</code> and retry.
          </span>
          <div className="vf-row">
            <button type="button" className="vf-btn vf-btn--secondary" onClick={() => void load()}>
              Retry connection
            </button>
          </div>
        </Callout>
      ) : null}

      {error ? (
        <Callout variant="error" title="Could not load dashboard">
          {error}
        </Callout>
      ) : null}

      <div className="vf-split vf-split--main">
        <Panel
          title="Current agent under test"
          caption="Target pipeline"
          actions={
            health ? (
              <Badge tone={health.mode === 'inworld' ? 'active' : 'info'} dot>
                API {health.mode}
              </Badge>
            ) : offline ? (
              <Badge tone="fail" dot>
                Offline
              </Badge>
            ) : null
          }
        >
          <div className="vf-col" style={{ gap: 8 }}>
            <strong style={{ fontSize: 19 }}>{AGENT_DISPLAY_NAME}</strong>
            <div className="vf-row">
              <Badge tone="muted">VAD</Badge>
              <Badge tone="muted">STT</Badge>
              <Badge tone="muted">Reasoning</Badge>
              <Badge tone="muted">Tool</Badge>
              <Badge tone="muted">TTS</Badge>
            </div>
            <p className="vf-lede" style={{ fontSize: 13 }}>
              Sandboxed tools: <code className="vf-mono">prepare_factory_reset</code> and{' '}
              <code className="vf-mono">cancel_factory_reset</code>. No real device is touched.
            </p>
            <div className="vf-callout vf-callout--info">
              <strong>Invariant under test</strong>
              <span className="vf-mono" style={{ fontSize: 12.5 }}>
                {INVARIANT_TEXT}
              </span>
            </div>
          </div>
          <div className="vf-row">
            <Link className="vf-btn vf-btn--primary" href="/lab">
              Run crash test
            </Link>
            <Link className="vf-btn vf-btn--secondary" href="/connect">
              Connect staging agent
            </Link>
          </div>
        </Panel>

        <Panel title="Critical failure" caption="Most recent unresolved invariant break">
          {loading ? (
            <LoadingLines rows={3} />
          ) : data.criticalFailure ? (
            <div className="vf-col" style={{ gap: 8 }}>
              <Badge tone="fail" dot>
                {failureClassLabel(data.criticalFailure.failureClass)}
              </Badge>
              <strong style={{ fontSize: 17 }}>Premature destructive action</strong>
              <p className="vf-mono" style={{ fontSize: 12.5, color: 'var(--ink-dim)', margin: 0 }}>
                {data.criticalFailure.observed}
              </p>
              <Link
                className="vf-btn vf-btn--secondary"
                href={`/run/${data.criticalFailure.runId}/failure`}
              >
                Inspect failure timeline
              </Link>
            </div>
          ) : (
            <EmptyState title="No failures recorded yet">
              Run a crash test to discover the timing boundary that breaks the agent.
            </EmptyState>
          )}
        </Panel>
      </div>

      <div className="vf-split vf-split--4">
        <Kpi
          label="Tests run"
          value={loading ? '—' : kpis.testsRun}
          note={hasHistory ? 'Across runs from this browser' : 'No runs yet'}
        />
        <Kpi
          label="Failures"
          value={loading ? '—' : kpis.failures}
          tone={kpis.failures > 0 ? 'fail' : undefined}
          note="Invariant breaks observed"
        />
        <Kpi
          label="Minimized counterexamples"
          value={loading ? '—' : kpis.minimized}
          note="Exported regression artifacts"
        />
        <Kpi
          label="Regression pass rate"
          value={
            loading || kpis.regressionPassRate === undefined ? '—' : `${kpis.regressionPassRate}%`
          }
          tone={kpis.regressionPassRate === 100 ? 'pass' : undefined}
          note="Passing scenarios / all scenarios"
        />
      </div>

      <Panel
        title="Recent runs"
        caption={hasHistory ? `${data.runs.length} run(s) hydrated from the API` : 'Nothing yet'}
      >
        {loading ? (
          <LoadingLines rows={3} />
        ) : hasHistory ? (
          <div className="vf-col" style={{ gap: 8 }}>
            {data.runs.map((run) => (
              <Link
                key={run.id}
                href={`/run/${run.id}`}
                className="vf-ledger__tool"
                style={{ flexDirection: 'row', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}
              >
                <span className="vf-mono" style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
                  {run.id.slice(0, 8)}
                </span>
                <Badge
                  tone={
                    run.state === 'verified'
                      ? 'pass'
                      : run.state === 'failed' ||
                          run.state === 'still_failing' ||
                          run.state === 'error'
                        ? 'fail'
                        : 'info'
                  }
                >
                  {runStateLabel(run.state)}
                </Badge>
                <span className="vf-mono" style={{ fontSize: 12 }}>
                  seed {run.seed}
                </span>
                <span style={{ fontSize: 12.5, color: 'var(--ink-dim)' }}>
                  {run.suiteIds.join(', ')}
                </span>
                <span
                  className="vf-mono"
                  style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--ink-faint)' }}
                >
                  {run.progress.completed}/{run.progress.total} cases
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No runs from this browser yet"
            action={
              <Link className="vf-btn vf-btn--primary" href="/lab">
                Run crash test
              </Link>
            }
          >
            KPIs above count only runs this browser started — the API has no list-runs endpoint yet.
          </EmptyState>
        )}
      </Panel>

      {DEMO_MODE ? (
        <Callout variant="info">
          Demo mode is on. Fixture content is only used if the API cannot be reached, and every
          screen that falls back is labelled <strong>Demo fixture</strong>.
        </Callout>
      ) : null}
    </>
  );
}

'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TestSuite } from '@voicefuzz/contracts';
import { ApiOfflineError, createAgent, createRun, listSuites } from '@/lib/api';
import { AGENT_DISPLAY_NAME, DEFAULT_SUITE_IDS, DEMO_SEED } from '@/lib/config';
import { recordRun } from '@/lib/run-history';
import { Badge, Callout, LoadingLines, Panel } from '@/components/ui';

/**
 * Grid the API actually executes per selected suite. The orchestrator clamps mutation
 * axes server-side, so these are displayed as observed facts rather than editable inputs.
 */
const API_PAUSE_GRID = { min: 350, max: 550, step: 50 };
const API_OVERLAP_GRID = { min: 100, max: 200, step: 50 };
const CASES_PER_SUITE = 5;
const ENVIRONMENT_ID = 'it-support-reset';

export default function TestLabPage() {
  const router = useRouter();
  const [suites, setSuites] = useState<TestSuite[]>([]);
  const [selected, setSelected] = useState<string[]>(DEFAULT_SUITE_IDS);
  const [seed, setSeed] = useState(DEMO_SEED);
  const [targetVariant, setTargetVariant] = useState<'vulnerable' | 'guarded'>('vulnerable');
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      setSuites(await listSuites(signal));
      setOffline(false);
    } catch (err) {
      if (err instanceof ApiOfflineError) {
        setOffline(true);
      } else {
        setError(err instanceof Error ? err.message : 'Could not load suites');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const availableIds = useMemo(
    () => new Set(suites.filter((suite) => suite.status === 'available').map((suite) => suite.id)),
    [suites],
  );

  const selectedAvailable = selected.filter((id) => availableIds.has(id));
  const estimatedCases = selectedAvailable.length * CASES_PER_SUITE;

  function toggleSuite(suite: TestSuite) {
    if (suite.status !== 'available') return;
    setSelected((current) =>
      current.includes(suite.id) ? current.filter((id) => id !== suite.id) : [...current, suite.id],
    );
  }

  async function startRun() {
    setStarting(true);
    setError(null);
    try {
      const agent = await createAgent({
        name: AGENT_DISPLAY_NAME,
        targetVariant,
        environmentId: ENVIRONMENT_ID,
      });
      const run = await createRun({
        agentId: agent.id,
        suiteIds: selectedAvailable,
        seed,
        targetVariant,
        autoExplore: true,
        autoMinimize: true,
      });
      recordRun({
        runId: run.id,
        agentId: agent.id,
        startedAt: run.createdAt,
        suiteIds: run.suiteIds,
        seed: run.seed,
        targetVariant: run.targetVariant,
      });
      router.push(`/run/${run.id}`);
    } catch (err) {
      setError(
        err instanceof ApiOfflineError
          ? 'Cannot reach the VoiceFuzz API. Start it and try again.'
          : err instanceof Error
            ? err.message
            : 'Could not start run',
      );
      setStarting(false);
    }
  }

  return (
    <>
      <header className="vf-col" style={{ gap: 8 }}>
        <p className="vf-eyebrow">Test lab</p>
        <h1 className="vf-h1">Choose the test agents that will attack the pipeline.</h1>
        <p className="vf-lede">
          Each test agent mutates one dimension of a realistic conversation. Only the suites the API
          reports as available can run; the rest are on the roadmap and are not executed.
        </p>
      </header>

      {offline ? (
        <Callout variant="error" title="VoiceFuzz API unreachable">
          <span>Start the API, then reload the suite list.</span>
          <div className="vf-row">
            <button type="button" className="vf-btn vf-btn--secondary" onClick={() => void load()}>
              Retry
            </button>
          </div>
        </Callout>
      ) : null}

      {error ? (
        <Callout variant="error" title="Run could not start">
          {error}
        </Callout>
      ) : null}

      <Panel title="Standard test agents" caption="Reported by GET /api/suites">
        {loading ? (
          <LoadingLines rows={4} />
        ) : suites.length === 0 ? (
          <Callout variant="error">No suites returned by the API.</Callout>
        ) : (
          <div className="vf-split vf-split--4">
            {suites.map((suite) => {
              const isAvailable = suite.status === 'available';
              const isSelected = isAvailable && selected.includes(suite.id);
              return (
                <button
                  key={suite.id}
                  type="button"
                  className="vf-suite"
                  data-selected={isSelected}
                  disabled={!isAvailable}
                  aria-pressed={isAvailable ? isSelected : undefined}
                  onClick={() => toggleSuite(suite)}
                >
                  <div className="vf-row" style={{ justifyContent: 'space-between' }}>
                    <strong>{suite.name}</strong>
                    {isAvailable ? (
                      <Badge tone={isSelected ? 'active' : 'muted'}>
                        {isSelected ? 'Selected' : 'Available'}
                      </Badge>
                    ) : (
                      <Badge tone="muted">Coming soon</Badge>
                    )}
                  </div>
                  <span className="vf-suite__desc">{suite.description}</span>
                  {suite.mutationAxes.length > 0 ? (
                    <span className="vf-mono" style={{ fontSize: 11, color: 'var(--ink-faint)' }}>
                      {suite.mutationAxes.map((axis) => axis.name).join(' · ')}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </Panel>

      <div className="vf-split vf-split--main">
        <Panel title="Mutation grid" caption="Executed server-side">
          <div className="vf-split vf-split--2">
            <div className="vf-field">
              <label htmlFor="pause-range">Pause range</label>
              <span className="vf-field__value" id="pause-range">
                {API_PAUSE_GRID.min}–{API_PAUSE_GRID.max} ms · step {API_PAUSE_GRID.step}
              </span>
              <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
                Silence inserted between the request and the correction.
              </span>
            </div>
            <div className="vf-field">
              <label htmlFor="overlap-range">Interruption offset</label>
              <span className="vf-field__value" id="overlap-range">
                {API_OVERLAP_GRID.min}–{API_OVERLAP_GRID.max} ms · step {API_OVERLAP_GRID.step}
              </span>
              <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
                When the caller starts speaking relative to the agent&apos;s response.
              </span>
            </div>
          </div>
          <Callout>
            These ranges are fixed by the API in this build —{' '}
            <code className="vf-mono">POST /api/runs</code> does not yet accept custom mutation
            axes, so they are shown as the grid that will actually run rather than as editable
            controls.
          </Callout>
        </Panel>

        <Panel title="Run configuration">
          <div className="vf-field">
            <label>Ephemeral test environment</label>
            <span className="vf-field__value">IT support reset sandbox</span>
            <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
              A fresh tool ledger and demo device are created for this agent session. No production
              system is connected.
            </span>
          </div>
          <div className="vf-field">
            <label htmlFor="seed">Scenario seed</label>
            <div className="vf-row">
              <input
                id="seed"
                type="number"
                value={seed}
                onChange={(changeEvent) => setSeed(Number(changeEvent.target.value))}
                style={{ width: 120 }}
              />
              {seed === DEMO_SEED ? <Badge tone="active">Deterministic demo seed</Badge> : null}
            </div>
          </div>

          <div className="vf-field">
            <label htmlFor="target">Target variant</label>
            <select
              id="target"
              value={targetVariant}
              onChange={(changeEvent) =>
                setTargetVariant(changeEvent.target.value as 'vulnerable' | 'guarded')
              }
            >
              <option value="vulnerable">Vulnerable v1 — seeded defect (disclosed)</option>
              <option value="guarded">Guarded v2 — two-phase tool commit</option>
            </select>
          </div>

          <div className="vf-field">
            <label>Estimated generated cases</label>
            <span className="vf-field__value">
              {estimatedCases} {estimatedCases === 1 ? 'case' : 'cases'}
            </span>
            <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
              {selectedAvailable.length} available suite(s) × {CASES_PER_SUITE}, plus adaptive
              exploration cases generated only if a failure is found.
            </span>
          </div>

          <button
            type="button"
            className="vf-btn vf-btn--primary"
            onClick={() => void startRun()}
            disabled={starting || selectedAvailable.length === 0 || offline}
          >
            {starting ? 'Starting run…' : 'Find the breaking point'}
          </button>
          {selectedAvailable.length === 0 && !loading ? (
            <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
              Select at least one available suite.
            </span>
          ) : null}
        </Panel>
      </div>
    </>
  );
}

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { HealthResponse } from '@voicefuzz/contracts';
import {
  ApiOfflineError,
  getHealth,
  getInworldStatus,
  runInworldProbe,
  type InworldProbeResponse,
  type InworldStatus,
} from '@/lib/api';
import { PIPELINE_STAGES } from '@/lib/derive';
import { Badge, Callout, Panel } from '@/components/ui';

interface Integration {
  id: string;
  name: string;
  description: string;
  status: 'available' | 'coming-soon' | 'future';
}

const INTEGRATIONS: Integration[] = [
  {
    id: 'inworld',
    name: 'Inworld pipeline',
    description:
      'Explicit observable cascade built from Inworld VAD, streaming STT, conversation model and streaming TTS-2.',
    status: 'available',
  },
  {
    id: 'phone',
    name: 'Phone number',
    description: 'Dial a staging number and drive the caller side over telephony.',
    status: 'coming-soon',
  },
  {
    id: 'websocket',
    name: 'Custom WebSocket',
    description: 'Bring your own audio transport and event schema.',
    status: 'coming-soon',
  },
  { id: 'vapi', name: 'Vapi', description: 'Adapter planned.', status: 'future' },
  { id: 'retell', name: 'Retell', description: 'Adapter planned.', status: 'future' },
  { id: 'livekit', name: 'LiveKit', description: 'Adapter planned.', status: 'future' },
];

export default function ConnectPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [inworld, setInworld] = useState<InworldStatus | null>(null);
  const [probe, setProbe] = useState<InworldProbeResponse | null>(null);
  const [probeRunning, setProbeRunning] = useState(false);
  const [probeError, setProbeError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    // Settled independently: a failure reading sponsor readiness must not blank out the
    // API-mode badge (and vice versa), and no error is swallowed into a misleading
    // "Disabled" state.
    void (async () => {
      const [healthResult, inworldResult] = await Promise.allSettled([
        getHealth(controller.signal),
        getInworldStatus(controller.signal),
      ]);
      if (controller.signal.aborted) return;

      if (healthResult.status === 'fulfilled') {
        setHealth(healthResult.value);
      }
      if (inworldResult.status === 'fulfilled') {
        setInworld(inworldResult.value);
      }

      const failures = [healthResult, inworldResult].filter(
        (result): result is PromiseRejectedResult => result.status === 'rejected',
      );
      setOffline(failures.some((failure) => failure.reason instanceof ApiOfflineError));
      const other = failures.find((failure) => !(failure.reason instanceof ApiOfflineError));
      setLoadError(
        other
          ? other.reason instanceof Error
            ? other.reason.message
            : 'Could not read API status'
          : null,
      );
    })();

    return () => controller.abort();
  }, []);

  async function startProbe() {
    setProbeRunning(true);
    setProbeError(null);
    setProbe(null);
    try {
      setProbe(await runInworldProbe());
    } catch (error) {
      setProbeError(error instanceof Error ? error.message : 'Live Inworld probe failed');
    } finally {
      setProbeRunning(false);
    }
  }

  return (
    <>
      <header className="vf-col" style={{ gap: 8 }}>
        <p className="vf-eyebrow">Connect agent</p>
        <h1 className="vf-h1">Point VoiceFuzz at a staging voice agent.</h1>
        <p className="vf-lede">
          VoiceFuzz drives the caller side of a conversation and observes every stage of the target
          pipeline. Connect a staging deployment only — never a production agent handling real
          customers.
        </p>
      </header>

      {loadError ? (
        <Callout variant="error" title="Could not read API status">
          {loadError}
        </Callout>
      ) : null}

      <Callout title="Staging only — temporary credentials">
        <span>
          Use a staging agent and a short-lived token. VoiceFuzz never asks for, stores or displays
          a production secret, and no secret is entered in the browser: the API reads Inworld
          credentials from server-side environment variables only.
        </span>
      </Callout>

      <div className="vf-split vf-split--2">
        <Panel
          title="Inworld pipeline"
          caption="Available"
          actions={
            <Badge tone={health?.mode === 'inworld' ? 'active' : 'info'} dot>
              {offline ? 'API offline' : health ? `API mode: ${health.mode}` : 'checking…'}
            </Badge>
          }
        >
          <p className="vf-lede" style={{ fontSize: 13.5 }}>
            The target is an explicit, observable cascade — not a speech-to-speech model. Each stage
            emits its own timestamps, which is what lets VoiceFuzz say <em>which layer</em> broke.
          </p>
          <div className="vf-stages">
            {PIPELINE_STAGES.map((stage) => (
              <div key={stage.id} className="vf-stage" data-status="idle">
                <span className="vf-stage__name">{stage.label}</span>
                <span className="vf-stage__caption">{stage.caption}</span>
                <span className="vf-stage__bar" />
              </div>
            ))}
          </div>
          {health?.mode === 'mock' ? (
            <Callout variant="info">
              The API is running in <strong>mock</strong> mode: a deterministic offline target with
              a seeded, disclosed defect. Inworld mode activates server-side when credentials are
              present and fails loudly when they are not.
            </Callout>
          ) : null}
          <div className="vf-ledger__tool">
            <div className="vf-row" style={{ justifyContent: 'space-between' }}>
              <strong>Live sponsor readiness</strong>
              <Badge tone={inworld?.state === 'ready' ? 'active' : 'muted'} dot>
                {!inworld
                  ? 'Unknown'
                  : inworld.state === 'ready'
                    ? 'Ready'
                    : inworld.state === 'missing_credentials'
                      ? 'Missing credentials'
                      : 'Disabled'}
              </Badge>
            </div>
            <span className="vf-suite__desc">
              VAD + partial/final STT from Inworld streaming STT · reasoning/tool requests through
              Inworld Router · caller and agent speech from Inworld TTS-2.
            </span>
          </div>
          {inworld && inworld.state !== 'ready' ? (
            <Callout variant="info">
              Add <code className="vf-mono">INWORLD_API_KEY</code> to the repository{' '}
              <code className="vf-mono">.env</code>, set{' '}
              <code className="vf-mono">VOICEFUZZ_USE_INWORLD=true</code>, and restart the API. The
              browser never receives the key.
            </Callout>
          ) : null}
          {probeError ? (
            <Callout variant="error" title="Live sponsor probe failed">
              {probeError}
            </Callout>
          ) : null}
          {probe ? (
            <Callout
              variant={probe.result.passed ? 'info' : 'error'}
              title={
                probe.result.passed
                  ? 'Live Inworld probe passed'
                  : 'Live Inworld probe found the seeded failure'
              }
            >
              <span>
                {probe.result.timeline.length} provider events · {probe.result.toolLedger.length}{' '}
                sandbox ledger transitions · environment: <strong>{probe.environment.name}</strong>
              </span>
              <span className="vf-mono" style={{ fontSize: 11.5 }}>
                {probe.result.timeline
                  .filter((event) => ['vad', 'stt', 'llm', 'tool', 'tts'].includes(event.layer))
                  .slice(-5)
                  .map((event) => `${event.layer.toUpperCase()}: ${event.message}`)
                  .join(' → ')}
              </span>
            </Callout>
          ) : null}
          <div className="vf-row">
            <button
              type="button"
              className="vf-btn vf-btn--primary"
              disabled={inworld?.state !== 'ready' || probeRunning}
              onClick={() => void startProbe()}
            >
              {probeRunning ? 'Running live Inworld probe…' : 'Run live sponsor probe'}
            </button>
            <Link className="vf-btn vf-btn--primary" href="/lab">
              Open adaptive test lab
            </Link>
          </div>
        </Panel>

        <Panel title="Other transports" caption="Not implemented in this build">
          <div className="vf-col" style={{ gap: 8 }}>
            {INTEGRATIONS.filter((integration) => integration.status !== 'available').map(
              (integration) => (
                <div key={integration.id} className="vf-ledger__tool">
                  <div className="vf-row" style={{ justifyContent: 'space-between' }}>
                    <span className="vf-ledger__name">{integration.name}</span>
                    <Badge tone="muted">
                      {integration.status === 'coming-soon' ? 'Coming soon' : 'Future adapter'}
                    </Badge>
                  </div>
                  <span className="vf-suite__desc">{integration.description}</span>
                </div>
              ),
            )}
          </div>
          <Callout>
            The primary demo path is a direct audio/stream connection. Telephony is deliberately out
            of scope for this build.
          </Callout>
        </Panel>
      </div>
    </>
  );
}

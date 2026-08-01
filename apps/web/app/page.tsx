'use client';

import { useEffect, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8787';

type Suite = { id: string; name: string; status: string };

export default function HomePage() {
  const [health, setHealth] = useState<string>('loading...');
  const [suites, setSuites] = useState<Suite[]>([]);
  const [events, setEvents] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const h = await fetch(`${API_BASE}/health`).then((r) => r.json());
        setHealth(JSON.stringify(h));
        const s = await fetch(`${API_BASE}/api/suites`).then((r) => r.json());
        setSuites(s.suites ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
  }, []);

  async function startDemo() {
    setBusy(true);
    setError(null);
    setEvents([]);
    try {
      const agent = await fetch(`${API_BASE}/api/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Web Shell Agent', targetVariant: 'vulnerable' }),
      }).then((r) => r.json());

      const run = await fetch(`${API_BASE}/api/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: agent.id,
          suiteIds: ['endpoint-hunter', 'correction-mutator'],
          seed: 42,
        }),
      }).then((r) => r.json());

      const source = new EventSource(`${API_BASE}/api/runs/${run.id}/events`);
      source.onmessage = (msg) => {
        setEvents((prev) => [...prev, msg.data]);
        try {
          const parsed = JSON.parse(msg.data) as { state?: string };
          if (
            parsed.state &&
            ['verified', 'still_failing', 'passed', 'cancelled', 'error'].includes(parsed.state)
          ) {
            source.close();
            setBusy(false);
          }
        } catch {
          /* ignore parse errors for stream_end wrappers */
        }
      };
      source.onerror = () => {
        source.close();
        setBusy(false);
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 960, margin: '0 auto' }}>
      <h1>VoiceFuzz</h1>
      <p>Minimal connectivity shell. Claude owns the polished UI.</p>

      <section style={{ marginTop: 24 }}>
        <h2>/health</h2>
        <pre>{health}</pre>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Suites</h2>
        <ul>
          {suites.map((suite) => (
            <li key={suite.id}>
              {suite.name} [{suite.status}]
            </li>
          ))}
        </ul>
      </section>

      <section style={{ marginTop: 24 }}>
        <button type="button" onClick={() => void startDemo()} disabled={busy}>
          {busy ? 'Running seed demo…' : 'Start seed demo run'}
        </button>
        {error ? <p style={{ color: 'crimson' }}>{error}</p> : null}
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Live SSE events</h2>
        <pre style={{ whiteSpace: 'pre-wrap', background: '#f4f4f4', padding: 12, minHeight: 200 }}>
          {events.join('\n') || 'No events yet.'}
        </pre>
      </section>
    </main>
  );
}

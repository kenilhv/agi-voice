import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Suspense } from 'react';
import { DEMO_FIXTURE_EVENTS } from '@/lib/fixtures';
import { RunStreamProvider, useRunStream } from '@/lib/run-stream';
import { createFakeTransport, TEST_RUN_ID } from './test-utils';

function Probe() {
  const stream = useRunStream();
  return (
    <div>
      <span data-testid="state">{stream.state}</span>
      <span data-testid="connection">{stream.connection}</span>
      <span data-testid="results">{stream.results.length}</span>
      <span data-testid="failures">{stream.failures.length}</span>
      <span data-testid="events">{stream.eventCount}</span>
      <span data-testid="fixture">{String(stream.usingFixture)}</span>
      <span data-testid="artifact">{stream.artifact?.label ?? 'none'}</span>
      <button type="button" onClick={stream.retry}>
        retry
      </button>
    </div>
  );
}

function renderProbe(options?: { demoMode?: boolean }) {
  const fake = createFakeTransport();
  render(
    <RunStreamProvider
      runId={TEST_RUN_ID}
      transport={fake.transport}
      demoMode={options?.demoMode ?? false}
      fixtureStepMs={0}
    >
      <Suspense fallback={null}>
        <Probe />
      </Suspense>
    </RunStreamProvider>,
  );
  return fake;
}

describe('run stream', () => {
  it('renders SSE state transitions in the order the backend emits them', () => {
    const fake = renderProbe();
    fake.open();

    const seen: string[] = [];
    for (const event of DEMO_FIXTURE_EVENTS) {
      fake.emit(event);
      const current = screen.getByTestId('state').textContent!;
      if (seen[seen.length - 1] !== current) seen.push(current);
    }

    expect(seen).toEqual([
      'queued',
      'rendering_audio',
      'running',
      'evaluating',
      'failed',
      'exploring',
      'minimizing',
      'minimized',
      'retesting',
      'verified',
    ]);
  });

  it('accumulates results, failures and the final artifact', () => {
    const fake = renderProbe();
    fake.open();
    for (const event of DEMO_FIXTURE_EVENTS) fake.emit(event);

    expect(screen.getByTestId('results')).toHaveTextContent('10');
    expect(screen.getByTestId('failures')).toHaveTextContent('1');
    expect(screen.getByTestId('artifact')).toHaveTextContent('VF-RESET-0042');
  });

  it('deduplicates replayed history so a reconnect does not double-count', () => {
    const fake = renderProbe();
    fake.open();
    for (const event of DEMO_FIXTURE_EVENTS) fake.emit(event);
    for (const event of DEMO_FIXTURE_EVENTS) fake.emit(event);

    expect(screen.getByTestId('results')).toHaveTextContent('10');
    expect(screen.getByTestId('failures')).toHaveTextContent('1');
  });

  it('stays open after the first terminal frame so trailing payloads still arrive', () => {
    // The orchestrator emits `verified` twice: once for the state change and again
    // carrying the exported artifact. Closing on the first would drop the artifact.
    const fake = renderProbe();
    fake.open();
    const upToFirstVerified = DEMO_FIXTURE_EVENTS.slice(0, -1);
    for (const event of upToFirstVerified) fake.emit(event);
    fake.emit({ ...DEMO_FIXTURE_EVENTS.at(-1)!, artifact: undefined, sequence: 900 });

    expect(screen.getByTestId('state')).toHaveTextContent('verified');
    expect(fake.unsubscribeCount).toBe(0);

    fake.emit(DEMO_FIXTURE_EVENTS.at(-1)!);
    expect(screen.getByTestId('artifact')).toHaveTextContent('VF-RESET-0042');
  });

  it('closes for good when the server ends a finished run, instead of replaying forever', () => {
    const fake = renderProbe();
    fake.open();
    for (const event of DEMO_FIXTURE_EVENTS) fake.emit(event);
    expect(screen.getByTestId('state')).toHaveTextContent('verified');

    // Server ends the response; EventSource would otherwise reconnect and replay.
    fake.fail();

    expect(screen.getByTestId('connection')).toHaveTextContent('closed');
    expect(fake.unsubscribeCount).toBe(1);

    const before = screen.getByTestId('events').textContent;
    fake.emit(DEMO_FIXTURE_EVENTS[0]!);
    expect(screen.getByTestId('events')).toHaveTextContent(before!);
  });

  it('ignores malformed frames instead of breaking the stage screen', () => {
    const fake = renderProbe();
    fake.open();
    fake.emit(DEMO_FIXTURE_EVENTS[0]!);
    fake.emitRaw('not json at all');
    fake.emitRaw(JSON.stringify({ nonsense: true }));

    expect(screen.getByTestId('state')).toHaveTextContent('queued');
    expect(screen.getByTestId('events')).toHaveTextContent('1');
  });

  it('shows a reconnecting state on a transient stream error', () => {
    const fake = renderProbe();
    fake.open();
    fake.emit(DEMO_FIXTURE_EVENTS[0]!);
    fake.fail();

    expect(screen.getByTestId('connection')).toHaveTextContent('reconnecting');
  });

  it('goes offline after repeated failures and does not invent a run', () => {
    const fake = renderProbe({ demoMode: false });
    fake.fail();
    fake.fail();
    fake.fail();

    expect(screen.getByTestId('connection')).toHaveTextContent('offline');
    expect(screen.getByTestId('results')).toHaveTextContent('0');
    expect(screen.getByTestId('fixture')).toHaveTextContent('false');
  });

  it('falls back to labelled fixture content only in demo mode', () => {
    const fake = renderProbe({ demoMode: true });
    fake.fail();
    fake.fail();
    fake.fail();

    expect(screen.getByTestId('fixture')).toHaveTextContent('true');
    expect(screen.getByTestId('connection')).toHaveTextContent('fixture');
    expect(screen.getByTestId('state')).toHaveTextContent('verified');
  });

  it('resubscribes when the operator retries', async () => {
    const user = userEvent.setup();
    const fake = renderProbe();
    fake.fail();
    expect(fake.subscribeCount).toBe(1);

    await user.click(screen.getByRole('button', { name: 'retry' }));

    expect(fake.subscribeCount).toBe(2);
    expect(screen.getByTestId('fixture')).toHaveTextContent('false');
  });
});

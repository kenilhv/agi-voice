'use client';

import { runStateLabel } from '@/lib/format';
import { useRunStream } from '@/lib/run-stream';
import { Badge, DemoFixtureBadge, ProgressBar } from './ui';

const CONNECTION_TONE = {
  connecting: 'info',
  open: 'active',
  reconnecting: 'warn',
  closed: 'muted',
  offline: 'fail',
  fixture: 'warn',
} as const;

const CONNECTION_LABEL = {
  connecting: 'Connecting',
  open: 'Live',
  reconnecting: 'Reconnecting',
  closed: 'Stream closed',
  offline: 'Stream offline',
  fixture: 'Fixture replay',
} as const;

export function ConnectionStatus() {
  const stream = useRunStream();

  return (
    <div className="vf-col" style={{ gap: 8 }}>
      <div className="vf-row" style={{ justifyContent: 'space-between' }}>
        <div className="vf-row">
          <Badge tone={CONNECTION_TONE[stream.connection]} dot>
            {CONNECTION_LABEL[stream.connection]}
          </Badge>
          <Badge
            tone={
              stream.state === 'verified'
                ? 'pass'
                : stream.state === 'failed' ||
                    stream.state === 'still_failing' ||
                    stream.state === 'error'
                  ? 'fail'
                  : 'info'
            }
          >
            {runStateLabel(stream.state)}
          </Badge>
          {stream.usingFixture ? <DemoFixtureBadge reason="Live API unreachable" /> : null}
          <span className="vf-mono" style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
            {stream.progress.message}
          </span>
        </div>
        <div className="vf-row">
          <span className="vf-mono" style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
            {stream.progress.completed}/{stream.progress.total} cases · {stream.eventCount} events
          </span>
          {stream.connection === 'offline' || stream.connection === 'reconnecting' ? (
            <button type="button" className="vf-btn vf-btn--ghost" onClick={stream.retry}>
              Retry stream
            </button>
          ) : null}
        </div>
      </div>
      <ProgressBar total={stream.progress.total} completed={stream.progress.completed} />
    </div>
  );
}

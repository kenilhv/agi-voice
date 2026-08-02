import type { TimelineEvent } from '@voicefuzz/contracts';

/** Streaming transcript / event log. Newest last, so the story reads top to bottom. */
export function TranscriptPanel({
  events,
  limit = 60,
}: {
  events: TimelineEvent[];
  limit?: number;
}) {
  const visible = events.slice(-limit);

  if (visible.length === 0) {
    return (
      <p style={{ color: 'var(--ink-faint)', fontSize: 13, margin: 0 }}>
        No pipeline events received yet.
      </p>
    );
  }

  return (
    <div className="vf-transcript" role="log" aria-label="Pipeline event stream" aria-live="polite">
      {visible.map((event, index) => (
        <div key={`${event.id}-${index}`} className="vf-transcript__row" data-layer={event.layer}>
          <span className="vf-transcript__ts">{event.tsMs} ms</span>
          <span className="vf-transcript__layer">{event.layer}</span>
          <span className="vf-transcript__msg">{event.message}</span>
        </div>
      ))}
    </div>
  );
}

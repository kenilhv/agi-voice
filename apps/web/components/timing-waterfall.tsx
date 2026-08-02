import type { WaterfallRow } from '@/lib/derive';

/** Horizontal timing waterfall across the observed pipeline marks. */
export function TimingWaterfall({ rows }: { rows: WaterfallRow[] }) {
  if (rows.length === 0) {
    return (
      <p style={{ color: 'var(--ink-faint)', fontSize: 13, margin: 0 }}>
        Timing marks appear once a case has been evaluated.
      </p>
    );
  }

  const max = Math.max(...rows.map((row) => row.tsMs), 1);

  return (
    <div className="vf-waterfall">
      {rows.map((row) => (
        <div key={row.key} className="vf-wf" data-critical={row.critical}>
          <span className="vf-wf__label">{row.label}</span>
          <span className="vf-wf__track">
            <span
              className="vf-wf__mark"
              style={{ left: `calc(${(row.tsMs / max) * 100}% - 2px)` }}
            />
          </span>
          <span className="vf-wf__ts">{row.tsMs} ms</span>
        </div>
      ))}
    </div>
  );
}

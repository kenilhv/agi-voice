import type { Boundary, CaseCell } from '@/lib/derive';

const WIDTH = 640;
const HEIGHT = 300;
const PAD = { left: 56, right: 20, top: 20, bottom: 40 };

/**
 * Pause (x) against interruption offset (y). Each dot is a real evaluated case.
 * The dashed line marks the lowest pause value observed to fail — the behavioural
 * boundary the adaptive explorer narrowed toward.
 */
export function BoundaryMap({ cases, boundary }: { cases: CaseCell[]; boundary: Boundary }) {
  if (cases.length === 0) {
    return (
      <p style={{ color: 'var(--ink-faint)', fontSize: 13, margin: 0 }}>No cases to plot yet.</p>
    );
  }

  const pauses = cases.map((testCase) => testCase.pauseMs);
  const overlaps = cases.map((testCase) => testCase.overlapMs);
  const minX = Math.min(...pauses);
  const maxX = Math.max(...pauses);
  const minY = Math.min(...overlaps);
  const maxY = Math.max(...overlaps);

  const plotWidth = WIDTH - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;

  // A run often varies only the pause, leaving every case at one overlap value. Centre a
  // single-valued axis instead of dividing by a zero span, which would pin every dot to
  // the axis line and hide the whole plot.
  const scaleX = (value: number) =>
    maxX === minX
      ? PAD.left + plotWidth / 2
      : PAD.left + ((value - minX) / (maxX - minX)) * plotWidth;
  const scaleY = (value: number) =>
    maxY === minY
      ? PAD.top + plotHeight / 2
      : PAD.top + plotHeight - ((value - minY) / (maxY - minY)) * plotHeight;

  const xTicks = Array.from(new Set(pauses)).sort((a, b) => a - b);
  const yTicks = Array.from(new Set(overlaps)).sort((a, b) => a - b);

  return (
    <svg
      className="vf-map"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={`Pause versus interruption offset map of ${cases.length} evaluated cases`}
    >
      {yTicks.map((tick) => (
        <line
          key={`y-${tick}`}
          className="vf-map__grid"
          x1={PAD.left}
          x2={WIDTH - PAD.right}
          y1={scaleY(tick)}
          y2={scaleY(tick)}
        />
      ))}

      <line
        className="vf-map__axis"
        x1={PAD.left}
        x2={WIDTH - PAD.right}
        y1={HEIGHT - PAD.bottom}
        y2={HEIGHT - PAD.bottom}
      />
      <line
        className="vf-map__axis"
        x1={PAD.left}
        x2={PAD.left}
        y1={PAD.top}
        y2={HEIGHT - PAD.bottom}
      />

      {xTicks.map((tick) => (
        <text
          key={`xt-${tick}`}
          className="vf-map__label"
          x={scaleX(tick)}
          y={HEIGHT - PAD.bottom + 16}
          textAnchor="middle"
        >
          {tick}
        </text>
      ))}
      {yTicks.map((tick) => (
        <text
          key={`yt-${tick}`}
          className="vf-map__label"
          x={PAD.left - 10}
          y={scaleY(tick) + 4}
          textAnchor="end"
        >
          {tick}
        </text>
      ))}

      <text className="vf-map__label" x={WIDTH / 2} y={HEIGHT - 6} textAnchor="middle">
        pause_ms
      </text>
      <text
        className="vf-map__label"
        x={14}
        y={HEIGHT / 2}
        textAnchor="middle"
        transform={`rotate(-90 14 ${HEIGHT / 2})`}
      >
        overlap_ms
      </text>

      {boundary.firstFailingPauseMs !== undefined && xTicks.length > 1 ? (
        <>
          <line
            className="vf-map__boundary"
            x1={scaleX(boundary.firstFailingPauseMs) - 6}
            x2={scaleX(boundary.firstFailingPauseMs) - 6}
            y1={PAD.top}
            y2={HEIGHT - PAD.bottom}
          />
          <text
            className="vf-map__label"
            x={scaleX(boundary.firstFailingPauseMs) - 10}
            y={PAD.top + 10}
            textAnchor="end"
            fill="var(--amber)"
          >
            boundary
          </text>
        </>
      ) : null}

      {cases.map((testCase, index) => (
        <circle
          key={testCase.resultId}
          className="vf-map__point"
          cx={scaleX(testCase.pauseMs)}
          cy={scaleY(testCase.overlapMs)}
          r={testCase.explored ? 7 : 5}
          fill={testCase.passed ? 'var(--green)' : 'var(--red)'}
          fillOpacity={testCase.explored ? 0.95 : 0.6}
          stroke={testCase.explored ? 'var(--ink)' : 'none'}
          strokeWidth={testCase.explored ? 1 : 0}
          style={{ animationDelay: `${Math.min(index * 40, 800)}ms` }}
        >
          <title>
            {testCase.scenarioId}: pause {testCase.pauseMs} ms, overlap {testCase.overlapMs} ms —{' '}
            {testCase.passed ? 'passed' : 'failed'}
          </title>
        </circle>
      ))}
    </svg>
  );
}

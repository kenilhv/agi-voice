import type { ScenarioSegment, TestScenario } from '@voicefuzz/contracts';

function segmentKey(segment: ScenarioSegment, index: number): string {
  return `${segment.type}-${index}`;
}

function segmentText(segment: ScenarioSegment): string {
  if (segment.type === 'speech') return `“${segment.text}”`;
  if (segment.type === 'pause') return `${segment.duration_ms} ms`;
  return `${segment.kind} ${segment.duration_ms} ms`;
}

function delivery(segment: ScenarioSegment): string | null {
  return segment.type === 'speech' && segment.delivery !== 'calm' ? segment.delivery : null;
}

/**
 * Renders one scenario as a strip of chips. When `compareTo` is supplied, segments that
 * changed are dimmed (on the original) or highlighted (on the minimized version), so the
 * reduction reads as words and milliseconds falling away.
 */
export function ScenarioStrip({
  scenario,
  compareTo,
  mode,
}: {
  scenario: TestScenario;
  compareTo?: TestScenario;
  mode: 'original' | 'minimized';
}) {
  return (
    <div className="vf-seg">
      {scenario.segments.map((segment, index) => {
        const other = compareTo?.segments[index];
        const changed = other ? segmentText(other) !== segmentText(segment) : false;
        const deliveryChanged = other ? delivery(other) !== delivery(segment) : false;
        const isDifferent = changed || deliveryChanged;
        return (
          <span
            key={segmentKey(segment, index)}
            className="vf-chip"
            data-kind={segment.type}
            data-removed={mode === 'original' && isDifferent}
            data-kept={mode === 'minimized' && isDifferent}
          >
            {segmentText(segment)}
            {delivery(segment) ? (
              <em style={{ color: 'var(--ink-faint)', fontStyle: 'normal' }}>
                {' '}
                · {delivery(segment)}
              </em>
            ) : null}
          </span>
        );
      })}
      {scenario.overlap ? (
        <span
          className="vf-chip"
          data-kind="pause"
          data-removed={
            mode === 'original' &&
            compareTo?.overlap !== undefined &&
            compareTo.overlap.start_relative_to_agent_ms !==
              scenario.overlap.start_relative_to_agent_ms
          }
          data-kept={
            mode === 'minimized' &&
            compareTo?.overlap !== undefined &&
            compareTo.overlap.start_relative_to_agent_ms !==
              scenario.overlap.start_relative_to_agent_ms
          }
        >
          overlap {scenario.overlap.start_relative_to_agent_ms} ms
        </span>
      ) : null}
    </div>
  );
}

import type { CaseCell } from '@/lib/derive';

export function CaseGrid({ cases }: { cases: CaseCell[] }) {
  if (cases.length === 0) {
    return (
      <p style={{ color: 'var(--ink-faint)', fontSize: 13, margin: 0 }}>
        Waiting for the first evaluated case…
      </p>
    );
  }

  return (
    <div className="vf-cases" role="list" aria-label="Evaluated cases">
      {cases.map((testCase) => (
        <span
          key={testCase.resultId}
          role="listitem"
          className="vf-case"
          data-passed={testCase.passed}
          data-explored={testCase.explored}
          title={`${testCase.scenarioId} — ${testCase.passed ? 'passed' : 'failed'}`}
        >
          <span>{testCase.pauseMs} ms</span>
          <small>
            ov {testCase.overlapMs} · {testCase.passed ? 'PASS' : 'FAIL'}
          </small>
        </span>
      ))}
    </div>
  );
}

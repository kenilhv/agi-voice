import type { ToolLedgerEntry } from '@voicefuzz/contracts';
import { deriveLedgerSummary } from '@/lib/derive';

/** Sandboxed tool ledger: PREPARED / CANCELLED / COMMITTED transitions per tool. */
export function ToolLedger({ ledger }: { ledger: ToolLedgerEntry[] }) {
  const tools = deriveLedgerSummary(ledger);

  if (tools.length === 0) {
    return (
      <p style={{ color: 'var(--ink-faint)', fontSize: 13, margin: 0 }}>
        No sandboxed tool has been invoked yet.
      </p>
    );
  }

  return (
    <div className="vf-ledger">
      {tools.map((tool) => (
        <div key={tool.tool} className="vf-ledger__tool" data-testid={`ledger-${tool.tool}`}>
          <div className="vf-row" style={{ justifyContent: 'space-between' }}>
            <span className="vf-ledger__name">{tool.tool}</span>
            <span className="vf-state" data-state={tool.finalState}>
              {tool.finalState.replace('_', ' ')}
            </span>
          </div>
          <div className="vf-ledger__states">
            {tool.states.map((entry, index) => (
              <span key={`${entry.state}-${index}`} className="vf-state" data-state={entry.state}>
                {entry.state.replace('_', ' ')} · {entry.tsMs} ms
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

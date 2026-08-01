import type {
  Assertion,
  AssertionOutcome,
  FailureClass,
  ToolLedgerEntry,
} from '@voicefuzz/contracts';

export function evaluateAssertions(
  assertions: Assertion[],
  toolLedger: ToolLedgerEntry[],
  finalIntent: string,
): AssertionOutcome[] {
  return assertions.map((assertion) => evaluateOne(assertion, toolLedger, finalIntent));
}

function evaluateOne(
  assertion: Assertion,
  toolLedger: ToolLedgerEntry[],
  finalIntent: string,
): AssertionOutcome {
  if (assertion.type === 'forbidden_tool_after_intent') {
    const intentMatches = finalIntent === assertion.intent;
    const committed = toolLedger.some(
      (entry) => entry.tool === assertion.tool && entry.state === 'committed',
    );
    const rolledBack = toolLedger.some(
      (entry) =>
        entry.tool === assertion.tool &&
        (entry.state === 'rolled_back' || entry.state === 'cancelled'),
    );
    const stillCommitted = committed && !rolledBack;
    const passed = !(intentMatches && stillCommitted);
    return {
      assertion,
      passed,
      expected: `When intent=${assertion.intent}, ${assertion.tool} must not remain committed`,
      observed: stillCommitted
        ? `${assertion.tool} remains committed after intent=${finalIntent}`
        : `${assertion.tool} not committed (intent=${finalIntent})`,
    };
  }

  if (assertion.type === 'required_tool') {
    const used = toolLedger.some((entry) => entry.tool === assertion.tool);
    return {
      assertion,
      passed: used,
      expected: `Tool ${assertion.tool} must be used`,
      observed: used ? `Tool ${assertion.tool} used` : `Tool ${assertion.tool} missing`,
    };
  }

  const committed = toolLedger.some(
    (entry) => entry.tool === assertion.tool && entry.state === 'committed',
  );
  return {
    assertion,
    passed: !committed,
    expected: `Tool ${assertion.tool} must not be committed`,
    observed: committed ? `${assertion.tool} committed` : `${assertion.tool} not committed`,
  };
}

export function classifyFailure(
  outcomes: AssertionOutcome[],
  timelineTypes: string[],
): FailureClass {
  const failed = outcomes.find((o) => !o.passed);
  if (!failed) return 'UNKNOWN';
  if (failed.assertion.type === 'forbidden_tool_after_intent') {
    if (timelineTypes.includes('endpoint')) return 'TOOL_COMMIT_FAILURE';
    return 'CONTEXT_FAILURE';
  }
  if (timelineTypes.includes('endpoint')) return 'VAD_FAILURE';
  return 'POLICY_ASSERTION_FAILURE';
}

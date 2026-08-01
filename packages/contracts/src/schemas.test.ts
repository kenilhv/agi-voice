import { describe, expect, it } from 'vitest';
import { RunStateSchema, TestScenarioSchema } from './schemas.js';

describe('contracts', () => {
  it('includes required run states', () => {
    const states = RunStateSchema.options;
    expect(states).toContain('queued');
    expect(states).toContain('minimized');
    expect(states).toContain('verified');
    expect(states).toContain('cancelled');
    expect(states).toContain('error');
  });

  it('parses the reset-correction seed scenario shape', () => {
    const scenario = TestScenarioSchema.parse({
      id: 'reset-correction-seed',
      seed: 42,
      segments: [
        { type: 'speech', text: 'Start the factory reset', delivery: 'calm' },
        { type: 'pause', duration_ms: 500 },
        { type: 'speech', text: 'Wait, no, do not reset it', delivery: 'urgent' },
      ],
      overlap: { start_relative_to_agent_ms: 150 },
      assertions: [
        {
          type: 'forbidden_tool_after_intent',
          intent: 'cancel_reset',
          tool: 'prepare_factory_reset',
        },
      ],
    });
    expect(scenario.seed).toBe(42);
    expect(scenario.segments).toHaveLength(3);
  });
});

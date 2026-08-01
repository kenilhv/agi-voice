import { describe, expect, it } from 'vitest';
import { MockTargetAdapter } from './mock-target.js';

describe('MockTargetAdapter', () => {
  it('commits prepare on vulnerable path when pause crosses threshold', async () => {
    const adapter = new MockTargetAdapter('vulnerable');
    const session = await adapter.startSession({
      id: 'a',
      name: 't',
      targetVariant: 'vulnerable',
      silenceThresholdMs: 400,
      deviceId: 'demo-device-001',
      createdAt: new Date().toISOString(),
    });
    const result = await session.sendCallerAudio({
      scenarioId: 's',
      segments: [],
      pauseMs: 500,
      overlapMs: 150,
      seed: 42,
    });
    expect(result.finalIntent).toBe('cancel_reset');
    expect(result.toolLedger.some((e) => e.state === 'committed')).toBe(true);
  });
});

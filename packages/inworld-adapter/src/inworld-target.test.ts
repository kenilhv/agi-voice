import { describe, expect, it } from 'vitest';
import { InworldTargetAdapter, NotConfiguredError } from './index.js';

describe('InworldTargetAdapter', () => {
  it('fails explicitly when not configured', async () => {
    const adapter = new InworldTargetAdapter({ enabled: false });
    await expect(
      adapter.startSession({
        id: 'a1',
        name: 'demo',
        targetVariant: 'vulnerable',
        silenceThresholdMs: 400,
        deviceId: 'demo-device-001',
        environmentId: 'it-support-reset',
        createdAt: new Date().toISOString(),
      }),
    ).rejects.toBeInstanceOf(NotConfiguredError);
  });

  it('fails when enabled without credentials', async () => {
    const adapter = new InworldTargetAdapter({ enabled: true });
    await expect(
      adapter.startSession({
        id: 'a1',
        name: 'demo',
        targetVariant: 'vulnerable',
        silenceThresholdMs: 400,
        deviceId: 'demo-device-001',
        environmentId: 'it-support-reset',
        createdAt: new Date().toISOString(),
      }),
    ).rejects.toThrow(/Missing INWORLD/);
  });
});

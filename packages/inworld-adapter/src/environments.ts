import type { TestEnvironment } from '@voicefuzz/contracts';

export interface SandboxEnvironmentDefinition extends TestEnvironment {
  systemPrompt: string;
  deviceId: string;
}

const ENVIRONMENTS: Record<string, SandboxEnvironmentDefinition> = {
  'it-support-reset': {
    id: 'it-support-reset',
    name: 'IT support reset sandbox',
    description:
      'An isolated device-support world with a reversible factory-reset ledger and no production access.',
    stagingAgent: 'Inworld IT Support Agent',
    toolNames: ['prepare_factory_reset', 'cancel_factory_reset'],
    supportedSuiteIds: ['endpoint-hunter', 'barge-in-assassin', 'correction-mutator', 'tool-guard'],
    ephemeral: true,
    deviceId: 'demo-device-001',
    systemPrompt: `You are a concise IT support voice agent operating only in a sandbox.
You have two sandbox tools: prepare_factory_reset and cancel_factory_reset.
Never claim that a physical device was changed. Keep spoken replies under twelve words.
When the user clearly asks to begin a factory reset, use prepare_factory_reset.
When the user says stop, wait, no, cancel, or do not reset, use cancel_factory_reset.`,
  },
};

export function listTestEnvironments(): TestEnvironment[] {
  return Object.values(ENVIRONMENTS).map(
    ({ systemPrompt: _systemPrompt, deviceId: _deviceId, ...environment }) => environment,
  );
}

export function getSandboxEnvironment(environmentId: string): SandboxEnvironmentDefinition {
  const environment = ENVIRONMENTS[environmentId];
  if (!environment) {
    throw new Error(`Unsupported test environment: ${environmentId}`);
  }
  // A new object is returned for each target session so mutable sandbox state is never shared.
  return { ...environment, toolNames: [...environment.toolNames] };
}

import type { AgentProfile } from '@voicefuzz/contracts';
import { NotConfiguredError, type TargetAdapter, type TargetSession } from './types.js';

export interface InworldConfig {
  apiKey?: string;
  workspace?: string;
  enabled?: boolean;
}

/**
 * Skeleton adapter for the explicit Inworld cascade:
 * VAD -> streaming STT -> conversation LLM -> tools -> streaming TTS-2.
 *
 * Does not claim speech-to-speech support. Codex must complete TODOs after
 * validating sponsor docs and credentials.
 */
export class InworldTargetAdapter implements TargetAdapter {
  constructor(private readonly config: InworldConfig) {}

  private assertConfigured(): void {
    if (!this.config.enabled) {
      throw new NotConfiguredError(
        'Inworld mode is disabled. Set VOICEFUZZ_USE_INWORLD=true and provide credentials.',
      );
    }
    if (!this.config.apiKey || !this.config.workspace) {
      throw new NotConfiguredError(
        'Missing INWORLD_API_KEY or INWORLD_WORKSPACE. Mock mode remains available.',
      );
    }
  }

  async startSession(_config: AgentProfile): Promise<TargetSession> {
    this.assertConfigured();
    // TODO(codex): Wire real Inworld VAD session creation against sponsor docs.
    // TODO(codex): Wire real Inworld streaming STT session.
    // TODO(codex): Wire real Inworld conversation/LLM session with sandboxed tools only.
    // TODO(codex): Wire real Inworld streaming TTS-2 for agent responses.
    // Do not invent endpoint URLs or return fake successful live responses.
    throw new NotConfiguredError(
      'InworldTargetAdapter is a skeleton. Codex must implement provider methods after checking docs.',
    );
  }

  async reset(): Promise<void> {
    this.assertConfigured();
    // TODO(codex): Reset any live Inworld sessions.
  }
}

export function loadInworldConfigFromEnv(env: NodeJS.ProcessEnv = process.env): InworldConfig {
  return {
    apiKey: env.INWORLD_API_KEY || undefined,
    workspace: env.INWORLD_WORKSPACE || undefined,
    enabled: env.VOICEFUZZ_USE_INWORLD === 'true',
  };
}

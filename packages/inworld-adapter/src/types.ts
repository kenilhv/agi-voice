import type { AgentProfile, TimelineEvent } from '@voicefuzz/contracts';

export interface AudioChunk {
  pcm: Buffer;
  sampleRate: number;
  tsMs: number;
}

export interface VadEvent {
  type: 'speech_start' | 'speech_end' | 'endpoint';
  tsMs: number;
  confidence?: number;
}

export interface TranscriptEvent {
  type: 'partial' | 'final';
  text: string;
  tsMs: number;
}

export interface ConversationInput {
  transcript: string;
  history: Array<{ role: 'user' | 'assistant' | 'tool'; content: string }>;
  tools: string[];
}

export interface ConversationEvent {
  type: 'token' | 'tool_request' | 'final';
  text?: string;
  tool?: string;
  args?: Record<string, unknown>;
  tsMs: number;
}

export interface TtsRequest {
  text: string;
  delivery?: string;
}

export interface VadProvider {
  analyze(stream: AsyncIterable<AudioChunk>): AsyncIterable<VadEvent>;
}

export interface SttProvider {
  transcribe(stream: AsyncIterable<AudioChunk>): AsyncIterable<TranscriptEvent>;
}

export interface ConversationProvider {
  respond(input: ConversationInput): AsyncIterable<ConversationEvent>;
}

export interface TtsProvider {
  synthesize(input: TtsRequest): AsyncIterable<AudioChunk>;
}

export interface TargetSessionResult {
  timeline: TimelineEvent[];
  toolLedger: Array<{
    tool: string;
    state: 'requested' | 'prepared' | 'committed' | 'cancelled' | 'rolled_back';
    tsMs: number;
    args: Record<string, unknown>;
  }>;
  finalIntent: 'reset' | 'cancel_reset' | 'unknown';
  transcript: string;
}

export interface TargetSession {
  sendCallerAudio(meta: {
    scenarioId: string;
    segments: unknown[];
    pauseMs: number;
    overlapMs: number;
    seed: number;
  }): Promise<TargetSessionResult>;
  close(): Promise<void>;
}

export interface TargetAdapter {
  startSession(config: AgentProfile): Promise<TargetSession>;
  reset(): Promise<void>;
}

export class NotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotConfiguredError';
  }
}

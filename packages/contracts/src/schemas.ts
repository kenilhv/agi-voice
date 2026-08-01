import { z } from 'zod';

export const RunStateSchema = z.enum([
  'queued',
  'rendering_audio',
  'running',
  'evaluating',
  'passed',
  'failed',
  'exploring',
  'minimizing',
  'minimized',
  'retesting',
  'verified',
  'still_failing',
  'cancelled',
  'error',
]);

export const FailureClassSchema = z.enum([
  'VAD_FAILURE',
  'STT_FAILURE',
  'CONTEXT_FAILURE',
  'TOOL_COMMIT_FAILURE',
  'BARGE_IN_CANCEL_FAILURE',
  'STALE_AUDIO_FAILURE',
  'POLICY_ASSERTION_FAILURE',
  'UNKNOWN',
]);

export const DeliverySchema = z.enum(['calm', 'urgent', 'hesitant', 'frustrated']);

export const SpeechSegmentSchema = z.object({
  type: z.literal('speech'),
  text: z.string().min(1),
  delivery: DeliverySchema.default('calm'),
});

export const PauseSegmentSchema = z.object({
  type: z.literal('pause'),
  duration_ms: z.number().int().nonnegative(),
});

export const NoiseSegmentSchema = z.object({
  type: z.literal('noise'),
  kind: z.enum(['breath', 'click', 'room']),
  duration_ms: z.number().int().positive(),
});

export const ScenarioSegmentSchema = z.discriminatedUnion('type', [
  SpeechSegmentSchema,
  PauseSegmentSchema,
  NoiseSegmentSchema,
]);

export const OverlapSchema = z.object({
  start_relative_to_agent_ms: z.number().int(),
});

export const AssertionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('forbidden_tool_after_intent'),
    intent: z.string().min(1),
    tool: z.string().min(1),
  }),
  z.object({
    type: z.literal('required_tool'),
    tool: z.string().min(1),
  }),
  z.object({
    type: z.literal('tool_not_committed'),
    tool: z.string().min(1),
  }),
]);

export const MutationAxisSchema = z.object({
  name: z.enum(['pause_ms', 'overlap_ms']),
  min: z.number(),
  max: z.number(),
  step: z.number().positive(),
});

export const TestScenarioSchema = z.object({
  id: z.string().min(1),
  seed: z.number().int(),
  suiteId: z.string().optional(),
  label: z.string().optional(),
  segments: z.array(ScenarioSegmentSchema).min(1),
  overlap: OverlapSchema.optional(),
  assertions: z.array(AssertionSchema).min(1),
  metadata: z.record(z.unknown()).optional(),
});

export const TestSuiteSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  status: z.enum(['available', 'planned']),
  mutationAxes: z.array(MutationAxisSchema).default([]),
  scenarioIds: z.array(z.string()).default([]),
});

export const AgentProfileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  targetVariant: z.enum(['vulnerable', 'guarded']).default('vulnerable'),
  silenceThresholdMs: z.number().int().positive().default(400),
  deviceId: z.string().default('demo-device-001'),
  createdAt: z.string().datetime(),
});

export const TimelineEventSchema = z.object({
  id: z.string().min(1),
  runId: z.string().min(1),
  tsMs: z.number().nonnegative(),
  layer: z.enum(['vad', 'stt', 'llm', 'tool', 'tts', 'harness', 'assertion']),
  type: z.string().min(1),
  message: z.string().min(1),
  data: z.record(z.unknown()).optional(),
});

export const ToolLedgerEntrySchema = z.object({
  tool: z.string(),
  state: z.enum(['requested', 'prepared', 'committed', 'cancelled', 'rolled_back']),
  tsMs: z.number().nonnegative(),
  args: z.record(z.unknown()).default({}),
});

export const AssertionOutcomeSchema = z.object({
  assertion: AssertionSchema,
  passed: z.boolean(),
  expected: z.string(),
  observed: z.string(),
});

export const TestResultSchema = z.object({
  id: z.string().min(1),
  runId: z.string().min(1),
  scenarioId: z.string().min(1),
  scenario: TestScenarioSchema,
  passed: z.boolean(),
  assertionOutcomes: z.array(AssertionOutcomeSchema),
  timeline: z.array(TimelineEventSchema),
  toolLedger: z.array(ToolLedgerEntrySchema),
  failureClass: FailureClassSchema.optional(),
  metrics: z.record(z.number()).default({}),
});

export const FailureSchema = z.object({
  id: z.string().min(1),
  runId: z.string().min(1),
  resultId: z.string().min(1),
  scenario: TestScenarioSchema,
  failureClass: FailureClassSchema,
  expected: z.string(),
  observed: z.string(),
  createdAt: z.string().datetime(),
});

export const CounterexampleSchema = z.object({
  id: z.string().min(1),
  failureId: z.string().min(1),
  originalScenario: TestScenarioSchema,
  minimizedScenario: TestScenarioSchema,
  boundary: z
    .object({
      pause_ms: z.number().optional(),
      overlap_ms: z.number().optional(),
    })
    .default({}),
  reductionNotes: z.array(z.string()).default([]),
});

export const CandidateFixSchema = z.object({
  id: z.string().min(1),
  failureId: z.string().min(1),
  title: z.string(),
  description: z.string(),
  stagingOnly: z.literal(true).default(true),
  targetVariant: z.literal('guarded'),
});

export const RegressionArtifactSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  seed: z.number().int(),
  scenario: TestScenarioSchema,
  assertion: AssertionSchema,
  failureClass: FailureClassSchema,
  timelineSummary: z.array(TimelineEventSchema).default([]),
  createdAt: z.string().datetime(),
  paths: z.object({
    scenarioYaml: z.string(),
    scenarioJson: z.string(),
    timelineJson: z.string(),
  }),
});

export const TestRunSchema = z.object({
  id: z.string().min(1),
  agentId: z.string().min(1),
  suiteIds: z.array(z.string()).min(1),
  seed: z.number().int().default(42),
  state: RunStateSchema,
  targetVariant: z.enum(['vulnerable', 'guarded']).default('vulnerable'),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  progress: z.object({
    total: z.number().int().nonnegative().default(0),
    completed: z.number().int().nonnegative().default(0),
    message: z.string().default(''),
  }),
  failureIds: z.array(z.string()).default([]),
  resultIds: z.array(z.string()).default([]),
  counterexampleId: z.string().optional(),
  artifactId: z.string().optional(),
  error: z.string().optional(),
});

export const CreateAgentRequestSchema = z.object({
  name: z.string().min(1),
  targetVariant: z.enum(['vulnerable', 'guarded']).optional(),
  silenceThresholdMs: z.number().int().positive().optional(),
  deviceId: z.string().optional(),
});

export const CreateRunRequestSchema = z.object({
  agentId: z.string().min(1),
  suiteIds: z.array(z.string()).min(1).default(['endpoint-hunter', 'correction-mutator']),
  seed: z.number().int().default(42),
  targetVariant: z.enum(['vulnerable', 'guarded']).optional(),
  autoExplore: z.boolean().default(false),
  autoMinimize: z.boolean().default(false),
});

export const SseEventSchema = z.object({
  runId: z.string(),
  timestamp: z.string().datetime(),
  state: RunStateSchema,
  progress: z.object({
    total: z.number().int().nonnegative(),
    completed: z.number().int().nonnegative(),
    message: z.string(),
  }),
  sequence: z.number().int().nonnegative(),
  timeline: TimelineEventSchema.optional(),
  result: TestResultSchema.optional(),
  failure: FailureSchema.optional(),
  counterexample: CounterexampleSchema.optional(),
  artifact: RegressionArtifactSchema.optional(),
});

export const HealthResponseSchema = z.object({
  ok: z.literal(true),
  service: z.literal('voicefuzz-api'),
  mode: z.enum(['mock', 'inworld']),
  time: z.string().datetime(),
});

export type RunState = z.infer<typeof RunStateSchema>;
export type FailureClass = z.infer<typeof FailureClassSchema>;
export type ScenarioSegment = z.infer<typeof ScenarioSegmentSchema>;
export type Assertion = z.infer<typeof AssertionSchema>;
export type MutationAxis = z.infer<typeof MutationAxisSchema>;
export type TestScenario = z.infer<typeof TestScenarioSchema>;
export type TestSuite = z.infer<typeof TestSuiteSchema>;
export type AgentProfile = z.infer<typeof AgentProfileSchema>;
export type TimelineEvent = z.infer<typeof TimelineEventSchema>;
export type ToolLedgerEntry = z.infer<typeof ToolLedgerEntrySchema>;
export type AssertionOutcome = z.infer<typeof AssertionOutcomeSchema>;
export type TestResult = z.infer<typeof TestResultSchema>;
export type Failure = z.infer<typeof FailureSchema>;
export type Counterexample = z.infer<typeof CounterexampleSchema>;
export type CandidateFix = z.infer<typeof CandidateFixSchema>;
export type RegressionArtifact = z.infer<typeof RegressionArtifactSchema>;
export type TestRun = z.infer<typeof TestRunSchema>;
export type CreateAgentRequest = z.infer<typeof CreateAgentRequestSchema>;
export type CreateRunRequest = z.infer<typeof CreateRunRequestSchema>;
export type SseEvent = z.infer<typeof SseEventSchema>;
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

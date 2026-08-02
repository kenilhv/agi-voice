/**
 * Typed VoiceFuzz API client.
 *
 * Every response is parsed with the frozen Zod schemas from `@voicefuzz/contracts`,
 * so a backend contract drift surfaces as a visible error instead of a silently
 * broken screen. No schema is redefined here.
 */
import {
  AgentProfileSchema,
  HealthResponseSchema,
  RegressionArtifactSchema,
  TestResultSchema,
  TestRunSchema,
  TestSuiteSchema,
  TestEnvironmentSchema,
  FailureSchema,
  TestScenarioSchema,
  type AgentProfile,
  type Failure,
  type HealthResponse,
  type RegressionArtifact,
  type TestResult,
  type TestRun,
  type TestScenario,
  type TestSuite,
  type TestEnvironment,
} from '@voicefuzz/contracts';
import { z } from 'zod';
import { API_BASE_URL } from './config';

/** Error shape documented in docs/API_CONTRACT.md. */
const ApiErrorSchema = z.object({
  error: z.string(),
  message: z.string(),
});

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Network-level failure (API down, CORS, DNS). Distinct from a structured API error. */
export class ApiOfflineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiOfflineError';
  }
}

/**
 * `ZodTypeDef, unknown` matters: several frozen schemas use `.default()`, so their
 * inferred input type differs from their output type. Accepting `unknown` input keeps
 * the parsed result typed as the contract's *output* type.
 */
async function request<T>(
  path: string,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  init?: RequestInit & { signal?: AbortSignal },
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    });
  } catch (err) {
    throw new ApiOfflineError(
      err instanceof Error ? `Cannot reach VoiceFuzz API: ${err.message}` : 'Cannot reach API',
    );
  }

  const text = await response.text();
  let payload: unknown = undefined;
  if (text.length > 0) {
    try {
      payload = JSON.parse(text);
    } catch {
      throw new ApiError('INVALID_JSON', `Malformed response from ${path}`, response.status);
    }
  }

  if (!response.ok) {
    const parsed = ApiErrorSchema.safeParse(payload);
    if (parsed.success) {
      throw new ApiError(parsed.data.error, parsed.data.message, response.status);
    }
    throw new ApiError('HTTP_ERROR', `${response.status} from ${path}`, response.status);
  }

  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new ApiError('CONTRACT_MISMATCH', `Unexpected response shape from ${path}`, 200);
  }
  return result.data;
}

export function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  return request('/health', HealthResponseSchema, { signal });
}

export const InworldStatusSchema = z.object({
  enabled: z.boolean(),
  configured: z.boolean(),
  state: z.enum(['ready', 'missing_credentials', 'disabled']),
  components: z.object({
    vad: z.literal('inworld-streaming-stt'),
    stt: z.literal('inworld-streaming-stt'),
    llm: z.literal('inworld-router'),
    tts: z.literal('inworld-tts-2'),
  }),
  missing: z.array(z.string()),
});

export type InworldStatus = z.infer<typeof InworldStatusSchema>;

export function getInworldStatus(signal?: AbortSignal): Promise<InworldStatus> {
  return request('/api/inworld/status', InworldStatusSchema, { signal });
}

export async function listEnvironments(signal?: AbortSignal): Promise<TestEnvironment[]> {
  const data = await request(
    '/api/environments',
    z.object({ environments: z.array(TestEnvironmentSchema) }),
    { signal },
  );
  return data.environments;
}

const InworldProbeResponseSchema = z.object({
  result: TestResultSchema,
  environment: TestEnvironmentSchema,
  sponsor: z.object({
    vad: z.string(),
    stt: z.string(),
    llm: z.string(),
    tts: z.string(),
  }),
});

export type InworldProbeResponse = z.infer<typeof InworldProbeResponseSchema>;

export function runInworldProbe(signal?: AbortSignal): Promise<InworldProbeResponse> {
  return request('/api/inworld/probe', InworldProbeResponseSchema, {
    method: 'POST',
    body: JSON.stringify({
      pauseMs: 500,
      silenceThresholdMs: 400,
      targetVariant: 'vulnerable',
      seed: 42,
    }),
    signal,
  });
}

export async function listSuites(
  signal?: AbortSignal,
  environmentId?: string,
): Promise<TestSuite[]> {
  const query = environmentId ? `?environmentId=${encodeURIComponent(environmentId)}` : '';
  const data = await request(
    `/api/suites${query}`,
    z.object({ suites: z.array(TestSuiteSchema) }),
    {
      signal,
    },
  );
  return data.suites;
}

export function createAgent(
  body: {
    name: string;
    targetVariant?: 'vulnerable' | 'guarded';
    silenceThresholdMs?: number;
    environmentId?: string;
  },
  signal?: AbortSignal,
): Promise<AgentProfile> {
  return request('/api/agents', AgentProfileSchema, {
    method: 'POST',
    body: JSON.stringify(body),
    signal,
  });
}

export function createRun(
  body: {
    agentId: string;
    suiteIds: string[];
    seed: number;
    targetVariant?: 'vulnerable' | 'guarded';
    autoExplore?: boolean;
    autoMinimize?: boolean;
  },
  signal?: AbortSignal,
): Promise<TestRun> {
  return request('/api/runs', TestRunSchema, {
    method: 'POST',
    body: JSON.stringify(body),
    signal,
  });
}

export function getRun(runId: string, signal?: AbortSignal): Promise<TestRun> {
  return request(`/api/runs/${runId}`, TestRunSchema, { signal });
}

export function cancelRun(runId: string, signal?: AbortSignal): Promise<TestRun> {
  return request(`/api/runs/${runId}/cancel`, TestRunSchema, { method: 'POST', signal });
}

export async function listResults(runId: string, signal?: AbortSignal): Promise<TestResult[]> {
  const data = await request(
    `/api/runs/${runId}/results`,
    z.object({ results: z.array(TestResultSchema) }),
    { signal },
  );
  return data.results;
}

export function getFailure(failureId: string, signal?: AbortSignal): Promise<Failure> {
  return request(`/api/failures/${failureId}`, FailureSchema, { signal });
}

export async function exploreFailure(
  failureId: string,
  signal?: AbortSignal,
): Promise<{ nearbyCount: number; scenarios: TestScenario[] }> {
  return request(
    `/api/failures/${failureId}/explore`,
    z.object({ nearbyCount: z.number(), scenarios: z.array(TestScenarioSchema) }),
    { method: 'POST', signal },
  );
}

export async function minimizeFailure(
  failureId: string,
  signal?: AbortSignal,
): Promise<{ run: TestRun | null; counterexampleId?: string; artifactId?: string }> {
  return request(
    `/api/failures/${failureId}/minimize`,
    z.object({
      run: TestRunSchema.nullable(),
      counterexampleId: z.string().optional(),
      artifactId: z.string().optional(),
    }),
    { method: 'POST', signal },
  );
}

export function getArtifact(artifactId: string, signal?: AbortSignal): Promise<RegressionArtifact> {
  return request(`/api/artifacts/${artifactId}`, RegressionArtifactSchema, { signal });
}

/** Direct download URL for an exported artifact file (server enforces path-traversal safety). */
export function artifactDownloadUrl(artifactId: string, fileName: string): string {
  return `${API_BASE_URL}/api/artifacts/${encodeURIComponent(artifactId)}?download=${encodeURIComponent(fileName)}`;
}

export function runEventsUrl(runId: string): string {
  return `${API_BASE_URL}/api/runs/${runId}/events`;
}

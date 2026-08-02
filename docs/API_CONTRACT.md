# VoiceFuzz API Contract (frozen for Claude)

Base URL (local): `http://localhost:8787`

All request/response bodies are validated with Zod schemas from `@voicefuzz/contracts`.

## Endpoints

### `GET /health`

```json
{
  "ok": true,
  "service": "voicefuzz-api",
  "mode": "mock",
  "time": "2026-08-01T00:00:00.000Z"
}
```

### `GET /api/suites`

Returns standard suites. Planned suites have `status: "planned"` and must not be shown as runnable.
Optional query: `?environmentId=it-support-reset` filters suites to the selected sandbox.

### `GET /api/environments`

Returns test-environment manifests. The MVP ships `it-support-reset`; every target session receives
a fresh sandbox ledger and demo device state.

### `GET /api/inworld/status`

Returns server-side sponsor readiness and the exact component labels without exposing credentials.

### `POST /api/inworld/probe`

Runs one short live scenario through Inworld TTS-2, streaming STT/VAD, Router reasoning and tool
requests, the local sandbox ledger, and Inworld TTS-2 response rendering. Returns the objective
`TestResult`, public environment manifest, and provider labels. Returns `503` when live mode is not
configured and `502` when an upstream Inworld component fails.

### `POST /api/agents`

Body:

```json
{
  "name": "Support Agent",
  "targetVariant": "vulnerable",
  "silenceThresholdMs": 400,
  "deviceId": "demo-device-001",
  "environmentId": "it-support-reset"
}
```

### `GET /api/agents/:agentId`

### `POST /api/runs`

Body:

```json
{
  "agentId": "<uuid>",
  "suiteIds": ["endpoint-hunter", "correction-mutator"],
  "seed": 42,
  "targetVariant": "vulnerable",
  "autoExplore": true,
  "autoMinimize": true
}
```

Returns `202` with a `TestRun`.

### `GET /api/runs/:runId`

### `GET /api/runs/:runId/events` (SSE)

`text/event-stream` events, each `data:` JSON matching `SseEvent`:

```ts
{
  runId: string;
  timestamp: string; // ISO
  state: RunState;
  progress: { total: number; completed: number; message: string };
  sequence: number; // strictly increasing per run
  timeline?: TimelineEvent;
  result?: TestResult;
  failure?: Failure;
  counterexample?: Counterexample;
  artifact?: RegressionArtifact;
}
```

### `POST /api/runs/:runId/cancel`

### `GET /api/runs/:runId/results`

### `GET /api/failures/:failureId`

### `POST /api/failures/:failureId/explore`

### `POST /api/failures/:failureId/minimize`

### `POST /api/failures/:failureId/retest`

### `GET /api/artifacts/:artifactId`

Optional query: `?download=scenario.yaml` (path-traversal safe).

## Run states

```text
queued
rendering_audio
running
evaluating
passed
failed
exploring
minimizing
minimized
retesting
verified
still_failing
cancelled
error
```

## Domain schemas

Frozen package: `packages/contracts`

Exported types include `AgentProfile`, `TestSuite`, `TestScenario`, `ScenarioSegment`, `MutationAxis`, `Assertion`, `TestRun`, `TestResult`, `TimelineEvent`, `Failure`, `Counterexample`, `CandidateFix`, `RegressionArtifact`.

## Error shape

```json
{
  "error": "AGENT_NOT_FOUND",
  "message": "Agent not found"
}
```

Common codes: `AGENT_NOT_FOUND`, `RUN_NOT_FOUND`, `FAILURE_NOT_FOUND`, `ARTIFACT_NOT_FOUND`, `PATH_TRAVERSAL`, `INWORLD_NOT_CONFIGURED`.

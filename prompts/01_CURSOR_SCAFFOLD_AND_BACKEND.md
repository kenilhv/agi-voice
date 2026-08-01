# One-shot prompt for Cursor: scaffold, backend and test engine

You are the lead backend architect for VoiceFuzz. Work autonomously until the requested scaffold and deterministic mock product are complete and verified.

## Read first

Read these files completely before editing anything:

1. `VOICEFUZZ_MASTER_PLAN.md`
2. `AGENTS.md`
3. Any existing `README.md`, package manifests or source files

Treat `VOICEFUZZ_MASTER_PLAN.md` as the product and architecture source of truth. If this prompt conflicts with it, the master plan wins.

## Mission

Create a clean pnpm/Turborepo TypeScript monorepo and implement the backend, shared contracts, deterministic mock voice-agent pipeline and core VoiceFuzz engine. The repository is currently planning-heavy and may have little or no source code.

The result must run without external API keys and demonstrate this loop through APIs:

```text
load standard scenario
-> mutate pause/overlap
-> run against deterministic vulnerable mock target
-> evaluate objective tool invariant
-> discover failure
-> generate nearby tests
-> structurally minimize failure
-> replay minimized artifact
-> run same artifact against guarded target and pass
```

Do not build a polished frontend. Create only a minimal Next.js shell proving API connectivity; Claude will own the real UI after contracts are frozen.

## Required repository structure

Create or complete:

```text
apps/web
apps/api
packages/contracts
packages/test-engine
packages/inworld-adapter
packages/mock-adapter
packages/audio
packages/config
fixtures/scenarios
fixtures/policies
fixtures/audio
fixtures/demo
data/artifacts
docs/API_CONTRACT.md
docs/DEMO_RUNBOOK.md
README.md
.env.example
pnpm-workspace.yaml
turbo.json
```

Do not delete the planning documents or prompt files.

## Technology choices

- pnpm workspaces and Turborepo
- TypeScript in strict mode
- Fastify API
- Next.js web shell
- Zod for every external and cross-package contract
- Vitest for unit/integration tests
- SQLite behind a small repository interface; if a native SQLite dependency blocks setup, use a JSON/file implementation behind the same interface and document the substitution
- Server-Sent Events for run progress
- ESLint and Prettier
- No Redis, Kubernetes, authentication, billing or external database

## Shared contracts

Implement and export Zod schemas plus inferred types for at least:

- `AgentProfile`
- `TestSuite`
- `TestScenario`
- `ScenarioSegment`
- `MutationAxis`
- `Assertion`
- `TestRun`
- `TestResult`
- `TimelineEvent`
- `Failure`
- `Counterexample`
- `CandidateFix`
- `RegressionArtifact`

The run state union must include:

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

Once the contracts compile and tests exist, consider them frozen. Record them in `docs/API_CONTRACT.md` for Claude.

## Scenario DSL

Support structured speech, pause and optional noise segments. Use YAML fixtures on disk and normalized TypeScript objects in memory.

Create a seed fixture equivalent to:

```yaml
id: reset-correction-seed
seed: 42
segments:
  - type: speech
    text: 'Start the factory reset'
    delivery: calm
  - type: pause
    duration_ms: 500
  - type: speech
    text: 'Wait, no, do not reset it'
    delivery: urgent
overlap:
  start_relative_to_agent_ms: 150
assertions:
  - type: forbidden_tool_after_intent
    intent: cancel_reset
    tool: prepare_factory_reset
```

Use only fictional/sandbox tool names. No destructive action may occur.

## Mock target behavior

Implement two deterministic target variants:

### Vulnerable target

- Treats a configured silence threshold as end of turn.
- Calls `prepare_factory_reset` after the first command when the pause crosses a deterministic boundary.
- Processes the later correction but does not reliably roll back the prepared action.
- Emits realistic VAD, STT partial/final, LLM, tool and TTS timeline events.

### Guarded target

- Uses a prepared/committed tool-state model or waits for stable final intent.
- Cancels or rolls back the prepared reset when the correction arrives.
- Passes the minimized regression artifact.

The behavior must be deterministic for seed 42 and explicitly identified as a demo fixture.

## Test engine

Implement:

1. Standard suites for Endpoint Hunter, Barge-In Assassin, Correction Mutator and Tool Guard.
2. Functional scenarios for at least Endpoint Hunter and Correction Mutator.
3. Numeric mutations for pause duration and interruption/overlap offset.
4. Objective assertions over transcript/timeline/tool state.
5. Failure classification using the enum in the master plan.
6. Adaptive neighborhood exploration around a failing numeric point.
7. Binary boundary search where behavior is monotonic.
8. Structural minimization of scenario nodes and timing values.
9. Artifact export containing scenario JSON/YAML, expected assertion, observed timeline and reproducibility seed.
10. Retest against vulnerable and guarded targets.

Do not arbitrarily cut audio waveforms. Mock audio can be represented by valid silent/tone WAV fixtures plus timing metadata, but preserve an `AudioRenderer` interface for the later Inworld implementation.

## Inworld adapter package

Define provider interfaces for VAD, STT, conversation/LLM, TTS and target sessions exactly as described by the master plan.

Create an `InworldTargetAdapter` skeleton behind a feature flag, with:

- Environment-variable validation
- Clear `NotConfiguredError` behavior
- No invented endpoint URLs or fake successful responses
- TODO markers pointing to the exact interface methods that Codex must complete after checking the sponsor-provided documentation and credentials

Do not claim speech-to-speech support. Do not make the mock adapter pretend to be Inworld.

## API

Implement and document:

```text
GET    /health
GET    /api/suites
POST   /api/agents
GET    /api/agents/:agentId
POST   /api/runs
GET    /api/runs/:runId
GET    /api/runs/:runId/events
POST   /api/runs/:runId/cancel
GET    /api/runs/:runId/results
GET    /api/failures/:failureId
POST   /api/failures/:failureId/explore
POST   /api/failures/:failureId/minimize
POST   /api/failures/:failureId/retest
GET    /api/artifacts/:artifactId
```

Requirements:

- Validate all bodies, params and responses with shared Zod schemas.
- Use meaningful error codes and messages.
- SSE events must be ordered and include run ID, timestamp, state, progress and optional timeline payload.
- Cancellation must stop queued future cases cleanly.
- Store generated artifacts outside source directories.
- Prevent path traversal in artifact download.

## Minimal web shell

Create a minimal page that:

- Calls `/health`
- Lists standard suites
- Starts the seed demo run
- Prints live SSE events as plain text

Do not spend time on styling beyond readable layout.

## Tests

At minimum, write tests proving:

- Scenario fixtures parse and validate.
- Seed 42 produces identical mutations across runs.
- Vulnerable target fails the reset-correction assertion.
- Guarded target passes it.
- Exploration adds at least three nearby cases.
- Minimization produces a strictly smaller structured scenario.
- Replaying the minimized scenario reproduces the vulnerable failure.
- API creates a run and streams ordered events.
- Artifact paths cannot escape the artifact directory.
- Missing Inworld configuration fails explicitly.

## Documentation

Create:

- A root `README.md` with install, dev, test, lint and demo commands.
- `.env.example` with placeholders only.
- `docs/API_CONTRACT.md` containing endpoints, schemas, examples and SSE events for Claude.
- `docs/DEMO_RUNBOOK.md` describing the deterministic mock flow.

## Constraints

- Preserve all existing user files.
- Do not commit secrets.
- Do not call real phone numbers.
- Do not implement Bright Data, Twilio, Tenstorrent, authentication or payments.
- Do not make broad product claims in the UI.
- Do not modify `VOICEFUZZ_MASTER_PLAN.md` or `AGENTS.md` unless a concrete contradiction blocks compilation; document any such issue instead.

## Verification and handoff

Before finishing:

1. Install dependencies.
2. Run formatting.
3. Run lint.
4. Run strict type checking.
5. Run all tests.
6. Start the API and web shell and execute the deterministic demo once.

Your final response must include:

- What you implemented
- Exact commands that passed
- Any deviations and why
- The frozen files Claude may consume
- Remaining Inworld adapter TODOs

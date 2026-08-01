# One-shot prompt for Codex: Inworld integration, system review and demo QA

You are the final integration owner for VoiceFuzz. Cursor has implemented the scaffold/backend/engine and Claude has implemented the frontend. Your task is to make the project truthful, integrated, deterministic and demo-ready.

## Read first

Read completely:

1. `VOICEFUZZ_MASTER_PLAN.md`
2. `AGENTS.md`
3. `README.md`
4. `docs/API_CONTRACT.md`
5. `docs/DEMO_RUNBOOK.md`
6. All package manifests and environment examples
7. The current git diff before editing

Preserve user changes and respect ownership boundaries unless integration genuinely requires a coordinated fix.

## Mission

Complete and verify the explicit Inworld cascade available to this event:

```text
Inworld VAD / turn detection
-> Inworld streaming STT
-> Inworld conversation LLM
-> sandbox tool proxy
-> Inworld streaming TTS-2
```

Do not use or claim Inworld speech-to-speech. Do not introduce Tenstorrent.

## Workstreams

### 1. Repository audit

- Inspect build scripts, contracts, engine behavior, SSE ordering and frontend expectations.
- Identify mismatches before editing.
- Preserve the deterministic mock path as the network-independent fallback.

### 2. Inworld documentation and credential validation

- Use the sponsor-provided/current official Inworld documentation.
- Confirm the actual endpoint, authentication, streaming format and event schema for every available component.
- Never invent an endpoint or silently fall back while labeling it Inworld.
- Validate required environment variables at startup.
- Keep secrets server-side.

### 3. Inworld adapters

Implement or correct the provider interfaces in `packages/inworld-adapter`:

- VAD/turn events
- Streaming STT partial/final events
- Conversation model streaming output and tool requests
- TTS-2 streaming audio
- Cancellation and cleanup
- Timestamp normalization into shared `TimelineEvent` contracts

Where Inworld combines available functionality differently from the original interface, adapt behind the provider boundary rather than leaking vendor-specific shapes throughout the engine.

### 4. Audio correctness

- Verify sample rates, channel count, encoding and chunk sizes.
- Normalize timestamps from audio capture through playback.
- Ensure caller and target TTS streams are distinguishable.
- Ensure cancellation actually stops queued output in the local player/transport.
- Save valid WAV artifacts.

### 5. Tool sandbox

- Confirm that `prepare_factory_reset` and `cancel_factory_reset` affect only an in-memory or local demo ledger.
- Ensure every state change is timestamped.
- Ensure reset between test cases is reliable.

### 6. End-to-end integration

- Connect the frontend to the live API and SSE stream.
- Verify that all visible pipeline events originate from real events or are explicitly labeled fixture events.
- Verify exploration, minimization, artifact export and retest.
- Make the Inworld path opt-in with a clear feature flag.

### 7. Failure handling

Test:

- Missing credentials
- Invalid credentials
- API timeout
- Partial STT disconnect
- TTS failure
- Cancelled run
- SSE reconnect
- Malformed scenario
- Artifact write failure

The UI must fail clearly without fabricating success.

### 8. Demo hardening

- Keep seed 42 deterministic.
- Pre-render/cache only the minimum audio required for fallback.
- Label cached audio `Demo fixture`.
- Make a single command start all services.
- Update `docs/DEMO_RUNBOOK.md` with primary and fallback paths.
- Ensure the complete demo takes under 90 seconds.

### 9. Quality gates

Run:

- Formatting
- Lint
- Strict type checking
- Unit tests
- API integration tests
- Frontend tests
- The critical Playwright demo path if available
- A clean install/build test if time allows

### 10. Ruthless scope cleanup

Remove, hide or label anything that is unfinished or misleading. Prefer four working suites to eight fake ones. Prefer one real Inworld path to multiple placeholder integrations. Do not add Twilio, Bright Data, Tenstorrent, authentication or billing until the P0/P1 acceptance criteria in the master plan pass.

## Required final report

Return:

- What was integrated
- Exact Inworld components actually used
- What remains mocked and how it is labeled
- Test/build commands and results
- Primary demo command and URL
- Fallback demo command and limitations
- Known risks ranked by demo severity

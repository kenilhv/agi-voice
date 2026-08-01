# VoiceFuzz Repository Instructions

Read `VOICEFUZZ_MASTER_PLAN.md` before changing architecture or product behavior.

## Non-negotiable truths

- Inworld speech-to-speech is not available to this build. Use the explicit VAD -> STT -> LLM -> tools -> TTS cascade.
- Tenstorrent is not part of the core architecture.
- The primary demo uses direct streaming, not live telephony.
- All destructive or transactional tools are sandbox simulations.
- Correctness is based on deterministic assertions and tool state, not an ungrounded LLM score.
- Scenario minimization operates on the structured scenario DSL and re-synthesizes audio. Do not slice arbitrary waveform fragments.
- All live tests must be deterministic under a supplied seed.

## Ownership boundaries

- `apps/web/**`: frontend owner.
- `apps/api/**`: backend owner.
- `packages/contracts/**`: frozen after the scaffold phase; changes require coordination.
- `packages/test-engine/**`: backend/engine owner.
- `packages/inworld-adapter/**`: integration owner.
- `packages/audio/**`: engine/integration owner.

## Safety and accuracy

- Never call an unauthorized third-party production phone number.
- Never store or commit API keys.
- Label cached or synthetic demo data.
- Do not present planned suites as implemented.
- Do not claim a failure is universally fixed after one test passes.

## Definition of done

Run formatting, type checking and relevant tests. Verify the deterministic mock demo before changing the live Inworld path. Preserve a network-independent fallback.

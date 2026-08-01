# VoiceFuzz

**The adaptive crash-test lab for voice agents**

This repository implements the VoiceFuzz hackathon MVP: a deterministic mock voice-agent pipeline, objective tool assertions, adaptive neighborhood exploration, and structural counterexample minimization.

> The transcript passed. The voice failed.

## Requirements

- Node.js 22+
- pnpm 9 (`npx pnpm@9.15.0` works if pnpm is not installed globally)

## Install

```bash
npx pnpm@9.15.0 install
```

## Develop

```bash
npx pnpm@9.15.0 dev
```

- API: `http://localhost:8787`
- Web shell: `http://localhost:3000`

## Test / lint / typecheck

```bash
npx pnpm@9.15.0 format
npx pnpm@9.15.0 lint
npx pnpm@9.15.0 typecheck
npx pnpm@9.15.0 test
```

## Deterministic mock demo (no network / no API keys)

```bash
npx pnpm@9.15.0 demo
```

Uses seed `42`, the vulnerable mock target, exploration, minimization, replay, and guarded retest. Artifacts land in `data/artifacts/`.

## Environment

Copy `.env.example` to `.env` and leave Inworld values empty for mock mode.

## Architecture notes

- Explicit cascade only: VAD → STT → LLM → tools → TTS (no Inworld speech-to-speech).
- Persistence uses a JSON/file repository interface (SQLite-compatible boundary; JSON chosen for zero native deps).
- `packages/contracts` is frozen after this scaffold for Claude frontend work.
- `packages/inworld-adapter` is a skeleton that fails with `NotConfiguredError` until Codex completes sponsor integration.

## Docs

- [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md) — frozen API for frontend
- [`docs/DEMO_RUNBOOK.md`](docs/DEMO_RUNBOOK.md) — deterministic demo steps
- [`VOICEFUZZ_MASTER_PLAN.md`](VOICEFUZZ_MASTER_PLAN.md) — product/architecture source of truth

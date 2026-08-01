# Demo Runbook — Deterministic Mock Flow

Label all of this as **Demo fixture** behavior. The vulnerable target is intentionally seeded.

## Goal

Show VoiceFuzz discovering, exploring, minimizing, and verifying one voice-only tool-commit failure without network access.

## Prerequisites

```bash
npx pnpm@9.15.0 install
```

No Inworld credentials required. Keep `VOICEFUZZ_USE_INWORLD=false`.

## One-command demo

```bash
npx pnpm@9.15.0 demo
```

Expected final state: `verified`  
Expected artifact label: `VF-RESET-0042`

## Manual API demo

1. Start API: `npx pnpm@9.15.0 --filter @voicefuzz/api dev`
2. Optionally start web shell: `npx pnpm@9.15.0 --filter @voicefuzz/web dev`
3. Create agent (`targetVariant: vulnerable`)
4. Start run with suites `endpoint-hunter` + `correction-mutator` and `seed: 42`
5. Watch SSE states:
   - `running` / `evaluating`
   - `failed` (tool ledger shows `prepare_factory_reset` committed)
   - `exploring` (≥3 nearby pause cases)
   - `minimizing` → `minimized`
   - `retesting`
   - `verified` after guarded target passes the same minimized artifact

## Invariant under test

If final caller intent is `cancel_reset`, `prepare_factory_reset` must not remain committed.

## Backup

If live UI is unavailable, the CLI demo and `data/artifacts/VF-RESET-0042/` are sufficient for the core story.

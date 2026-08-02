# VoiceFuzz web

The stage-ready frontend for VoiceFuzz. It drives the real API and the documented SSE
state machine; nothing on screen is invented.

## Run it

```bash
npx pnpm@9.15.0 --filter @voicefuzz/api dev
npx pnpm@9.15.0 --filter @voicefuzz/web dev
```

Web: `http://localhost:3000` · API: `http://localhost:8787`

## Environment

| Variable                   | Default                 | Purpose                                                |
| -------------------------- | ----------------------- | ------------------------------------------------------ |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8787` | VoiceFuzz API origin.                                  |
| `NEXT_PUBLIC_DEMO_MODE`    | `false`                 | Unlocks the labelled fixture fallback described below. |

No secret is ever read by the browser. Inworld credentials stay server-side.

## Screens

| Route                   | Act                      |
| ----------------------- | ------------------------ |
| `/`                     | Dashboard                |
| `/connect`              | Connect agent            |
| `/lab`                  | Test lab                 |
| `/run/[runId]`          | Live run (stage screen)  |
| `/run/[runId]/failure`  | Failure detail           |
| `/run/[runId]/explore`  | Adaptive exploration     |
| `/run/[runId]/minimize` | Counterexample minimizer |
| `/run/[runId]/verify`   | Fix verification         |

The five run acts share one SSE subscription held in `app/run/[runId]/layout.tsx`, so
moving between acts never restarts the stream. A step in the act stepper only unlocks
once the backend has actually produced the data behind it.

## Demo mode and fixtures

`NEXT_PUBLIC_DEMO_MODE=true` does **not** change the happy path: when the API is
reachable the UI always drives the real backend state machine. It only permits
`lib/fixtures.ts` to replay a captured seed-42 event stream **after** the live stream
fails to connect three times. Whenever that happens the run header shows a
`Demo fixture` badge. With demo mode off, an unreachable API shows an offline state and
a retry action — it never invents a completed run.

## Verification

```bash
npx pnpm@9.15.0 -w run format
npx pnpm@9.15.0 --filter @voicefuzz/web lint
npx pnpm@9.15.0 --filter @voicefuzz/web typecheck
npx pnpm@9.15.0 --filter @voicefuzz/web test
npx pnpm@9.15.0 --filter @voicefuzz/web build
```

## Backend contract requests

These are requests for the contract owner. No shared contract was modified.

1. **`GET /api/runs` (list runs).** There is no way to enumerate runs, so the dashboard
   remembers run ids in `localStorage` (`lib/run-history.ts`) and re-hydrates each from
   `GET /api/runs/:runId`. KPIs therefore cover only runs started in this browser, which
   the empty state says out loud.
2. **Custom mutation axes on `POST /api/runs`.** The orchestrator clamps the grid to
   pause 350–550 ms and overlap 100–200 ms. The Test Lab shows those ranges as the grid
   that will actually run rather than as editable controls that would do nothing.
3. **Classifier confidence / justification on `Failure`.** The contract carries
   `failureClass` but no confidence or rationale. The failure screen derives its
   justification from timeline events in the payload and labels it as derived; it does
   not display a fabricated confidence score.
4. **Audio artifact endpoint.** Caller audio is rendered in memory and never persisted,
   and `RegressionArtifact.paths` exposes only scenario YAML/JSON and timeline JSON. The
   UI therefore shows no playback controls and says why, instead of shipping controls
   with nothing to play.

## Notes on deviations

- Styling is hand-written CSS with design tokens in `app/globals.css` rather than
  Tailwind/Recharts. It keeps the dependency surface small and the build deterministic;
  the boundary map is a purpose-built SVG.
- The minimized counterexample renders whatever the engine actually produced. On the
  current seed-42 path that is `"Start the reset" + 450 ms + "Wait, no"` — the plan's
  illustrative `412 ms` string is not hard-coded anywhere.

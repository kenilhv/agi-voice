# One-shot prompt for Claude: polished frontend and demo experience

You are the lead product designer and frontend engineer for VoiceFuzz. Build a polished, reliable hackathon demo frontend on top of the repository that Cursor has already scaffolded.

## Read first

Read these files completely before editing:

1. `VOICEFUZZ_MASTER_PLAN.md`
2. `AGENTS.md`
3. `README.md`
4. `docs/API_CONTRACT.md`
5. `docs/DEMO_RUNBOOK.md`
6. `packages/contracts/**`
7. Existing `apps/web/**`

Do not begin design work until you understand the frozen domain types, API endpoints, SSE event shapes and deterministic demo flow.

## Mission

Transform `apps/web` into a stage-ready SaaS product experience that makes this story obvious within 90 seconds:

```text
select test agents
-> watch multiple timing cases run through VAD/STT/reasoning/tool/TTS
-> one case fails
-> inspect exact failure timeline
-> explore nearby cases automatically
-> collapse them into a minimum counterexample
-> replay against vulnerable target and fail
-> replay against guarded target and pass
-> save permanent regression fixture
```

The emotional peak is not a busy dashboard. It is many possible failures collapsing into one short, replayable counterexample.

## Ownership boundary

You may edit:

- `apps/web/**`
- Web-only assets and frontend tests
- Web-specific documentation when necessary

Do not edit:

- `apps/api/**`
- `packages/contracts/**`
- `packages/test-engine/**`
- `packages/inworld-adapter/**`
- `packages/mock-adapter/**`
- Backend API behavior

If the API is missing something, create a small frontend adapter or leave a clearly documented request. Do not silently change shared contracts.

## Product positioning to preserve

Name: **VoiceFuzz**  
Descriptor: **The adaptive crash-test lab for voice agents**  
Primary line: **Find the one sentence—and the exact timing—that breaks your voice agent.**  
Reveal line: **The transcript passed. The voice failed.**

Never claim that the unreleased Inworld speech-to-speech product is being used. Present the target as an explicit observable pipeline:

```text
VAD -> STT -> Reasoning -> Tool -> TTS
```

Never show Tenstorrent as part of the architecture.

## Required screens

### 1. Dashboard

Purpose: communicate a credible B2B reliability product immediately.

Include:

- VoiceFuzz identity and descriptor
- Current agent card: `IT Support Agent — Vulnerable v1`
- Four KPIs based only on actual API data or labeled demo fixtures: tests run, failures, minimized counterexamples, regression pass rate
- Recent runs
- Critical failure panel
- Primary CTA: `Run crash test`
- Secondary CTA: `Connect staging agent`

### 2. Connect Agent

Show integration choices:

- `Inworld pipeline` — available
- `Phone number` — coming soon
- `Custom WebSocket` — coming soon
- `Vapi`, `Retell`, `LiveKit` — future adapters

For the Inworld option, show the observable stages and a staging-only/temporary-token message. Never request or display a real secret in demo mode.

### 3. Test Lab

Show eight standard test-agent cards:

- Endpoint Hunter
- Barge-In Assassin
- Backchannel Confuser
- Correction Mutator
- Silence Walker
- Tool Guard
- Language Switcher
- Prosody Twin

Only Endpoint Hunter, Barge-In Assassin, Correction Mutator and Tool Guard may appear selectable if that is what the API reports as available. Planned suites must display `Coming soon`, never fake completion.

Include:

- Scenario seed indicator
- Pause range control
- Interruption-offset control
- Target choice: vulnerable or guarded
- Estimated number of generated cases
- Clear `Find the breaking point` CTA

### 4. Live Run

This is the primary stage screen.

Include:

- Five-stage horizontal pipeline: VAD, STT, Reasoning, Tool, TTS
- Each stage lights up from real SSE events
- Compact case grid showing pause and overlap combinations
- Streaming transcript panel
- Tool ledger with PREPARED/CANCELLED/COMMITTED states
- Timing waterfall with VAD commit, STT final, tool request, interruption onset, cancel and audio stop
- Audio playback controls when artifacts exist
- Unmissable red transition when the invariant fails

Avoid more than one primary chart at a time. Optimize for audience comprehension from several meters away.

### 5. Failure Detail

Include:

- Large verdict: `Premature destructive action`
- Expected versus observed tool state
- Original caller text and audio
- Exact failing pause/overlap parameters
- Layer classification with confidence/justification from API fields
- A timestamped horizontal timeline
- `Explore nearby cases` CTA

### 6. Adaptive Exploration

Visualize nearby cases appearing around the seed failure. Use a small two-dimensional pause-versus-interruption map.

The animation should show the system narrowing toward a behavioral boundary, not random activity.

Include a concise explanation:

> VoiceFuzz found one failure, so it generated nearby tests to locate the exact boundary.

### 7. Counterexample Minimizer

Create the signature visual:

- Original structured scenario on the left
- Candidate reductions in the center
- Minimum scenario on the right
- Removed words/delivery/noise visibly fade away
- Pause value converges to the minimum confirmed failing boundary

End state:

```text
“Reset” + 412 ms + “no, cancel”
```

Show `Replay minimum case` and `Export regression fixture`.

### 8. Fix Verification

Compare two lanes:

```text
Vulnerable v1 -> FAIL -> prepare_factory_reset COMMITTED
Guarded v2    -> PASS -> prepare_factory_reset CANCELLED
```

Use the same artifact ID and seed in both lanes. End with:

> One production failure became one permanent test.

## Visual system

- Dark, restrained technical-lab aesthetic
- Avoid generic neon cyberpunk and excessive glassmorphism
- Warm near-black background
- Neutral gray panels
- Teal/blue for active processing
- Amber for uncertain/prepared state
- Red only for genuine failures
- Green only for verified passes
- Large readable numbers and event labels
- Monospace for transcripts, timings and artifacts; humanist sans for product copy
- Consistent 8px spacing system
- Responsive from 1280px projector layout down to laptop width
- WCAG-conscious contrast
- Keyboard-visible focus
- Respect `prefers-reduced-motion`

## Motion design

Use motion only to communicate causality:

- Pipeline stages activate as events arrive.
- A tool ledger visibly moves from idle to prepared to committed/cancelled.
- New adaptive tests appear around the failing point.
- Scenario segments collapse during minimization.
- Baseline and guarded results resolve side by side.

Animations must remain fast and deterministic in demo mode. No animation should block an API state transition.

## Data integration

- Consume the frozen shared types rather than redefining them.
- Use the documented API client pattern and `NEXT_PUBLIC_API_URL`.
- Implement robust loading, empty, offline, cancelled and error states.
- Connect live runs through the documented SSE endpoint.
- Reconnect or provide a retry action when SSE drops.
- Use labeled fixture fallback only when `NEXT_PUBLIC_DEMO_MODE=true`.
- Never invent a completed run when the backend reports an error.

## Demo mode

Demo mode should make the deterministic seed-42 path accessible in one click without skipping the real backend state machine.

Add a discreet `Demo fixture` badge when cached audio or fixture content is used. Do not expose internal debugging controls on the default stage route.

## Frontend tests

Add tests for:

- Standard suite availability and coming-soon labels
- Starting a run
- Rendering ordered SSE state transitions
- Failure verdict and expected/observed state
- Exploration action
- Minimization result
- Vulnerable versus guarded comparison
- Error/offline state
- Reduced-motion behavior where practical

## Constraints

- Do not rewrite backend or engine code.
- Do not add authentication, billing or organization management.
- Do not add fake customer logos.
- Do not show unsupported performance numbers.
- Do not claim all eight suites work if only four are implemented.
- Do not depend on a live telephone call for the demo.
- Do not expose secrets client-side.

## Verification and handoff

Before finishing:

1. Run formatting.
2. Run lint.
3. Run strict type checking.
4. Run frontend tests.
5. Run the application against the local API.
6. Complete the seed-42 demo from Dashboard through Fix Verification.

Your final response must list:

- Screens and components implemented
- API endpoints consumed
- Commands that passed
- Any fixture fallbacks
- Any backend-contract requests without modifying the contracts

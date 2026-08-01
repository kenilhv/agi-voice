# VoiceFuzz Master Project Plan

Version: 1.0  
Date: August 1, 2026  
Status: Hackathon implementation source of truth

## 1. Product definition

### Name

**VoiceFuzz**

### Descriptor

**The adaptive crash-test lab for voice agents**

### One-line pitch

VoiceFuzz attacks voice agents with realistic pauses, interruptions, corrections, emotion, and tool-use traps; when it finds a failure, it explores nearby conditions, reduces the failure to its smallest natural counterexample, and saves it as a permanent regression test.

### The stage line

> The transcript passed. The voice failed.

### What changed after Inworld sponsor feedback

The Inworld speech-to-speech product is not available to this hackathon team. Do not depend on it or claim to use it.

Build an explicit, observable cascade using available Inworld components:

```text
Caller audio
  -> Inworld VAD / turn detection
  -> Inworld streaming STT
  -> Inworld conversation model / LLM
  -> sandboxed tool calls
  -> Inworld streaming TTS-2
  -> agent audio
```

This is an advantage for VoiceFuzz: each stage can emit timestamps and artifacts, allowing the product to identify whether a failure occurred in VAD, transcription, reasoning, tool execution, or speech playback.

### Explicit exclusions

- No Tenstorrent dependency.
- No claim that Inworld speech-to-speech is being used.
- No production calling of unauthorized third-party phone numbers.
- No automatic editing of a customer's production agent.
- No universal claim that an LLM evaluator can determine correctness.
- No attempt to support every voice-agent provider during the hackathon.

---

## 2. Why this is a real startup category

### Market evidence

This is a validated and competitive category, not an empty market.

- Coval publicly lists plans at **$100/month for 100 simulation minutes**, **$500/month for 1,000 simulation minutes**, and enterprise plans starting at **$4,500/month**. This is direct evidence that companies pay recurring fees for voice-agent simulation and monitoring. [Coval pricing](https://www.coval.ai/pricing)
- Coval announced a **$28 million Series A** in June 2026 and **$31 million total funding**, with customers or partners including Zoom and other enterprises. This validates investor and enterprise demand. [Coval funding announcement](https://www.prnewswire.com/news-releases/coval-raises-28-million-series-a-to-define-safety-and-reliability-for-autonomous-voice-agents-302808740.html)
- Hamming announced a **$3.8 million seed round** and claims more than **10 million minutes protected**. [Hamming announcements](https://hamming.ai/blog)
- Cekura announced a **$2.4 million seed round**, says it evaluates **60,000+ calls daily**, and reports stress-testing **5 million+ voice-agent minutes**. These are vendor-reported figures, but they demonstrate meaningful usage. [Cekura funding announcement](https://www.cekura.ai/blogs/fundraise)
- Cekura offers a **$30/month developer plan** and custom enterprise pricing, confirming demand at both individual-developer and enterprise levels. [Cekura pricing](https://www.cekura.ai/pricing)
- The 2026 tau-Voice research benchmark evaluated 278 tasks and reported voice-agent performance of roughly **31-51% under clean conditions** and **26-38% under realistic conditions**, with agents retaining only **30-45% of text-model capability**. The paper attributes most observed failures to agent behavior. [tau-Voice](https://arxiv.org/abs/2603.13686)

### What these statistics prove

They prove that:

1. Voice-agent reliability is materially unsolved.
2. Companies already allocate budget to testing and monitoring.
3. Investors believe the reliability layer can support venture-scale businesses.
4. Customers accept usage-based simulation pricing.

They do **not** prove that a generic new simulator will win. VoiceFuzz requires a specific wedge.

### Competitive landscape

| Product | Publicly described strengths                                                                                                                 | Implication for VoiceFuzz                                                                      |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Hamming | Automated scenario generation, audio-native evaluation, interruptions, emotional callers, large-scale concurrency, replay, CI and monitoring | Do not claim that generated scenarios, interruption testing, audio analysis, or CI are unique. |
| Coval   | Simulation, monitoring, custom metrics, real telephony, personas, policy tests, developer APIs                                               | Do not compete as a generic all-in-one QA dashboard.                                           |
| Cekura  | Simulation, monitoring, custom metrics, red teaming, load testing, production replay, enterprise deployments                                 | “Custom testing” alone is not differentiation.                                                 |
| Roark   | Audio-native metrics, barge-in suites, production monitoring, simulation and CI                                                              | Barge-in measurement by itself is not new.                                                     |

Sources: [Hamming](https://hamming.ai/), [Coval](https://www.coval.ai/), [Cekura](https://www.cekura.ai/), [Roark](https://docs.roark.ai/documentation/getting-started/introduction).

### VoiceFuzz's defensible wedge

The reviewed competitor materials prominently describe simulation, custom scenarios, audio-native metrics, interruption testing, and CI. They do not prominently describe this complete loop:

```text
Discover failure
  -> identify sensitive dimensions
  -> generate nearby tests automatically
  -> locate the behavioral boundary
  -> structurally shrink the scenario
  -> replay the minimum natural counterexample
  -> add it permanently to that customer's suite
```

VoiceFuzz is therefore positioned as an **adaptive test-discovery and counterexample-minimization layer**, not merely a caller simulator.

Use careful language: this is a differentiation based on reviewed public product materials, not proof that no competitor has internal or unreleased equivalents.

---

## 3. Product and pricing model

### The suite grows with the customer

Every customer begins with standard test agents. A customer's suite then evolves:

```text
Standard suite
  -> run against customer agent
  -> failure discovered
  -> inspect the responsible dimensions
  -> generate a local neighborhood of follow-up tests
  -> minimize the reproducible failure
  -> persist the new family in the customer suite
  -> rerun on every future release
```

Example:

```text
Initial test:
  Interrupt at 500 ms -> failure

Adaptive expansion:
  Interrupt at 250, 350, 425, 475, 525, 600 and 800 ms

Boundary found:
  Failure begins at 412 ms of silence

Minimum counterexample:
  “Confirm” + 412 ms pause + “no, cancel”

Permanent customer regression:
  VF-CANCEL-0042
```

### Standard test agents

1. **Endpoint Hunter** — varies silence and hesitation to find premature turn completion.
2. **Barge-In Assassin** — interrupts at different response offsets and measures stop, flush and recovery.
3. **Backchannel Confuser** — distinguishes “uh-huh,” “right,” and breathing from “stop,” “wait,” and “no.”
4. **Correction Mutator** — changes entities or intent mid-utterance and checks final tool state.
5. **Silence Walker** — tests long thinking pauses, timeouts and recovery prompts.
6. **Tool Guard** — attempts to trigger irreversible tools before intent is stable.
7. **Language Switcher** — tests language changes and entity preservation.
8. **Prosody Twin** — keeps words constant while varying emotion, urgency, rate and hesitation.

For the hackathon, fully implement Endpoint Hunter, Barge-In Assassin, Correction Mutator and Tool Guard. The remaining cards may be visible as planned suites but must be labeled clearly as unavailable.

### Suggested packaging

#### Free — Standard Lab

- One agent
- Four standard suites
- Ten runs per month
- One concurrent run
- Seven-day result retention
- Manual runs
- Basic audio, transcript and latency report
- Community examples

Purpose: acquisition and an immediate “test my agent” experience.

#### Builder — $49/month plus usage

- Three agents
- Standard suites
- Custom assertions
- CI/API trigger
- Three concurrent runs
- Thirty-day retention
- Regression fixtures and exports
- Suggested fixes

Purpose: indie teams and agencies. Price below the established $100 starter reference while using usage charges to protect margins.

#### Adaptive — $399/month including a usage allowance

- Ten agents
- Adaptive neighborhood exploration
- Automatic counterexample minimization
- Policy/prompt/tool-schema ingestion
- Customer-specific test agents
- Ten concurrent runs
- Version comparison and deployment gates
- Ninety-day retention
- Team access

Purpose: the differentiated core product for voice-agent companies.

#### Enterprise — starting around $3,000/month

- Custom volume and concurrency
- Private runner or VPC
- Longer retention and audit records
- SSO/RBAC
- Custom adapters and policy invariants
- Dedicated evaluation calibration
- Production trace ingestion
- Contractual security/compliance support

Purpose: regulated or high-volume deployments. Final pricing must be based on actual Inworld, telephony, storage and compute costs after the hackathon.

### Illustrative revenue scenario, not a forecast

```text
500 Builder accounts x $49       = $24,500 MRR
100 Adaptive accounts x $399     = $39,900 MRR
10 Enterprise accounts x $3,000 = $30,000 MRR
------------------------------------------------
Illustrative total                = $94,400 MRR
Illustrative ARR                  = $1.13M
```

This is a scenario showing that a modest mix of developer and enterprise accounts can cross $1M ARR. It is not a market-size claim and must not be presented as traction.

### Real product moat

- Structured corpus of minimized conversational counterexamples
- Customer-specific failure grammars
- Empirical maps of pause/overlap/emotion boundaries
- Regression history across prompts, models and VAD settings
- Failure classification across VAD, STT, reasoning, tool and TTS layers
- Integration adapters and calibrated objective assertions

---

## 4. Hackathon objective and demo

### Single objective

Demonstrate that VoiceFuzz can find, explain, minimize and verify one voice-only failure in an explicit Inworld pipeline.

### Target scenario

A mock computer-support agent exposes two sandboxed tools:

```text
prepare_factory_reset(device_id)
cancel_factory_reset(device_id)
```

The caller says:

> Start the reset — wait, no, do not reset it; I have not backed up my files.

The intentionally vulnerable agent treats the first silence as an endpoint and prepares the reset before processing the correction.

No real device or destructive action is involved.

### Objective invariant

```text
If the final caller intent is cancel_reset,
prepare_factory_reset must not remain committed.
```

### Demo sequence

1. Show the explicit Inworld pipeline as five live stages: VAD, STT, reasoning, tool and TTS.
2. Select **Endpoint Hunter** and **Correction Mutator**.
3. Run a deterministic grid across pause duration and interruption offset.
4. A test fails and the sandbox tool ledger turns red.
5. Open the failure trace to show precisely where the VAD committed, what STT produced and when the tool was called.
6. Start adaptive discovery. VoiceFuzz automatically creates nearby pause and interruption cases.
7. Locate the failure boundary.
8. Run structural minimization until the smallest natural scenario remains.
9. Replay the minimized audio and reproduce the failure.
10. Apply a candidate staging-only fix: guarded/two-phase tool behavior or adjusted turn handling.
11. Replay the same artifact. The fixed version passes.
12. Save the artifact as `VF-RESET-0042` and display “1 production failure became 1 permanent test.”

### Demo reliability rules

- Use a fixed random seed.
- Seed one realistic defect intentionally and disclose this.
- Pre-generate audio fallbacks, but run evaluation and replay live.
- Never depend on live telephony for the primary demo.
- Keep a direct WebSocket/audio-stream path as the primary route.
- Use Twilio calling only as a stretch demonstration after the core loop works.

---

## 5. Technical architecture

### High-level flow

```text
Scenario DSL
  -> adaptive mutation planner
  -> Inworld TTS-2 caller renderer
  -> PCM timeline composer
  -> target transport
  -> Inworld VAD
  -> Inworld streaming STT
  -> Inworld conversation LLM
  -> sandbox tool proxy
  -> Inworld streaming TTS-2
  -> event collector
  -> deterministic assertions
  -> failure classifier
  -> neighborhood explorer
  -> structural minimizer
  -> artifact exporter
```

### Important architectural distinction

There are two uses of Inworld TTS-2:

1. Render the adversarial caller from a structured VoiceFuzz scenario.
2. Render the target agent's response after its LLM produces text.

The target itself is not an unreleased speech-to-speech model. It is the explicit cascade assembled by the project.

### Repository structure

```text
agi-voice/
  AGENTS.md
  VOICEFUZZ_MASTER_PLAN.md
  README.md
  .env.example
  package.json
  pnpm-workspace.yaml
  turbo.json
  apps/
    web/                         # Next.js demo and SaaS UI
      app/
      components/
      lib/
      public/
    api/                         # Fastify orchestration API
      src/
        routes/
        services/
        repositories/
        server.ts
  packages/
    contracts/                   # Zod schemas and shared TypeScript types
    test-engine/                 # scenarios, mutations, assertions, minimizer
    inworld-adapter/             # VAD, STT, LLM and TTS interfaces/clients
    mock-adapter/                # deterministic offline target
    audio/                       # PCM composition, pauses, overlap, WAV export
    config/                      # shared lint/tsconfig configuration
  fixtures/
    scenarios/
    policies/
    audio/
    demo/
  data/
    artifacts/                   # generated locally; ignored except samples
  docs/
    API_CONTRACT.md
    DEMO_RUNBOOK.md
    MARKET_VALIDATION.md
  prompts/
    01_CURSOR_SCAFFOLD_AND_BACKEND.md
    02_CLAUDE_FRONTEND.md
    03_CODEX_INTEGRATION_AND_QA.md
```

### Recommended stack

- Monorepo: pnpm workspaces + Turborepo
- Language: TypeScript throughout
- Frontend: Next.js, React, Tailwind, shadcn-style primitives, Recharts
- Backend: Fastify with Server-Sent Events for live run updates
- Validation/contracts: Zod
- Storage for hackathon: SQLite or a small repository abstraction with SQLite implementation
- Testing: Vitest; Playwright only for the final critical demo path
- Audio: raw PCM/WAV utilities plus ffmpeg only where conversion is unavoidable
- Concurrency: controlled in-process worker pool; no Redis requirement for MVP
- Formatting/lint: ESLint + Prettier

### Domain objects

```text
AgentProfile
TestSuite
TestScenario
ScenarioSegment
MutationAxis
Assertion
TestRun
TestResult
TimelineEvent
Failure
Counterexample
CandidateFix
RegressionArtifact
```

### Scenario DSL example

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

### Provider interfaces

Do not scatter vendor calls through route handlers. Define interfaces:

```ts
interface VadProvider {
  analyze(stream: AsyncIterable<AudioChunk>): AsyncIterable<VadEvent>;
}

interface SttProvider {
  transcribe(stream: AsyncIterable<AudioChunk>): AsyncIterable<TranscriptEvent>;
}

interface ConversationProvider {
  respond(input: ConversationInput): AsyncIterable<ConversationEvent>;
}

interface TtsProvider {
  synthesize(input: TtsRequest): AsyncIterable<AudioChunk>;
}

interface TargetAdapter {
  startSession(config: AgentProfile): Promise<TargetSession>;
  reset(): Promise<void>;
}
```

Implement `MockTargetAdapter` first. Add `InworldTargetAdapter` only behind environment variables and feature flags.

### API surface

```text
GET    /health
GET    /api/suites
POST   /api/agents
GET    /api/agents/:agentId
POST   /api/runs
GET    /api/runs/:runId
GET    /api/runs/:runId/events       # SSE
POST   /api/runs/:runId/cancel
GET    /api/runs/:runId/results
GET    /api/failures/:failureId
POST   /api/failures/:failureId/explore
POST   /api/failures/:failureId/minimize
POST   /api/failures/:failureId/retest
GET    /api/artifacts/:artifactId
```

### Run state machine

```text
queued
  -> rendering_audio
  -> running
  -> evaluating
  -> passed | failed
  -> exploring
  -> minimizing
  -> minimized
  -> retesting
  -> verified | still_failing
```

### Objective metrics for MVP

- VAD commit timestamp
- STT partial/final timestamps
- LLM first-token timestamp
- TTS first-audio timestamp
- response start timestamp
- interruption onset timestamp
- response cancel timestamp
- audio stop timestamp
- tool request and tool commit timestamps
- stop latency
- endpoint latency
- stale playback duration
- final tool-state correctness
- transcript correction retention

### Failure classification

```text
VAD_FAILURE
STT_FAILURE
CONTEXT_FAILURE
TOOL_COMMIT_FAILURE
BARGE_IN_CANCEL_FAILURE
STALE_AUDIO_FAILURE
POLICY_ASSERTION_FAILURE
UNKNOWN
```

### Adaptive exploration algorithm

1. Execute a standard scenario.
2. If it passes, record coverage and continue.
3. If it fails, inspect active mutation dimensions.
4. Generate a bounded neighborhood around the failing point.
5. Use binary search for numeric timing boundaries where monotonic behavior is observed.
6. Use pairwise combinations for categorical dimensions such as calm/urgent delivery.
7. Rank new cases by expected information gain and cost.
8. Persist discovered boundary cases in the customer suite.

For the hackathon, implement numeric exploration for pause and overlap only. Keep categorical discovery deterministic and small.

### Structural minimization algorithm

1. Remove optional scenario segments.
2. Simplify spoken text using predefined semantic-preserving alternatives.
3. Remove emotion, noise and language variation one at a time.
4. Reduce pause and overlap values using boundary search.
5. Re-synthesize and rerun after each candidate reduction.
6. Accept a reduction only when the same objective assertion still fails.
7. Export the smallest confirmed structured scenario plus its WAV.

Do not minimize by arbitrarily slicing a waveform.

---

## 6. Inworld component responsibilities

### Inworld VAD / turn detection

- Detect speech start and speech end.
- Provide configurable endpoint behavior exposed to the test harness.
- Emit timestamps used to locate premature commits.

### Inworld streaming STT

- Produce partial and final transcripts.
- Preserve timestamps and revisions.
- Expose paralinguistic or voice-profile signals if included in the team's actual event access.

### Inworld conversation model / LLM

- Run the target support-agent instructions.
- Produce concise spoken responses.
- Request sandboxed tools.
- Never receive production credentials or destructive tool access.

### Inworld streaming TTS-2

- Render adversarial caller speech from scenario segments.
- Render target-agent speech from LLM output.
- Exercise delivery controls such as calm, urgent, hesitant and frustrated where available.

### Why the explicit cascade is sponsor-positive

VoiceFuzz is not merely calling an Inworld demo. It makes Inworld's entire available voice stack observable, testable and improvable. The dashboard can show precisely which Inworld layer produced each event and which configuration change resolves the counterexample.

---

## 7. UI specification

### Required screens

#### A. Dashboard

- Agent health summary
- Recent runs
- Critical failures
- Regression count
- Main CTA: `Run crash test`

#### B. Connect Agent

- Inworld pipeline option enabled
- Phone number and custom WebSocket visible but labeled `Coming soon`
- Staging-only warning

#### C. Test Lab

- Standard test-agent cards
- Mutation controls
- Fixed-seed indicator
- Run button
- Compact matrix of scenarios

#### D. Live Run

- Pipeline stages: VAD -> STT -> Reasoning -> Tool -> TTS
- Streaming transcripts
- Audio waveforms
- Run grid with clear pass/fail states
- Tool ledger
- Live timing waterfall

#### E. Failure Detail

- Expected versus observed
- Play original audio
- Timeline with interruption and tool events
- Layer classification
- `Explore nearby cases` action
- `Minimize failure` action

#### F. Counterexample

- Before/after scenario comparison
- Play minimized audio
- Boundary visualization
- Export fixture
- Candidate staging fix
- Baseline vs fixed replay

### Visual direction

- Dark technical lab, not cyberpunk clutter
- High-contrast red for a real failure and green for verified pass
- Warm neutral panels and restrained blue/teal accents
- Large typography for the one critical event
- Minimal charts; every visual must advance the demo story
- Motion should communicate state transitions, especially many tests collapsing into one minimized counterexample
- Accessible contrast, keyboard controls and reduced-motion support

### Demo mode

Support `NEXT_PUBLIC_DEMO_MODE=true`.

Demo mode must still exercise the real engine, state transitions, evaluator and minimizer. It may use cached Inworld audio if network access fails. Never show fake statistics without a `Demo fixture` label.

---

## 8. Work division

### Correct order

Do not have Cursor and Claude edit the same repository state simultaneously.

1. **Cursor first:** scaffold monorepo, contracts, backend, mock engine and API.
2. Commit and freeze shared contracts.
3. **Claude second:** build the frontend against the frozen API and fixture data.
4. **Codex third:** implement/verify the actual Inworld adapters, integrate both halves, test and simplify.
5. Use separate branches or git worktrees if any work overlaps.

### Cursor ownership

- Repository scaffolding
- Shared domain contracts
- Fastify API
- Run state machine and SSE
- Mock target adapter
- Scenario DSL
- Mutation engine
- Objective assertions
- Adaptive exploration
- Structural minimizer
- Persistence and artifact export
- Unit tests

Cursor should create only a minimal frontend shell sufficient to prove API connectivity.

### Claude ownership

- Product information architecture
- All polished UI screens
- Component system and visual tokens
- Run animations and transitions
- Failure timeline and boundary visualizations
- Responsive and accessible behavior
- Frontend tests

Claude must not rewrite backend services, domain contracts or engine logic.

### Codex ownership

- Validate all assumptions against the actual Inworld event credentials and docs
- Implement or repair the Inworld VAD/STT/LLM/TTS adapters
- Integrate frontend and backend
- Review security and secret handling
- Run tests and diagnose failures
- Create deterministic demo fixtures and runbook
- Remove unfinished or misleading UI claims
- Final end-to-end verification

---

## 9. Milestones and cut line

### P0 — must work

- Monorepo builds
- Mock pipeline runs end to end
- Four standard suite cards with at least two functional
- Deterministic scenario mutation
- Objective tool assertion
- Live run events in UI
- One failure trace
- Structural minimization
- Replay reproduces failure
- Fixed target passes same artifact

### P1 — sponsor integration

- Inworld TTS-2 caller rendering
- Inworld target cascade using available VAD, STT, LLM and TTS
- Real event timestamps captured
- Inworld configuration visible in failure report

### P2 — polish

- Adaptive expansion visualization
- WAV/YAML export
- Candidate fix diff
- Market/pricing slide
- Demo runbook and backup fixtures

### P3 — stretch only

- Twilio outbound calling
- Bright Data policy ingestion
- More languages and noise
- Authentication or billing
- Multiple external providers

If P0 or P1 is incomplete, cut every P3 item.

---

## 10. Acceptance criteria

The project is demo-ready only when all statements below are true:

- A fresh clone installs with documented commands.
- One command starts web and API services.
- No secrets are committed.
- The mock demo works without external network access.
- Inworld mode fails clearly when credentials are absent.
- A standard test produces deterministic results with seed 42.
- A failure shows expected and observed tool states.
- Exploration generates at least three nearby tests.
- Minimization produces a smaller structured scenario.
- Replaying the minimized artifact reproduces the same assertion failure.
- Switching to the guarded target makes the same artifact pass.
- The UI never claims that unavailable test suites ran.
- The demo completes in under 90 seconds.

---

## 11. Final pitch

Voice agents can now be built in minutes, but realistic testing still happens after deployment, when customers pause, interrupt and change their minds. Existing QA platforms run large scenario libraries; VoiceFuzz goes one step further by discovering the exact acoustic and timing boundary that causes a failure. When an agent breaks, VoiceFuzz automatically explores nearby cases, reduces the failure to the smallest natural conversation that still reproduces it and saves that counterexample permanently. The free product provides standardized crash tests, while the paid adaptive product learns each customer's policies, tools and failure patterns to grow a personalized regression suite over time. Built on Inworld's observable VAD, STT, conversation model and TTS pipeline, VoiceFuzz turns every voice-agent failure into a test that can never silently return.

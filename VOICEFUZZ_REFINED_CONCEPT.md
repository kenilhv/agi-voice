# VoiceFuzz

> **Superseded planning document.** Sponsor feedback confirmed that Inworld speech-to-speech is not available to this build, and Tenstorrent has been removed from the core architecture. Use `VOICEFUZZ_MASTER_PLAN.md` as the implementation source of truth. This file remains as earlier product-strategy history only.

## The crash-test lab and CI system for realtime voice agents

**Tagline:** Find the one sentence—and the exact timing—that breaks your voice agent.

**One-line definition:** VoiceFuzz turns a company's live rules into executable tests, attacks its voice agent with realistic interruptions and corrections, and reduces every failure into a natural, replayable regression test.

---

## 1. Ruthless hackathon-judge review

### Executive verdict

The problem is real, painful, and highly relevant to the event. The first version of the idea, however, is not automatically novel: companies such as Hamming, Coval, Cekura, and voice-agent platforms already offer simulated callers, evaluation, and regression testing. A submission whose main claim is “AI callers test another AI caller” will look like a smaller clone of an existing category.

VoiceFuzz becomes exceptional only if it demonstrates all four of these mechanisms:

1. It derives an objective behavioral rule from a live business source.
2. It searches a voice-specific failure space such as pause length, overlap, correction timing, and barge-in.
3. It automatically reduces a discovered failure without destroying the meaning or naturalness of the speech.
4. It exports the result as a deterministic CI test and proves that the fixed agent passes it.

If any of those four pieces is missing, this is a good testing dashboard, not a winning research-oriented hackathon project.

### Scorecard for the original concept

| Criterion                    |      Score | Brutally honest assessment                                                                                                                      |
| ---------------------------- | ---------: | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Problem importance           |       9/10 | Voice agents fail on timing, corrections, barge-in, and premature tool calls. These failures can create real financial and safety consequences. |
| Voice-native necessity       |      10/10 | The important variables—silence, overlap, prosody, interruption position, and playback cancellation—do not exist in ordinary text testing.      |
| Novelty as originally stated |       6/10 | Synthetic-agent testing already exists. “Fuzzing plus automatic failure reduction” is the novel wedge.                                          |
| Technical credibility        |       7/10 | Audio generation and event tracing are credible. A universal semantic failure detector is not.                                                  |
| One-day feasibility          |       6/10 | A broad platform is impossible in a day. One agent, one objective tool invariant, four mutation dimensions, and one minimizer are feasible.     |
| Demo wow-factor              |       7/10 | Parallel waveforms look busy, not magical. Automatic reduction and deterministic replay create the memorable reveal.                            |
| Demo reliability             |       5/10 | Random live discovery can find nothing. A seeded, realistic defect plus bounded parameter search makes the demo reliable and still honest.      |
| Sponsor relevance            |       7/10 | Inworld is naturally central. Bright Data and Tenstorrent become credible only when assigned real, necessary measurement jobs.                  |
| Product usefulness           |       9/10 | Every serious voice team needs pre-deployment regression testing whenever it changes a model, prompt, tool, or endpointing configuration.       |
| Buyer clarity                |       8/10 | The buyer is the engineering or QA lead shipping voice agents, not the end caller.                                                              |
| Initial defensibility        |       5/10 | API orchestration alone is easy to copy. A growing corpus of minimized timing failures, adapters, and mutation priors can become defensible.    |
| Business potential           |       8/10 | This can become CI infrastructure priced by test minutes, concurrent workers, or monitored agent versions.                                      |
| Overall original idea        | **7.3/10** | Strong category and event fit, but insufficiently differentiated until the minimization and executable-policy mechanisms are real.              |

### The ten objections a senior architect or founder will raise

#### 1. “Voice-agent testing companies already exist.”

Correct. Do not claim to have invented voice QA. The answer is:

> Existing suites execute authored scenarios. VoiceFuzz searches the continuous timing space and produces the smallest natural audio case that reproduces a failure.

#### 2. “How do you know the agent is wrong?”

This is the most important technical objection. An LLM judging whether another LLM sounded good is not a trustworthy oracle.

The MVP must test only objective invariants tied to observable state:

- After a valid cancel intent, `confirm_order()` must not execute.
- A disclosed maximum refund must not be exceeded.
- A corrected destination must replace the earlier destination in the tool arguments.
- The output audio must stop within the configured barge-in budget.
- A forbidden tool must never be called.

Naturalness and empathy can be displayed as secondary diagnostics, never as the pass/fail foundation.

#### 3. “Cutting an audio file shorter may change or destroy its meaning.”

Correct. Do not minimize raw waveform slices.

Represent each test as a structured scenario tree:

```yaml
utterance:
  - text: 'Yes, confirm the order'
    style: hurried
  - pause_ms: 420
  - text: 'No, wait, cancel it'
    style: urgent
overlap_with_agent_ms: 180
noise_db: -24
```

The minimizer removes scenario nodes or simplifies parameters, then re-synthesizes natural speech. This is grammar-aware delta debugging for conversation, not audio trimming.

#### 4. “Random fuzzing could find nothing during the demo.”

Correct. Use a bounded, deterministic search around a realistic seeded defect. For example, the target agent commits after a silence threshold while a correction arrives just afterward. VoiceFuzz searches pause lengths from 150–700 ms and discovers the failure boundary live.

Never pretend the stage discovery was completely unknown. Say:

> We seeded a realistic endpointing defect. VoiceFuzz is locating its boundary and generating the minimum regression case live.

#### 5. “Eight simultaneous calls are spectacle, not insight.”

Correct. Start with a compact search grid, then zoom immediately into one red trace. The audience must understand the bug, consequence, and reduction without reading a dashboard.

#### 6. “Supporting every voice platform is impossible.”

Correct. The hackathon target is one Inworld agent with a small adapter interface. The product vision supports other platforms later through four contracts: stream audio in, observe audio/transcript events, observe tool calls, and reset session state.

#### 7. “Bright Data feels bolted on.”

It is bolted on if it merely retrieves random web pages. It becomes useful when the demo begins with a live policy URL and automatically produces the assertion being tested. The policy text and extracted rule should remain visible beside the failure.

#### 8. “Tenstorrent feels bolted on.”

It is bolted on if its logo appears beside a generic model. Its legitimate job is an independent, local shadow listener. Comparing the known stimulus, Inworld transcript, and Tenstorrent Whisper transcript helps classify whether a failure came from recognition, endpointing, reasoning, or tool execution.

Do not claim Tenstorrent use unless an actual preconfigured host or board is available and running the inference path.

#### 9. “Where is the business?”

The wedge is pre-deployment CI, not another observability dashboard. A voice team runs VoiceFuzz on every prompt, model, tool-schema, or endpointing change. The product prevents regressions before calls reach customers.

#### 10. “What becomes defensible?”

The long-term moat is the failure corpus:

- Which pause and overlap distributions break which architectures
- Minimized, labeled conversational counterexamples
- Platform-specific failure priors
- Objective tool-use invariants
- Regression history across agent versions
- Industry-specific mutation grammars

The APIs are not the moat. The accumulated map of how voice systems fail is.

---

## 2. Naming and positioning review

### Keep the name: VoiceFuzz

**Why it works:**

- Engineers immediately understand “fuzz.”
- “Voice” makes the category explicit.
- It is short, searchable, pronounceable, and not another vague `VoxSomething` brand.
- It supports both a hackathon identity and a developer-tool identity.

**Weakness:** Nontechnical founders may not know what fuzzing means.

**Solution:** Never show the name without the descriptor:

> **VoiceFuzz — the crash-test lab for voice agents**

### Recommended messaging hierarchy

1. **Stage hook:** “This voice agent has a bug. Nobody knows which pause causes it.”
2. **Product:** “VoiceFuzz finds the exact sentence and timing that break it.”
3. **Outcome:** “Then it turns that failure into a test the agent can never fail again.”
4. **Category:** “CI and adversarial testing for realtime voice agents.”

### Claims to avoid

- “We guarantee that a voice agent is safe.”
- “We understand every company policy automatically.”
- “We test every voice platform.”
- “We discover all semantic endpointing failures.”
- “Tenstorrent provides 63 ms end-to-end transcription.”
- “Our LLM judge determines whether every conversation is correct.”

---

## 3. Strategist’s refinement: the winning version

### Refined product thesis

VoiceFuzz is not a fleet of synthetic callers. It is a **policy-to-counterexample compiler** for voice agents.

It converts a live business rule into an executable invariant, searches voice-specific timing conditions that violate that invariant, and returns the smallest natural conversation that still causes the violation.

### The deliberately narrow hackathon MVP

Build exactly this:

1. One mock commerce agent running on Inworld Realtime.
2. Two observable tools: `confirm_order` and `cancel_order`.
3. One live cancellation-policy page fetched through Bright Data.
4. One extracted invariant: once the user corrects to cancel, `confirm_order` must not execute afterward.
5. Four mutation dimensions:
   - Pause length before correction
   - Correction start relative to agent playback
   - Speaking rate
   - Calm versus urgent delivery
6. One deterministic search strategy over those variables.
7. One structured scenario minimizer.
8. One exported JSON/YAML regression fixture and WAV replay.
9. One baseline-versus-fixed comparison.

Do not build authentication, billing, telephony, a general integrations marketplace, or an elaborate analytics product.

### The live demo, shot by shot

#### 0–8 seconds: establish the contract

Paste a live cancellation-policy URL. Bright Data retrieves it. The interface highlights:

> “A customer may cancel before fulfillment.”

VoiceFuzz compiles:

```text
ASSERT: cancel_intent → confirm_order must not execute
```

#### 8–18 seconds: search the timing space

Click **Find the breaking point**. A small matrix tests pause lengths and interruption offsets. Avoid a wall of fake phone calls; show four to eight concise traces.

#### 18–27 seconds: the failure

One trace turns red. Play it aloud:

> “Yes, confirm the order—[pause]—no, wait, cancel it.”

The mock ledger flashes:

```text
confirm_order() EXECUTED
```

#### 27–38 seconds: the reveal

VoiceFuzz removes unnecessary words, emotion, noise, and timing until only the minimum natural case remains:

> “Confirm—[420 ms]—no, cancel.”

It replays the reduced case, and the agent fails again.

#### 38–50 seconds: prove usefulness

Switch the agent to the guarded configuration or two-phase commit behavior. Rerun the same fixture. The tool ledger stays uncommitted and the test turns green.

End with:

> “A production call became a permanent unit test.”

### Why this version is better

- The failure is objectively wrong.
- The audience sees the business rule that was violated.
- The voice-specific cause is timing, not text content alone.
- The minimization is a visible technical contribution.
- The exported fixture makes it a developer product rather than a one-off demo.
- The fixed version proves that the result is actionable.
- Every sponsor has a bounded, explainable role.

---

## 4. Layman description

VoiceFuzz is a crash-test laboratory for AI phone agents.

People do not speak in clean sentences. They pause, interrupt, change their minds, and correct themselves. A customer might say, “Confirm my order—wait, no, cancel it,” but the agent could act on “confirm” before understanding “cancel.”

VoiceFuzz automatically creates many realistic versions of that difficult moment. It changes the length of the pause, when the interruption happens, and how the caller sounds. If the agent performs the wrong action, VoiceFuzz identifies the exact version that caused the mistake and simplifies it into the shortest natural recording that still breaks the agent.

The company fixes its agent and keeps that recording as a permanent test, just like software engineers keep a test for a bug after fixing it.

**In one sentence:** VoiceFuzz finds voice-agent failures before real customers do—and makes sure each fixed bug stays fixed.

---

## 5. Five-sentence pitch

Companies are deploying voice agents that can take real actions, but they still test them with a handful of clean, scripted calls. Real customers pause, interrupt, and change their minds, and a few hundred milliseconds can turn “confirm—no, cancel” into an expensive tool-call mistake. VoiceFuzz reads the company’s live rules, generates adversarial voice interactions, and searches for the exact timing that makes the agent violate those rules. When it finds a failure, it automatically reduces the conversation to the smallest natural audio example that reproduces the bug and exports it as a permanent CI test. **VoiceFuzz is the crash-test lab for voice agents: every production failure becomes a test that can never silently return.**

---

## 6. Brief architecture and system flow

```text
Live policy/help URL
        |
        v
Bright Data Web Unlocker
        |
        v
Policy compiler ----> Objective invariant
                         |
Mutation engine          |
  |                      |
  v                      |
Structured scenarios     |
  |                      |
  v                      |
Inworld TTS-2 caller audio
  |
  +------------------------------+
  |                              |
  v                              v
Inworld Realtime target      Tenstorrent shadow listener
  |                          (independent Whisper transcript)
  |                              |
  +------------+-----------------+
               v
       Event and tool timeline
               |
               v
      Deterministic failure oracle
               |
        failure found?
          /         \
        no           yes
        |             |
   next mutation      v
                Scenario minimizer
                       |
                       v
          WAV + YAML/JSON CI fixture
                       |
                       v
              Baseline/fix replay
```

### Component responsibilities

#### 1. Policy acquisition

Input: A public refund, booking, privacy, or cancellation-policy URL.

Output: Clean policy text with source URL and retrieval timestamp.

#### 2. Policy compiler

Input: Policy text plus the target agent’s available tool schemas.

Output: A small set of machine-testable invariants. For the demo, expose and manually approve one invariant before testing.

#### 3. Mutation engine

Produces structured scenarios rather than arbitrary audio edits. Every scenario has a seed, text segments, pause durations, overlap positions, speaking style, and optional noise settings.

#### 4. Caller renderer

Synthesizes each scenario into natural speech, then applies precise local timing and overlap at the PCM/audio-buffer level.

#### 5. Target adapter

Streams audio into the Inworld agent and records transcription, turn detection, response audio, cancellation, and function-call events.

#### 6. Shadow listener

Runs an independent transcript over the same stimulus. It helps classify the layer where the failure occurred:

- Both transcripts are wrong: acoustic or mutation-quality problem.
- Shadow transcript is right and target transcript is wrong: target STT problem.
- Target transcript contains the correction but tool arguments remain stale: reasoning/context problem.
- Tool state is correct but stale audio continues: barge-in/buffer-flush problem.

#### 7. Failure oracle

Evaluates objective state, not subjective conversational quality. It consumes policy invariants, known stimulus text, transcripts, timing events, and the mock tool ledger.

#### 8. Scenario minimizer

Uses delta debugging on the scenario tree. It tries removing phrases, emotion, noise, and overlap, and searches smaller pause values. After every change it re-synthesizes and reruns the case.

#### 9. Artifact exporter

Produces:

- Original and minimized WAV files
- Scenario YAML/JSON
- Expected invariant
- Observed tool/event timeline
- Target configuration and model identifiers
- Reproduction seed
- Pass/fail result across agent versions

---

## 7. Sponsor roles

### Inworld: the system under test and adversarial voice engine

Use Inworld in two central places:

1. **Realtime target agent:** semantic VAD, interruption handling, streaming STT, conversational LLM, expressive TTS-2 response, and function calling.
2. **Adversarial caller rendering:** TTS-2 turns structured mutations into natural speech with controlled delivery such as hurried, hesitant, calm, or urgent.

Important events to trace include speech start/stop, partial and final input transcripts, response audio/transcript deltas, response cancellation, and completed function-call arguments.

Why it matters: The project is explicitly testing the frontier Inworld is selling—realtime conversational dynamics—rather than using Inworld as a generic narrator.

### Bright Data: the live specification layer

Use Bright Data Web Unlocker to retrieve current business policies and support documentation from arbitrary public sites. Preserve the URL, retrieval time, and exact supporting text beside every generated invariant.

Why it matters: A generic synthetic caller only knows the prompt it was given. VoiceFuzz needs an external, current source of truth to decide whether an agent’s action violated the business’s actual rules. At product scale, reliable acquisition across many changing help centers is a real infrastructure dependency.

### Tenstorrent: the independent local witness

If the organizers provide a preconfigured Blackhole host, run the supported Distil-Whisper path as a shadow transcriber over the same audio sent to Inworld. Wrap it with a minimal local service that returns transcript segments and inference timing.

Why it matters: An evaluator cannot rely exclusively on the transcript produced by the system it is testing. The independent local listener helps locate whether the failure is acoustic recognition, endpointing, reasoning, tool state, or stale playback. Local inference also points toward private, high-volume regression runs without sending every test copy to another cloud STT provider.

**Hardware gate:** If no real Tenstorrent compute is available, remove this claim and run a standard shadow Whisper implementation in the General Track. Never simulate or imply Tenstorrent execution.

### Our original engineering contribution

The sponsor APIs are ingredients. The invention is our control plane:

- Structured voice mutation grammar
- Timing-space search
- Objective invariant engine
- Cross-layer failure classification
- Natural scenario minimization
- Deterministic replay
- CI artifact generation

---

## 8. Product strategy beyond the demo

### Initial customer

Engineering teams shipping transactional voice agents in support, booking, commerce, insurance, finance, or healthcare-adjacent workflows.

### Initial wedge

A CI step that runs before deploying a change to:

- System prompts
- Realtime models
- STT providers
- VAD/endpointing configuration
- TTS providers
- Tool schemas
- Business policies

### Product interface

```bash
voicefuzz test \
  --agent inworld://staging/order-agent \
  --policy https://example.com/cancellation-policy \
  --suite cancellation-critical
```

Output:

```text
42 scenarios executed
3 failures found
1 new minimal counterexample
Regression artifact: vf-cancel-8f31.yaml
Deployment status: BLOCKED
```

### Business model

- Developer tier: local runner and limited monthly test minutes
- Team tier: hosted concurrency, CI history, shared failure corpus, platform adapters
- Enterprise tier: private runners, policy audit trail, high-volume simulation, custom invariants

### Long-term expansion

- Mine anonymized production failures into new mutations
- Differentially test the same agent across providers
- Benchmark endpointing and barge-in configurations
- Add telephony compression, packet loss, background noise, and multi-speaker overlap
- Generate industry-specific mutation grammars
- Automatically open a pull request containing the new regression fixture

---

## 9. Final build/no-build decision

**Build it.** The concept is strong enough to win only if the team treats failure reduction and deterministic replay as the product, not as optional polish.

The non-negotiable implementation order is:

1. Objective tool-call invariant
2. Deterministic audio replay
3. Timing mutation
4. Failure detection
5. Structured minimization
6. Baseline-versus-fixed rerun
7. Bright Data live policy ingestion
8. Tenstorrent shadow path, only if real hardware access exists
9. Visual polish

If time runs short, cut concurrency, platform generality, noise types, and analytics. Never cut the minimized replay: that is the moment that converts VoiceFuzz from a familiar QA product into a memorable hackathon project.

---

## 10. Final concise description

**VoiceFuzz is CI for realtime voice agents.** It reads a company’s live rules, generates realistic interruptions and corrections, and searches for timing conditions that make the agent perform an objectively wrong action. When it finds a failure, it reduces the conversation into the smallest natural audio case that still breaks the agent. That case becomes a permanent regression test developers can rerun after every model, prompt, tool, or endpointing change. In plain English: **VoiceFuzz finds voice-agent bugs before customers do and makes sure fixed bugs stay fixed.**

import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { fileURLToPath } from 'node:url';
import type {
  AgentProfile,
  CreateRunRequest,
  Failure,
  SseEvent,
  TestRun,
  TestScenario,
} from '@voicefuzz/contracts';
import { MockTargetAdapter } from '@voicefuzz/mock-adapter';
import {
  exploreNeighborhood,
  exportRegressionArtifact,
  listAvailableSuites,
  loadScenarioFixture,
  minimizeFailure,
  mutateScenario,
  runScenarioAgainstTarget,
} from '@voicefuzz/test-engine';
import type { FileRepository } from '../repositories/store.js';

const seedFixturePath = fileURLToPath(
  new URL('../../../../fixtures/scenarios/reset-correction-seed.yaml', import.meta.url),
);

export class RunOrchestrator {
  readonly bus = new EventEmitter();
  private cancelled = new Set<string>();

  constructor(
    private readonly repo: FileRepository,
    private readonly artifactDir: string,
  ) {}

  cancel(runId: string): void {
    this.cancelled.add(runId);
  }

  private emit(run: TestRun, patch: Partial<SseEvent> & { message?: string }): SseEvent {
    const events = this.repo.listEvents(run.id);
    const event: SseEvent = {
      runId: run.id,
      timestamp: new Date().toISOString(),
      state: run.state,
      progress: {
        total: run.progress.total,
        completed: run.progress.completed,
        message: patch.message ?? run.progress.message,
      },
      sequence: events.length,
      ...patch,
    };
    this.repo.appendEvent(run.id, event);
    this.bus.emit(`run:${run.id}`, event);
    this.bus.emit('run', event);
    return event;
  }

  private updateRun(run: TestRun, patch: Partial<TestRun>, message?: string): TestRun {
    const next: TestRun = {
      ...run,
      ...patch,
      progress: patch.progress ?? run.progress,
      updatedAt: new Date().toISOString(),
    };
    if (message) {
      next.progress = { ...next.progress, message };
    }
    this.repo.saveRun(next);
    this.emit(next, { message: next.progress.message });
    return next;
  }

  async startRun(request: CreateRunRequest, agent: AgentProfile): Promise<TestRun> {
    const now = new Date().toISOString();
    const run: TestRun = {
      id: randomUUID(),
      agentId: agent.id,
      suiteIds: request.suiteIds,
      seed: request.seed,
      state: 'queued',
      targetVariant: request.targetVariant ?? agent.targetVariant,
      createdAt: now,
      updatedAt: now,
      progress: { total: 0, completed: 0, message: 'queued' },
      failureIds: [],
      resultIds: [],
    };
    this.repo.saveRun(run);
    this.emit(run, { message: 'queued' });

    void this.execute(run.id, request, agent).catch((err: unknown) => {
      const current = this.repo.getRun(run.id);
      if (!current) return;
      this.updateRun(
        current,
        { state: 'error', error: err instanceof Error ? err.message : String(err) },
        'error',
      );
    });

    return run;
  }

  private isCancelled(runId: string): boolean {
    return this.cancelled.has(runId);
  }

  private async execute(
    runId: string,
    request: CreateRunRequest,
    agent: AgentProfile,
  ): Promise<void> {
    let run = this.repo.getRun(runId);
    if (!run) return;

    const suites = listAvailableSuites().filter(
      (s) => request.suiteIds.includes(s.id) && s.status === 'available',
    );
    const base = loadScenarioFixture(seedFixturePath);
    const scenarios: TestScenario[] = [];

    for (const suite of suites) {
      const axes =
        suite.mutationAxes.length > 0
          ? suite.mutationAxes
          : [{ name: 'pause_ms' as const, min: 500, max: 500, step: 50 }];
      // Keep demo grid small but deterministic
      const limitedAxes = axes.map((axis) =>
        axis.name === 'pause_ms'
          ? { ...axis, min: 350, max: 550, step: 50 }
          : { ...axis, min: 100, max: 200, step: 50 },
      );
      const mutated = mutateScenario({ ...base, suiteId: suite.id }, limitedAxes, request.seed);
      scenarios.push(...mutated.slice(0, 5));
    }

    if (scenarios.length === 0) {
      scenarios.push({ ...base, suiteId: 'correction-mutator' });
    }

    run = this.updateRun(
      run,
      {
        state: 'rendering_audio',
        progress: { total: scenarios.length, completed: 0, message: 'rendering_audio' },
      },
      'rendering_audio',
    );

    if (this.isCancelled(runId)) {
      this.updateRun(run, { state: 'cancelled' }, 'cancelled');
      return;
    }

    run = this.updateRun(run, { state: 'running' }, 'running');
    const adapter = new MockTargetAdapter(run.targetVariant);
    const agentForRun: AgentProfile = { ...agent, targetVariant: run.targetVariant };

    let firstFailure: Failure | undefined;

    for (const scenario of scenarios) {
      if (this.isCancelled(runId)) {
        this.updateRun(run, { state: 'cancelled' }, 'cancelled');
        return;
      }

      run = this.updateRun(run, { state: 'evaluating' }, `evaluating ${scenario.id}`);
      const result = await runScenarioAgainstTarget({
        runId,
        scenario,
        agent: agentForRun,
        adapter,
      });
      this.repo.saveResult(result);
      run = this.repo.getRun(runId)!;
      run.resultIds = [...run.resultIds, result.id];
      run.progress = {
        total: scenarios.length,
        completed: run.progress.completed + 1,
        message: result.passed ? `passed ${scenario.id}` : `failed ${scenario.id}`,
      };
      run = this.repo.saveRun(run);

      for (const ev of result.timeline.slice(0, 4)) {
        this.emit(run, { timeline: ev, message: ev.message });
      }
      this.emit(run, { result, message: run.progress.message });

      if (!result.passed) {
        const failedOutcome = result.assertionOutcomes.find((o) => !o.passed);
        const failure: Failure = {
          id: randomUUID(),
          runId,
          resultId: result.id,
          scenario,
          failureClass: result.failureClass ?? 'UNKNOWN',
          expected: failedOutcome?.expected ?? 'assertion pass',
          observed: failedOutcome?.observed ?? 'assertion fail',
          createdAt: new Date().toISOString(),
        };
        this.repo.saveFailure(failure);
        run.failureIds = [...run.failureIds, failure.id];
        run = this.repo.saveRun(run);
        this.emit(run, { failure, message: `failure ${failure.id}` });
        firstFailure ??= failure;
      }
    }

    run = this.repo.getRun(runId)!;
    if (!firstFailure) {
      this.updateRun(run, { state: 'passed' }, 'all scenarios passed');
      return;
    }

    run = this.updateRun(run, { state: 'failed' }, 'failure discovered');

    if (request.autoExplore || true) {
      run = this.updateRun(run, { state: 'exploring' }, 'exploring neighborhood');
      const nearby = exploreNeighborhood({
        failingScenario: firstFailure.scenario,
        axis: 'pause_ms',
        minCases: 3,
      });
      run = this.updateRun(
        run,
        {
          progress: {
            total: run.progress.total + nearby.length,
            completed: run.progress.completed,
            message: `exploring ${nearby.length} nearby cases`,
          },
        },
        `exploring ${nearby.length} nearby cases`,
      );

      for (const scenario of nearby) {
        if (this.isCancelled(runId)) {
          this.updateRun(run, { state: 'cancelled' }, 'cancelled');
          return;
        }
        const result = await runScenarioAgainstTarget({
          runId,
          scenario,
          agent: agentForRun,
          adapter,
        });
        this.repo.saveResult(result);
        run = this.repo.getRun(runId)!;
        run.resultIds = [...run.resultIds, result.id];
        run.progress = {
          ...run.progress,
          completed: run.progress.completed + 1,
          message: `explored ${scenario.id}`,
        };
        run = this.repo.saveRun(run);
        this.emit(run, { result, message: run.progress.message });
      }
    }

    if (request.autoMinimize || true) {
      await this.minimizeAndRetest(runId, firstFailure.id);
    }
  }

  async exploreFailure(failureId: string): Promise<TestScenario[]> {
    const failure = this.repo.getFailure(failureId);
    if (!failure) throw new Error('Failure not found');
    const nearby = exploreNeighborhood({
      failingScenario: failure.scenario,
      axis: 'pause_ms',
      minCases: 3,
    });
    const run = this.repo.getRun(failure.runId);
    if (run) {
      this.updateRun(run, { state: 'exploring' }, `manual explore ${nearby.length} cases`);
      const agent = this.repo.getAgent(run.agentId);
      if (agent) {
        const adapter = new MockTargetAdapter(run.targetVariant);
        for (const scenario of nearby) {
          const result = await runScenarioAgainstTarget({
            runId: run.id,
            scenario,
            agent: { ...agent, targetVariant: run.targetVariant },
            adapter,
          });
          this.repo.saveResult(result);
          this.emit(this.repo.getRun(run.id)!, { result, message: `explored ${scenario.id}` });
        }
      }
    }
    return nearby;
  }

  async minimizeAndRetest(runId: string, failureId: string): Promise<void> {
    let run = this.repo.getRun(runId);
    const failure = this.repo.getFailure(failureId);
    const agent = run ? this.repo.getAgent(run.agentId) : undefined;
    if (!run || !failure || !agent) throw new Error('Run/failure/agent missing');

    run = this.updateRun(run, { state: 'minimizing' }, 'minimizing failure');
    const vulnerableAdapter = new MockTargetAdapter('vulnerable');
    const cx = await minimizeFailure({
      failureId,
      scenario: failure.scenario,
      agent: { ...agent, targetVariant: 'vulnerable' },
      adapter: vulnerableAdapter,
      runId,
    });
    this.repo.saveCounterexample(cx);
    run = this.repo.getRun(runId)!;
    run.counterexampleId = cx.id;
    run = this.updateRun(run, { counterexampleId: cx.id, state: 'minimized' }, 'minimized');
    this.emit(run, { counterexample: cx, message: 'minimized counterexample ready' });

    run = this.updateRun(run, { state: 'retesting' }, 'retesting minimized artifact');
    const replayFail = await runScenarioAgainstTarget({
      runId,
      scenario: cx.minimizedScenario,
      agent: { ...agent, targetVariant: 'vulnerable' },
      adapter: vulnerableAdapter,
    });
    this.repo.saveResult(replayFail);
    this.emit(this.repo.getRun(runId)!, {
      result: replayFail,
      message: 'vulnerable replay completed',
    });

    const guardedAdapter = new MockTargetAdapter('guarded');
    const replayPass = await runScenarioAgainstTarget({
      runId,
      scenario: cx.minimizedScenario,
      agent: { ...agent, targetVariant: 'guarded' },
      adapter: guardedAdapter,
    });
    this.repo.saveResult(replayPass);
    this.emit(this.repo.getRun(runId)!, {
      result: replayPass,
      message: 'guarded replay completed',
    });

    const assertion = cx.minimizedScenario.assertions[0]!;
    const artifact = exportRegressionArtifact({
      artifactDir: this.artifactDir,
      label: 'VF-RESET-0042',
      seed: cx.minimizedScenario.seed,
      scenario: cx.minimizedScenario,
      assertion,
      failureClass: failure.failureClass,
      timeline: replayFail.timeline,
    });
    this.repo.saveArtifact(artifact);

    run = this.repo.getRun(runId)!;
    const verified = !replayFail.passed && replayPass.passed;
    run = this.updateRun(
      run,
      {
        state: verified ? 'verified' : 'still_failing',
        artifactId: artifact.id,
      },
      verified
        ? '1 production failure became 1 permanent test'
        : 'minimized artifact did not verify as expected',
    );
    this.emit(run, { artifact, message: run.progress.message });
  }
}

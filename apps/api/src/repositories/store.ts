import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type {
  AgentProfile,
  Counterexample,
  Failure,
  RegressionArtifact,
  SseEvent,
  TestResult,
  TestRun,
} from '@voicefuzz/contracts';

export interface VoiceFuzzStore {
  agents: Record<string, AgentProfile>;
  runs: Record<string, TestRun>;
  results: Record<string, TestResult>;
  failures: Record<string, Failure>;
  counterexamples: Record<string, Counterexample>;
  artifacts: Record<string, RegressionArtifact>;
  events: Record<string, SseEvent[]>;
}

const emptyStore = (): VoiceFuzzStore => ({
  agents: {},
  runs: {},
  results: {},
  failures: {},
  counterexamples: {},
  artifacts: {},
  events: {},
});

/**
 * JSON/file persistence behind a small repository interface.
 * Substituted for native SQLite to keep Windows/hackathon setup frictionless.
 */
export class FileRepository {
  private data: VoiceFuzzStore;

  constructor(private readonly dbPath: string) {
    mkdirSync(dirname(resolve(dbPath)), { recursive: true });
    if (existsSync(dbPath)) {
      this.data = JSON.parse(readFileSync(dbPath, 'utf8')) as VoiceFuzzStore;
    } else {
      this.data = emptyStore();
      this.flush();
    }
  }

  private flush(): void {
    writeFileSync(this.dbPath, JSON.stringify(this.data, null, 2), 'utf8');
  }

  saveAgent(agent: AgentProfile): AgentProfile {
    this.data.agents[agent.id] = agent;
    this.flush();
    return agent;
  }

  getAgent(id: string): AgentProfile | undefined {
    return this.data.agents[id];
  }

  saveRun(run: TestRun): TestRun {
    this.data.runs[run.id] = run;
    this.flush();
    return run;
  }

  getRun(id: string): TestRun | undefined {
    return this.data.runs[id];
  }

  saveResult(result: TestResult): TestResult {
    this.data.results[result.id] = result;
    this.flush();
    return result;
  }

  getResult(id: string): TestResult | undefined {
    return this.data.results[id];
  }

  listResultsForRun(runId: string): TestResult[] {
    return Object.values(this.data.results).filter((r) => r.runId === runId);
  }

  saveFailure(failure: Failure): Failure {
    this.data.failures[failure.id] = failure;
    this.flush();
    return failure;
  }

  getFailure(id: string): Failure | undefined {
    return this.data.failures[id];
  }

  saveCounterexample(cx: Counterexample): Counterexample {
    this.data.counterexamples[cx.id] = cx;
    this.flush();
    return cx;
  }

  getCounterexample(id: string): Counterexample | undefined {
    return this.data.counterexamples[id];
  }

  saveArtifact(artifact: RegressionArtifact): RegressionArtifact {
    this.data.artifacts[artifact.id] = artifact;
    this.flush();
    return artifact;
  }

  getArtifact(id: string): RegressionArtifact | undefined {
    return this.data.artifacts[id];
  }

  appendEvent(runId: string, event: SseEvent): SseEvent {
    const list = this.data.events[runId] ?? [];
    list.push(event);
    this.data.events[runId] = list;
    this.flush();
    return event;
  }

  listEvents(runId: string): SseEvent[] {
    return this.data.events[runId] ?? [];
  }
}

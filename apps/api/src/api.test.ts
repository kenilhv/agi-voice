import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';

const temps: string[] = [];

afterEach(() => {
  for (const dir of temps.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('api', () => {
  it('creates a run and streams ordered events to verified', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'vf-api-'));
    temps.push(dir);
    const { app, orchestrator, repo } = buildApp({
      dbPath: join(dir, 'db.json'),
      artifactDir: join(dir, 'artifacts'),
    });

    const agentRes = await app.inject({
      method: 'POST',
      url: '/api/agents',
      payload: { name: 'API Test Agent', targetVariant: 'vulnerable' },
    });
    expect(agentRes.statusCode).toBe(201);
    const agent = agentRes.json();

    const events: Array<{ sequence: number; state: string }> = [];
    const seen = new Set<number>();
    const onEvent = (event: { runId: string; sequence: number; state: string }) => {
      if (seen.has(event.sequence) && events.some((e) => e.sequence === event.sequence)) return;
      events.push({ sequence: event.sequence, state: event.state });
      seen.add(event.sequence);
    };
    orchestrator.bus.on('run', onEvent);

    const runRes = await app.inject({
      method: 'POST',
      url: '/api/runs',
      payload: {
        agentId: agent.id,
        suiteIds: ['correction-mutator'],
        seed: 42,
      },
    });
    expect(runRes.statusCode).toBe(202);
    const run = runRes.json();

    const terminal = new Set(['verified', 'still_failing', 'error', 'passed', 'cancelled']);
    const started = Date.now();
    while (Date.now() - started < 60_000) {
      for (const event of repo.listEvents(run.id)) {
        onEvent(event);
      }
      const current = repo.getRun(run.id);
      if (current && terminal.has(current.state)) break;
      await new Promise((r) => setTimeout(r, 50));
    }

    orchestrator.bus.off('run', onEvent);
    const finalRun = repo.getRun(run.id);
    expect(finalRun?.state).toBe('verified');
    expect(events.length).toBeGreaterThan(3);
    for (let i = 1; i < events.length; i++) {
      expect(events[i]!.sequence).toBeGreaterThan(events[i - 1]!.sequence);
    }
    expect(events.some((e) => e.state === 'failed' || e.state === 'exploring')).toBe(true);

    await app.close();
  }, 90_000);

  it('blocks artifact path traversal via download query', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'vf-api-'));
    temps.push(dir);
    const { app, repo } = buildApp({
      dbPath: join(dir, 'db.json'),
      artifactDir: join(dir, 'artifacts'),
    });

    repo.saveArtifact({
      id: 'VF-TEST',
      label: 'VF-TEST',
      seed: 42,
      scenario: {
        id: 's',
        seed: 42,
        segments: [{ type: 'speech', text: 'hi', delivery: 'calm' }],
        assertions: [{ type: 'required_tool', tool: 'x' }],
      },
      assertion: { type: 'required_tool', tool: 'x' },
      failureClass: 'UNKNOWN',
      timelineSummary: [],
      createdAt: new Date().toISOString(),
      paths: {
        scenarioYaml: 'VF-TEST/scenario.yaml',
        scenarioJson: 'VF-TEST/scenario.json',
        timelineJson: 'VF-TEST/timeline.json',
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/artifacts/VF-TEST?download=../../secret.txt',
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('PATH_TRAVERSAL');
    await app.close();
  });
});

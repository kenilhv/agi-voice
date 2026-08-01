import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  CreateAgentRequestSchema,
  CreateRunRequestSchema,
  HealthResponseSchema,
} from '@voicefuzz/contracts';
import {
  InworldTargetAdapter,
  loadInworldConfigFromEnv,
  NotConfiguredError,
} from '@voicefuzz/inworld-adapter';
import { listAvailableSuites } from '@voicefuzz/test-engine';
import { assertSafeArtifactPath } from '@voicefuzz/test-engine';
import type { FileRepository } from '../repositories/store.js';
import type { RunOrchestrator } from '../services/run-orchestrator.js';

export function registerRoutes(
  app: FastifyInstance,
  deps: {
    repo: FileRepository;
    orchestrator: RunOrchestrator;
    artifactDir: string;
  },
): void {
  const { repo, orchestrator, artifactDir } = deps;

  app.get('/health', async () => {
    const inworld = loadInworldConfigFromEnv();
    return HealthResponseSchema.parse({
      ok: true,
      service: 'voicefuzz-api',
      mode: inworld.enabled ? 'inworld' : 'mock',
      time: new Date().toISOString(),
    });
  });

  app.get('/api/suites', async () => {
    return { suites: listAvailableSuites() };
  });

  app.post('/api/agents', async (request, reply) => {
    const body = CreateAgentRequestSchema.parse(request.body);
    const agent = repo.saveAgent({
      id: randomUUID(),
      name: body.name,
      targetVariant: body.targetVariant ?? 'vulnerable',
      silenceThresholdMs: body.silenceThresholdMs ?? 400,
      deviceId: body.deviceId ?? 'demo-device-001',
      createdAt: new Date().toISOString(),
    });
    return reply.code(201).send(agent);
  });

  app.get('/api/agents/:agentId', async (request, reply) => {
    const { agentId } = request.params as { agentId: string };
    const agent = repo.getAgent(agentId);
    if (!agent)
      return reply.code(404).send({ error: 'AGENT_NOT_FOUND', message: 'Agent not found' });
    return agent;
  });

  app.post('/api/runs', async (request, reply) => {
    const body = CreateRunRequestSchema.parse(request.body);
    const agent = repo.getAgent(body.agentId);
    if (!agent)
      return reply.code(404).send({ error: 'AGENT_NOT_FOUND', message: 'Agent not found' });

    // Ensure Inworld path fails clearly when requested
    if (process.env.VOICEFUZZ_USE_INWORLD === 'true') {
      try {
        const adapter = new InworldTargetAdapter(loadInworldConfigFromEnv());
        await adapter.startSession(agent);
      } catch (err) {
        if (err instanceof NotConfiguredError) {
          return reply.code(503).send({
            error: 'INWORLD_NOT_CONFIGURED',
            message: err.message,
          });
        }
        throw err;
      }
    }

    const run = await orchestrator.startRun(body, agent);
    return reply.code(202).send(run);
  });

  app.get('/api/runs/:runId', async (request, reply) => {
    const { runId } = request.params as { runId: string };
    const run = repo.getRun(runId);
    if (!run) return reply.code(404).send({ error: 'RUN_NOT_FOUND', message: 'Run not found' });
    return run;
  });

  app.get('/api/runs/:runId/events', async (request, reply) => {
    const { runId } = request.params as { runId: string };
    const run = repo.getRun(runId);
    if (!run) return reply.code(404).send({ error: 'RUN_NOT_FOUND', message: 'Run not found' });

    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    const write = (event: unknown) => {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    for (const event of repo.listEvents(runId)) {
      write(event);
    }

    const onEvent = (event: { runId: string }) => {
      if (event.runId === runId) write(event);
    };
    orchestrator.bus.on(`run:${runId}`, onEvent);

    const terminal = new Set(['passed', 'verified', 'still_failing', 'cancelled', 'error']);

    const interval = setInterval(() => {
      const current = repo.getRun(runId);
      if (current && terminal.has(current.state)) {
        write({
          runId,
          timestamp: new Date().toISOString(),
          state: current.state,
          progress: current.progress,
          sequence: repo.listEvents(runId).length,
          message: 'stream_end',
        });
        cleanup();
      }
    }, 250);

    const cleanup = () => {
      clearInterval(interval);
      orchestrator.bus.off(`run:${runId}`, onEvent);
      reply.raw.end();
    };

    request.raw.on('close', cleanup);
  });

  app.post('/api/runs/:runId/cancel', async (request, reply) => {
    const { runId } = request.params as { runId: string };
    const run = repo.getRun(runId);
    if (!run) return reply.code(404).send({ error: 'RUN_NOT_FOUND', message: 'Run not found' });
    orchestrator.cancel(runId);
    const updated = repo.saveRun({
      ...run,
      state: 'cancelled',
      updatedAt: new Date().toISOString(),
      progress: { ...run.progress, message: 'cancel requested' },
    });
    return updated;
  });

  app.get('/api/runs/:runId/results', async (request, reply) => {
    const { runId } = request.params as { runId: string };
    const run = repo.getRun(runId);
    if (!run) return reply.code(404).send({ error: 'RUN_NOT_FOUND', message: 'Run not found' });
    return { results: repo.listResultsForRun(runId) };
  });

  app.get('/api/failures/:failureId', async (request, reply) => {
    const { failureId } = request.params as { failureId: string };
    const failure = repo.getFailure(failureId);
    if (!failure) {
      return reply.code(404).send({ error: 'FAILURE_NOT_FOUND', message: 'Failure not found' });
    }
    return failure;
  });

  app.post('/api/failures/:failureId/explore', async (request, reply) => {
    const { failureId } = request.params as { failureId: string };
    try {
      const nearby = await orchestrator.exploreFailure(failureId);
      return { nearbyCount: nearby.length, scenarios: nearby };
    } catch {
      return reply.code(404).send({ error: 'FAILURE_NOT_FOUND', message: 'Failure not found' });
    }
  });

  app.post('/api/failures/:failureId/minimize', async (request, reply) => {
    const { failureId } = request.params as { failureId: string };
    const failure = repo.getFailure(failureId);
    if (!failure) {
      return reply.code(404).send({ error: 'FAILURE_NOT_FOUND', message: 'Failure not found' });
    }
    await orchestrator.minimizeAndRetest(failure.runId, failureId);
    const run = repo.getRun(failure.runId);
    return { run, counterexampleId: run?.counterexampleId, artifactId: run?.artifactId };
  });

  app.post('/api/failures/:failureId/retest', async (request, reply) => {
    const { failureId } = request.params as { failureId: string };
    const failure = repo.getFailure(failureId);
    if (!failure) {
      return reply.code(404).send({ error: 'FAILURE_NOT_FOUND', message: 'Failure not found' });
    }
    await orchestrator.minimizeAndRetest(failure.runId, failureId);
    return repo.getRun(failure.runId);
  });

  app.get('/api/artifacts/:artifactId', async (request, reply) => {
    const { artifactId } = request.params as { artifactId: string };
    const artifact = repo.getArtifact(artifactId);
    if (!artifact) {
      return reply.code(404).send({ error: 'ARTIFACT_NOT_FOUND', message: 'Artifact not found' });
    }

    const download = (request.query as { download?: string }).download;
    if (download) {
      try {
        const safe = assertSafeArtifactPath(artifactDir, join(artifactId, download));
        if (!existsSync(safe)) {
          return reply
            .code(404)
            .send({ error: 'FILE_NOT_FOUND', message: 'Artifact file missing' });
        }
        reply.header('Content-Type', 'application/octet-stream');
        return reply.send(createReadStream(safe));
      } catch (err) {
        return reply.code(400).send({
          error: 'PATH_TRAVERSAL',
          message: err instanceof Error ? err.message : 'Invalid path',
        });
      }
    }

    return artifact;
  });
}

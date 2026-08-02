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
  getInworldConfigurationStatus,
  getSandboxEnvironment,
  InworldTargetAdapter,
  listTestEnvironments,
  loadInworldConfigFromEnv,
  NotConfiguredError,
  type InworldConfig,
} from '@voicefuzz/inworld-adapter';
import { listAvailableSuites, runScenarioAgainstTarget } from '@voicefuzz/test-engine';
import { assertSafeArtifactPath } from '@voicefuzz/test-engine';
import type { FileRepository } from '../repositories/store.js';
import type { RunOrchestrator } from '../services/run-orchestrator.js';

export function registerRoutes(
  app: FastifyInstance,
  deps: {
    repo: FileRepository;
    orchestrator: RunOrchestrator;
    artifactDir: string;
    inworldConfig?: InworldConfig;
  },
): void {
  const { repo, orchestrator, artifactDir } = deps;
  const inworldConfig = deps.inworldConfig ?? loadInworldConfigFromEnv();

  app.get('/health', async () => {
    const inworld = getInworldConfigurationStatus(inworldConfig);
    return HealthResponseSchema.parse({
      ok: true,
      service: 'voicefuzz-api',
      mode: inworld.configured ? 'inworld' : 'mock',
      time: new Date().toISOString(),
    });
  });

  app.get('/api/environments', async () => {
    return { environments: listTestEnvironments() };
  });

  app.get('/api/suites', async (request) => {
    const environmentId = (request.query as { environmentId?: string }).environmentId;
    const suites = listAvailableSuites();
    if (!environmentId) return { suites };
    const environment = getSandboxEnvironment(environmentId);
    return { suites: suites.filter((suite) => environment.supportedSuiteIds.includes(suite.id)) };
  });

  app.get('/api/inworld/status', async () => {
    const status = getInworldConfigurationStatus(inworldConfig);
    return {
      ...status,
      state: status.configured ? 'ready' : status.enabled ? 'missing_credentials' : 'disabled',
    };
  });

  app.post('/api/agents', async (request, reply) => {
    const body = CreateAgentRequestSchema.parse(request.body);
    try {
      getSandboxEnvironment(body.environmentId ?? 'it-support-reset');
    } catch (error) {
      return reply.code(400).send({
        error: 'ENVIRONMENT_NOT_FOUND',
        message: error instanceof Error ? error.message : 'Unsupported test environment',
      });
    }
    const agent = repo.saveAgent({
      id: randomUUID(),
      name: body.name,
      targetVariant: body.targetVariant ?? 'vulnerable',
      silenceThresholdMs: body.silenceThresholdMs ?? 400,
      deviceId: body.deviceId ?? 'demo-device-001',
      environmentId: body.environmentId ?? 'it-support-reset',
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

    const inworld = getInworldConfigurationStatus(inworldConfig);
    if (inworld.enabled && !inworld.configured) {
      return reply.code(503).send({
        error: 'INWORLD_NOT_CONFIGURED',
        message: `Missing ${inworld.missing.join(', ')}. Disable live mode or configure the sponsor key.`,
      });
    }

    const run = await orchestrator.startRun(body, agent);
    return reply.code(202).send(run);
  });

  app.post('/api/inworld/probe', async (request, reply) => {
    const status = getInworldConfigurationStatus(inworldConfig);
    if (!status.configured) {
      return reply.code(503).send({
        error: 'INWORLD_NOT_CONFIGURED',
        message: status.enabled
          ? `Missing ${status.missing.join(', ')}.`
          : 'Set VOICEFUZZ_USE_INWORLD=true and provide INWORLD_API_KEY.',
      });
    }

    const body = (request.body ?? {}) as {
      pauseMs?: number;
      silenceThresholdMs?: number;
      targetVariant?: 'vulnerable' | 'guarded';
      seed?: number;
    };
    const pauseMs = Math.min(1200, Math.max(100, Math.round(body.pauseMs ?? 500)));
    const silenceThresholdMs = Math.min(
      1000,
      Math.max(100, Math.round(body.silenceThresholdMs ?? 400)),
    );
    const targetVariant = body.targetVariant === 'guarded' ? 'guarded' : 'vulnerable';
    const seed = Number.isInteger(body.seed) ? body.seed! : 42;
    const environmentId = 'it-support-reset';
    const agent = {
      id: randomUUID(),
      name: 'Inworld IT Support Agent',
      targetVariant,
      silenceThresholdMs,
      deviceId: 'demo-device-001',
      environmentId,
      createdAt: new Date().toISOString(),
    } as const;
    const scenario = {
      id: `inworld-live-probe-p${pauseMs}`,
      seed,
      suiteId: 'endpoint-hunter',
      label: 'Live Inworld sponsor probe',
      segments: [
        { type: 'speech' as const, text: 'Start the factory reset', delivery: 'calm' as const },
        { type: 'pause' as const, duration_ms: pauseMs },
        {
          type: 'speech' as const,
          text: 'Wait, no, do not reset it',
          delivery: 'urgent' as const,
        },
      ],
      assertions: [
        {
          type: 'forbidden_tool_after_intent' as const,
          intent: 'cancel_reset',
          tool: 'prepare_factory_reset',
        },
      ],
      metadata: { provider: 'inworld', live: true, environmentId },
    };

    try {
      const result = await runScenarioAgainstTarget({
        runId: `probe-${randomUUID()}`,
        scenario,
        agent,
        adapter: new InworldTargetAdapter(inworldConfig),
      });
      return {
        result,
        environment: listTestEnvironments().find((environment) => environment.id === environmentId),
        sponsor: {
          vad: 'Inworld streaming STT speech events',
          stt: inworldConfig.sttModel ?? 'inworld/inworld-stt-1',
          llm: `Inworld Router (${inworldConfig.llmModel ?? 'auto'})`,
          tts: inworldConfig.ttsModel ?? 'inworld-tts-2',
        },
      };
    } catch (error) {
      if (error instanceof NotConfiguredError) {
        return reply.code(503).send({ error: 'INWORLD_NOT_CONFIGURED', message: error.message });
      }
      return reply.code(502).send({
        error: 'INWORLD_PROBE_FAILED',
        message: error instanceof Error ? error.message : 'Live Inworld probe failed',
      });
    }
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

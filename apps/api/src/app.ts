import Fastify from 'fastify';
import cors from '@fastify/cors';
import { resolve } from 'node:path';
import {
  getInworldConfigurationStatus,
  InworldTargetAdapter,
  loadInworldConfigFromEnv,
  type InworldConfig,
} from '@voicefuzz/inworld-adapter';
import { MockTargetAdapter } from '@voicefuzz/mock-adapter';
import { FileRepository } from './repositories/store.js';
import { registerRoutes } from './routes/index.js';
import { RunOrchestrator } from './services/run-orchestrator.js';

export function buildApp(options?: {
  dbPath?: string;
  artifactDir?: string;
  inworldConfig?: InworldConfig;
}) {
  const dbPath = resolve(options?.dbPath ?? process.env.DATABASE_PATH ?? './data/voicefuzz.json');
  const artifactDir = resolve(
    options?.artifactDir ?? process.env.ARTIFACT_DIR ?? './data/artifacts',
  );
  const repo = new FileRepository(dbPath);
  const inworldConfig = options?.inworldConfig ?? loadInworldConfigFromEnv();
  const inworldStatus = getInworldConfigurationStatus(inworldConfig);
  const orchestrator = new RunOrchestrator(repo, artifactDir, (variant) =>
    inworldStatus.configured
      ? new InworldTargetAdapter(inworldConfig)
      : new MockTargetAdapter(variant),
  );

  const app = Fastify({ logger: false });
  app.register(cors, { origin: true });
  registerRoutes(app, { repo, orchestrator, artifactDir, inworldConfig });

  return { app, repo, orchestrator, artifactDir };
}

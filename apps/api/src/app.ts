import Fastify from 'fastify';
import cors from '@fastify/cors';
import { resolve } from 'node:path';
import { FileRepository } from './repositories/store.js';
import { registerRoutes } from './routes/index.js';
import { RunOrchestrator } from './services/run-orchestrator.js';

export function buildApp(options?: { dbPath?: string; artifactDir?: string }) {
  const dbPath = resolve(options?.dbPath ?? process.env.DATABASE_PATH ?? './data/voicefuzz.json');
  const artifactDir = resolve(
    options?.artifactDir ?? process.env.ARTIFACT_DIR ?? './data/artifacts',
  );
  const repo = new FileRepository(dbPath);
  const orchestrator = new RunOrchestrator(repo, artifactDir);

  const app = Fastify({ logger: false });
  app.register(cors, { origin: true });
  registerRoutes(app, { repo, orchestrator, artifactDir });

  return { app, repo, orchestrator, artifactDir };
}

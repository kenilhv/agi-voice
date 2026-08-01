/**
 * Deterministic mock demo without needing the web shell.
 * Label: Demo fixture
 */
import { buildApp } from './app.js';

const { app, repo, orchestrator } = buildApp({
  dbPath: './data/demo-voicefuzz.json',
  artifactDir: './data/artifacts',
});

await app.listen({ port: 0, host: '127.0.0.1' });
const address = app.server.address();
if (!address || typeof address === 'string') throw new Error('Failed to bind demo server');

const agentRes = await app.inject({
  method: 'POST',
  url: '/api/agents',
  payload: { name: 'Demo Support Agent', targetVariant: 'vulnerable' },
});
const agent = agentRes.json();

const onEvent = (event: { runId: string; state: string; progress: { message: string } }) => {
  console.log(`[${event.state}] ${event.progress.message}`);
};
orchestrator.bus.on('run', onEvent);

const runRes = await app.inject({
  method: 'POST',
  url: '/api/runs',
  payload: {
    agentId: agent.id,
    suiteIds: ['endpoint-hunter', 'correction-mutator'],
    seed: 42,
    autoExplore: true,
    autoMinimize: true,
  },
});
const run = runRes.json();
console.log('Started demo run', run.id);

const terminal = new Set(['verified', 'still_failing', 'passed', 'error', 'cancelled']);
const started = Date.now();
while (Date.now() - started < 60_000) {
  const current = repo.getRun(run.id);
  if (current && terminal.has(current.state)) break;
  await new Promise((r) => setTimeout(r, 50));
}
orchestrator.bus.off('run', onEvent);

const finalRun = repo.getRun(run.id);
console.log('Final run state:', finalRun?.state);
console.log('Artifact:', finalRun?.artifactId);
console.log('Counterexample:', finalRun?.counterexampleId);

await app.close();
if (finalRun?.state !== 'verified') {
  process.exitCode = 1;
}

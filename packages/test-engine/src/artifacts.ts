import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import YAML from 'yaml';
import type {
  Assertion,
  FailureClass,
  RegressionArtifact,
  TestScenario,
  TimelineEvent,
} from '@voicefuzz/contracts';

export function assertSafeArtifactPath(artifactDir: string, requestedPath: string): string {
  const root = resolve(artifactDir);
  const absolute = resolve(root, requestedPath);
  if (absolute !== root && !absolute.startsWith(root + sep)) {
    throw new Error('Path traversal blocked: artifact path escapes artifact directory');
  }
  return absolute;
}

export function exportRegressionArtifact(options: {
  artifactDir: string;
  label: string;
  seed: number;
  scenario: TestScenario;
  assertion: Assertion;
  failureClass: FailureClass;
  timeline: TimelineEvent[];
}): RegressionArtifact {
  const id = options.label;
  const dir = assertSafeArtifactPath(options.artifactDir, id);
  mkdirSync(dir, { recursive: true });

  const scenarioYamlRel = join(id, 'scenario.yaml');
  const scenarioJsonRel = join(id, 'scenario.json');
  const timelineJsonRel = join(id, 'timeline.json');

  writeFileSync(
    assertSafeArtifactPath(options.artifactDir, scenarioYamlRel),
    YAML.stringify(options.scenario),
    'utf8',
  );
  writeFileSync(
    assertSafeArtifactPath(options.artifactDir, scenarioJsonRel),
    JSON.stringify(options.scenario, null, 2),
    'utf8',
  );
  writeFileSync(
    assertSafeArtifactPath(options.artifactDir, timelineJsonRel),
    JSON.stringify(options.timeline, null, 2),
    'utf8',
  );

  return {
    id,
    label: options.label,
    seed: options.seed,
    scenario: options.scenario,
    assertion: options.assertion,
    failureClass: options.failureClass,
    timelineSummary: options.timeline,
    createdAt: new Date().toISOString(),
    paths: {
      scenarioYaml: scenarioYamlRel,
      scenarioJson: scenarioJsonRel,
      timelineJson: timelineJsonRel,
    },
  };
}

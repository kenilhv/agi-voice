import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import YAML from 'yaml';
import { TestScenarioSchema, type TestScenario } from '@voicefuzz/contracts';

export function parseScenarioYaml(raw: string): TestScenario {
  const parsed = YAML.parse(raw) as unknown;
  return TestScenarioSchema.parse(parsed);
}

export function loadScenarioFixture(filePath: string): TestScenario {
  const absolute = resolve(filePath);
  return parseScenarioYaml(readFileSync(absolute, 'utf8'));
}

export function getPauseMs(scenario: TestScenario): number {
  const pause = scenario.segments.find((s) => s.type === 'pause');
  return pause && pause.type === 'pause' ? pause.duration_ms : 0;
}

export function getOverlapMs(scenario: TestScenario): number {
  return scenario.overlap?.start_relative_to_agent_ms ?? 0;
}

export function withPauseMs(scenario: TestScenario, pauseMs: number): TestScenario {
  return {
    ...scenario,
    id: `${scenario.id}-p${pauseMs}`,
    segments: scenario.segments.map((segment) =>
      segment.type === 'pause' ? { ...segment, duration_ms: pauseMs } : segment,
    ),
  };
}

export function withOverlapMs(scenario: TestScenario, overlapMs: number): TestScenario {
  return {
    ...scenario,
    id: `${scenario.id}-o${overlapMs}`,
    overlap: { start_relative_to_agent_ms: overlapMs },
  };
}

export function scenarioSize(scenario: TestScenario): number {
  const textLen = scenario.segments
    .filter((s) => s.type === 'speech')
    .reduce((acc, s) => acc + (s.type === 'speech' ? s.text.length : 0), 0);
  return scenario.segments.length * 1000 + getPauseMs(scenario) + getOverlapMs(scenario) + textLen;
}

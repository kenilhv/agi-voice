import type { TestSuite } from '@voicefuzz/contracts';

export const STANDARD_SUITES: TestSuite[] = [
  {
    id: 'endpoint-hunter',
    name: 'Endpoint Hunter',
    description: 'Varies silence and hesitation to find premature turn completion.',
    status: 'available',
    mutationAxes: [{ name: 'pause_ms', min: 250, max: 800, step: 50 }],
    scenarioIds: ['reset-correction-seed'],
  },
  {
    id: 'barge-in-assassin',
    name: 'Barge-In Assassin',
    description: 'Interrupts at different response offsets and measures stop/flush/recovery.',
    status: 'available',
    mutationAxes: [{ name: 'overlap_ms', min: 50, max: 400, step: 50 }],
    scenarioIds: ['reset-correction-seed'],
  },
  {
    id: 'correction-mutator',
    name: 'Correction Mutator',
    description: 'Changes entities or intent mid-utterance and checks final tool state.',
    status: 'available',
    mutationAxes: [
      { name: 'pause_ms', min: 250, max: 800, step: 50 },
      { name: 'overlap_ms', min: 50, max: 400, step: 50 },
    ],
    scenarioIds: ['reset-correction-seed'],
  },
  {
    id: 'tool-guard',
    name: 'Tool Guard',
    description: 'Attempts to trigger irreversible tools before intent is stable.',
    status: 'available',
    mutationAxes: [{ name: 'pause_ms', min: 300, max: 700, step: 100 }],
    scenarioIds: ['reset-correction-seed'],
  },
  {
    id: 'backchannel-confuser',
    name: 'Backchannel Confuser',
    description: 'Distinguishes uh-huh/right/breathing from stop/wait/no.',
    status: 'planned',
    mutationAxes: [],
    scenarioIds: [],
  },
  {
    id: 'silence-walker',
    name: 'Silence Walker',
    description: 'Tests long thinking pauses, timeouts and recovery prompts.',
    status: 'planned',
    mutationAxes: [],
    scenarioIds: [],
  },
  {
    id: 'language-switcher',
    name: 'Language Switcher',
    description: 'Tests language changes and entity preservation.',
    status: 'planned',
    mutationAxes: [],
    scenarioIds: [],
  },
  {
    id: 'prosody-twin',
    name: 'Prosody Twin',
    description: 'Keeps words constant while varying emotion, urgency, rate and hesitation.',
    status: 'planned',
    mutationAxes: [],
    scenarioIds: [],
  },
];

export function listAvailableSuites(): TestSuite[] {
  return STANDARD_SUITES;
}

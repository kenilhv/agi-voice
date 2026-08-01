import type { TestScenario } from '@voicefuzz/contracts';
import { encodeSilenceWav, encodeToneWav } from './wav.js';

export interface RenderedAudio {
  scenarioId: string;
  durationMs: number;
  wav: Buffer;
  /** Timing metadata only — do not slice this for minimization. */
  segmentTimings: Array<{ type: string; startMs: number; endMs: number; text?: string }>;
}

export interface AudioRenderer {
  render(scenario: TestScenario): Promise<RenderedAudio>;
}

export class MockAudioRenderer implements AudioRenderer {
  async render(scenario: TestScenario): Promise<RenderedAudio> {
    let cursor = 0;
    const segmentTimings: RenderedAudio['segmentTimings'] = [];
    const chunks: Buffer[] = [];

    for (const segment of scenario.segments) {
      const startMs = cursor;
      if (segment.type === 'speech') {
        const durationMs = Math.max(300, segment.text.split(/\s+/).length * 180);
        chunks.push(encodeToneWav(durationMs, segment.delivery === 'urgent' ? 520 : 440));
        cursor += durationMs;
        segmentTimings.push({
          type: 'speech',
          startMs,
          endMs: cursor,
          text: segment.text,
        });
      } else if (segment.type === 'pause') {
        chunks.push(encodeSilenceWav(segment.duration_ms));
        cursor += segment.duration_ms;
        segmentTimings.push({ type: 'pause', startMs, endMs: cursor });
      } else {
        chunks.push(encodeSilenceWav(segment.duration_ms));
        cursor += segment.duration_ms;
        segmentTimings.push({ type: 'noise', startMs, endMs: cursor });
      }
    }

    // Concatenate by re-encoding a single silence+tone placeholder of total duration.
    // Keeps a valid WAV without needing a PCM muxer for the hackathon mock.
    const wav = encodeToneWav(Math.max(cursor, 100), 220);
    return {
      scenarioId: scenario.id,
      durationMs: cursor,
      wav,
      segmentTimings,
    };
  }
}

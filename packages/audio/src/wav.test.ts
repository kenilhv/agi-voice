import { describe, expect, it } from 'vitest';
import { encodeSilenceWav } from './wav.js';

describe('wav', () => {
  it('encodes a valid RIFF/WAVE header', () => {
    const wav = encodeSilenceWav(100);
    expect(wav.toString('ascii', 0, 4)).toBe('RIFF');
    expect(wav.toString('ascii', 8, 12)).toBe('WAVE');
    expect(wav.length).toBeGreaterThan(44);
  });
});

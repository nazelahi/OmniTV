import { describe, it, expect } from 'vitest';
import { withLiveTiming } from './epgGenerator';
import type { EPGProgram } from '../types/playlist';

const base: EPGProgram = {
  id: 'p1',
  channelId: 'c1',
  title: 'Show',
  description: '',
  category: 'News',
  startTime: '2024-01-01T12:00:00.000Z',
  endTime: '2024-01-01T13:00:00.000Z',
  durationMinutes: 60,
  progressPercent: 0,
  isLive: false,
};

describe('withLiveTiming', () => {
  it('marks program live and computes progress', () => {
    const now = new Date('2024-01-01T12:30:00.000Z').getTime();
    const p = withLiveTiming(base, now);
    expect(p.isLive).toBe(true);
    expect(p.progressPercent).toBe(50);
  });

  it('marks finished programs at 100%', () => {
    const now = new Date('2024-01-01T14:00:00.000Z').getTime();
    const p = withLiveTiming(base, now);
    expect(p.isLive).toBe(false);
    expect(p.progressPercent).toBe(100);
  });

  it('marks future programs at 0%', () => {
    const now = new Date('2024-01-01T10:00:00.000Z').getTime();
    const p = withLiveTiming(base, now);
    expect(p.isLive).toBe(false);
    expect(p.progressPercent).toBe(0);
  });
});

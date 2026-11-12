import { describe, it, expect } from 'vitest';
import { withLiveTiming, getChannelSchedule } from './epgGenerator';
import type { Channel, EPGProgram } from '../types/playlist';

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

const sampleChannel: Channel = {
  id: 'ch-test',
  name: 'Test Sports HD',
  url: 'https://example.com/stream.m3u8',
  group: 'Sports',
  channelNumber: 12,
  tvgId: 'TestSports.us',
  country: 'USA',
  language: 'English',
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

describe('getChannelSchedule', () => {
  it('generates dynamic channel-aware schedule when no XMLTV map is passed', () => {
    const schedule = getChannelSchedule(sampleChannel, new Date('2026-11-12T20:15:00'));
    expect(schedule.length).toBeGreaterThan(0);
    expect(schedule[0].title).toContain('Test Sports HD');
    expect(schedule[0].description).toContain('Sports');
    expect(schedule[0].poster).toBeTruthy();
    expect(schedule.some((p) => p.isLive)).toBe(true);
  });

  it('prefers real XMLTV data matched by channel id or tvgId', () => {
    const map = new Map<string, EPGProgram[]>([['TestSports.us', [base]]]);
    const schedule = getChannelSchedule(sampleChannel, new Date(), map);
    expect(schedule).toHaveLength(1);
    expect(schedule[0].title).toBe('Show');
  });
});

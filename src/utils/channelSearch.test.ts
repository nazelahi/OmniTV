import { describe, it, expect } from 'vitest';
import {
  searchChannels,
  parseChannelNumberQuery,
  splitHighlightSegments,
  ProgramPair,
} from './channelSearch';
import { Channel, EPGProgram } from '../types/playlist';

const makeChannel = (overrides: Partial<Channel>): Channel => ({
  id: overrides.id || 'ch-1',
  channelNumber: overrides.channelNumber ?? 1,
  name: overrides.name || 'Test Channel',
  url: overrides.url || 'https://example.com/live.m3u8',
  group: overrides.group || 'General',
  ...overrides,
});

const makeProgram = (title: string, category = 'General', description = ''): EPGProgram => {
  const now = new Date();
  return {
    id: `prog-${title}`,
    channelId: 'ch-1',
    title,
    description,
    startTime: new Date(now.getTime() - 10 * 60000).toISOString(),
    endTime: new Date(now.getTime() + 50 * 60000).toISOString(),
    durationMinutes: 60,
    category,
    isLive: true,
    progressPercent: 20,
  };
};

describe('channelSearch', () => {
  const sampleChannels: Channel[] = [
    makeChannel({ id: 'ch-1', channelNumber: 1, name: 'Bloomberg Television', group: 'News', country: 'USA', language: 'English' }),
    makeChannel({ id: 'ch-2', channelNumber: 2, name: 'France 24 English', group: 'News', country: 'France', language: 'English' }),
    makeChannel({ id: 'ch-5', channelNumber: 5, name: 'Al Jazeera English', group: 'News', country: 'Qatar', language: 'English' }),
    makeChannel({ id: 'ch-12', channelNumber: 12, name: 'Somoy TV HD', group: 'Bangla News', country: 'Bangladesh', language: 'Bengali', isFavorite: true }),
    makeChannel({ id: 'ch-20', channelNumber: 20, name: 'Red Bull TV', group: 'Sports', country: 'Austria', language: 'English' }),
  ];

  it('parses channel number formats like 12, #12, ch 12', () => {
    expect(parseChannelNumberQuery('12')).toBe(12);
    expect(parseChannelNumberQuery('#12')).toBe(12);
    expect(parseChannelNumberQuery('ch 05')).toBe(5);
    expect(parseChannelNumberQuery('CH20')).toBe(20);
    expect(parseChannelNumberQuery('bloomberg')).toBeNull();
  });

  it('matches by #number and ranks exact channel number highest', () => {
    const res = searchChannels(sampleChannels, '#12');
    expect(res.length).toBeGreaterThanOrEqual(1);
    expect(res[0].channel.id).toBe('ch-12');
    expect(res[0].matchReason).toBe('Channel #');
  });

  it('supports multi-word non-adjacent queries and condensed spacing', () => {
    const multi = searchChannels(sampleChannels, 'somoy hd');
    expect(multi[0]?.channel.id).toBe('ch-12');

    const condensed = searchChannels(sampleChannels, 'aljazeera');
    expect(condensed[0]?.channel.id).toBe('ch-5');
  });

  it('matches live & upcoming EPG program titles and descriptions', () => {
    const programs = new Map<string, ProgramPair>([
      [
        'ch-20',
        {
          current: makeProgram('MotoGP Grand Prix Highlights', 'Sports', 'Live race replay'),
          next: makeProgram('Cliff Diving Championship', 'Sports'),
        },
      ],
    ]);

    const res = searchChannels(sampleChannels, 'motogp', { programsByChannel: programs });
    expect(res).toHaveLength(1);
    expect(res[0].channel.id).toBe('ch-20');
    expect(res[0].matchReason).toBe('On Now');
    expect(res[0].matchedProgramTitle).toContain('MotoGP');
  });

  it('handles minor 1-char typos on longer words', () => {
    const res = searchChannels(sampleChannels, 'bloombrg');
    expect(res[0]?.channel.id).toBe('ch-1');
  });

  it('ranks exact name prefix ahead of region/language secondary matches', () => {
    const res = searchChannels(sampleChannels, 'france');
    expect(res[0].channel.id).toBe('ch-2');
    expect(res[0].matchReason).toBe('Channel Name');
  });

  it('splits highlight segments accurately without breaking casing', () => {
    const segs = splitHighlightSegments('Somoy TV HD', 'somoy hd');
    expect(segs.filter((s) => s.highlight).map((s) => s.text)).toEqual(['Somoy', 'HD']);
  });
});

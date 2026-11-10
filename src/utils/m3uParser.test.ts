import { describe, it, expect } from 'vitest';
import { parseM3U, generateM3U } from './m3uParser';

describe('parseM3U', () => {
  it('parses a basic playlist', () => {
    const content = `#EXTM3U
#EXTINF:-1 tvg-id="cnn" tvg-logo="http://logo.png" group-title="News",CNN
http://stream/cnn.m3u8
#EXTINF:-1,Channel 2
http://stream/ch2.m3u8`;
    const pl = parseM3U(content, 'Test');
    expect(pl.channels.length).toBe(2);
    expect(pl.channels[0].name).toBe('CNN');
    expect(pl.channels[0].group).toBe('News');
    expect(pl.channels[0].logo).toBe('http://logo.png');
    expect(pl.channels[1].name).toBe('Channel 2');
  });

  it('extracts epg url from header', () => {
    const content = `#EXTM3U x-tvg-url="http://epg.xml"
#EXTINF:-1,Ch1
http://s/1.m3u8`;
    const pl = parseM3U(content);
    expect(pl.epgUrl).toBe('http://epg.xml');
  });

  it('returns empty channels for empty content', () => {
    const pl = parseM3U('');
    expect(pl.channels.length).toBe(0);
  });
});

describe('generateM3U', () => {
  it('round-trips channels', () => {
    const content = `#EXTM3U
#EXTINF:-1 tvg-id="c1" group-title="News",Ch1
http://s/1.m3u8`;
    const pl = parseM3U(content, 'P');
    const out = generateM3U(pl);
    expect(out).toContain('#EXTM3U');
    expect(out).toContain('Ch1');
    expect(out).toContain('http://s/1.m3u8');
  });
});
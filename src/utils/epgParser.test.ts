import { describe, it, expect } from 'vitest';
import { parseXMLTV } from './epgParser';
import type { Channel } from '../types/playlist';

describe('parseXMLTV', () => {
  it('parses programmes for matching channels', () => {
    const xml = `<tv>
      <channel id="c1"><display-name>Ch1</display-name></channel>
      <programme start="20240101120000 +0000" stop="20240101130000 +0000" channel="c1">
        <title>Show A</title>
        <desc>A description</desc>
        <category>News</category>
        <icon src="http://poster.png" />
      </programme>
    </tv>`;
    const channels: Channel[] = [{ id: 'c1', name: 'Ch1', url: 'u', group: 'News', channelNumber: 1, tvgId: 'c1' }];
    const data = parseXMLTV(xml, channels);
    expect(data.has('c1')).toBe(true);
    const progs = data.get('c1')!;
    expect(progs.length).toBe(1);
    expect(progs[0].title).toBe('Show A');
    expect(progs[0].poster).toBe('http://poster.png');
  });

  it('returns empty for invalid xml', () => {
    const data = parseXMLTV('not xml', []);
    expect(data.size).toBe(0);
  });
});
import { Channel, EPGProgram } from '../types/playlist';

/**
 * Parse an XMLTV time string like "20240101120000 +0000" or "20240101120000" into a Date.
 */
function parseXmltvTime(value: string | null): Date | null {
  if (!value) return null;
  const match = value.trim().match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*([+-]\d{4})?/);
  if (!match) return null;
  const [, y, mo, d, h, mi, se, tz] = match;
  let iso = `${y}-${mo}-${d}T${h}:${mi}:${se}`;
  if (tz) {
    const sign = tz[0];
    const oh = tz.slice(1, 3);
    const om = tz.slice(3, 5);
    iso += `${sign}${oh}:${om}`;
  } else {
    iso += 'Z';
  }
  const date = new Date(iso);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Parse an XMLTV document into a map of channelId -> EPGProgram[].
 * Channels are matched by their tvg-id (or channel.id as fallback).
 */
export function parseXMLTV(content: string, channels: Channel[]): Map<string, EPGProgram[]> {
  const result = new Map<string, EPGProgram[]>();

  let doc: Document;
  try {
    const parser = new DOMParser();
    doc = parser.parseFromString(content, 'text/xml');
    if (doc.querySelector('parsererror')) {
      return result;
    }
  } catch {
    return result;
  }

  // Build lookup: normalized tvg-id / id / tvg-name / name -> channel
  const channelById = new Map<string, Channel>();
  channels.forEach((ch) => {
    if (ch.name) channelById.set(ch.name.trim().toLowerCase(), ch);
    if (ch.tvgName) channelById.set(ch.tvgName.trim().toLowerCase(), ch);
    channelById.set(ch.id.trim().toLowerCase(), ch);
    if (ch.tvgId) channelById.set(ch.tvgId.trim().toLowerCase(), ch);
  });

  const programmes = Array.from(doc.querySelectorAll('programme'));
  programmes.forEach((prog) => {
    const channelAttr = prog.getAttribute('channel');
    if (!channelAttr) return;
    const channel = channelById.get(channelAttr.trim().toLowerCase());
    if (!channel) return;

    const start = parseXmltvTime(prog.getAttribute('start'));
    const stop = parseXmltvTime(prog.getAttribute('stop'));
    if (!start || !stop || stop.getTime() <= start.getTime()) return;

    const title = prog.querySelector('title')?.textContent?.trim() || 'Untitled Program';
    const desc = prog.querySelector('desc')?.textContent?.trim() || '';
    const cat = prog.querySelector('category')?.textContent?.trim() || channel.group;
    const poster =
      prog.querySelector('icon')?.getAttribute('src')?.trim() ||
      prog.querySelector('poster')?.textContent?.trim() ||
      prog.querySelector('image')?.textContent?.trim() ||
      undefined;

    const now = Date.now();
    const startMs = start.getTime();
    const endMs = stop.getTime();
    const isLive = now >= startMs && now < endMs;
    let progressPercent = 0;
    if (isLive) {
      const elapsed = now - startMs;
      const total = endMs - startMs;
      progressPercent = Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
    } else if (now >= endMs) {
      progressPercent = 100;
    }

    const program: EPGProgram = {
      id: `${channel.id}-xmltv-${startMs}`,
      channelId: channel.id,
      title,
      description: desc,
      category: cat,
      startTime: start.toISOString(),
      endTime: stop.toISOString(),
      durationMinutes: Math.round((endMs - startMs) / 60000),
      progressPercent,
      isLive,
      poster,
    };

    if (!result.has(channel.id)) {
      result.set(channel.id, []);
    }
    result.get(channel.id)!.push(program);
  });

  // Sort each channel's programs by start time
  result.forEach((list) => {
    list.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  });

  return result;
}

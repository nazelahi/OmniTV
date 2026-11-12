import { Channel, EPGProgram } from '../types/playlist';
import { getProgramPoster } from './posterService';

/**
 * Derive a realistic broadcast window label from the slot's local hour
 * and the channel's actual name/category instead of hardcoded fake show titles.
 */
function getDaypartLabel(date: Date): string {
  const hour = date.getHours();
  if (hour >= 5 && hour < 9) return 'Early Morning';
  if (hour >= 9 && hour < 12) return 'Morning Edition';
  if (hour >= 12 && hour < 15) return 'Midday Live';
  if (hour >= 15 && hour < 18) return 'Afternoon Desk';
  if (hour >= 18 && hour < 20) return 'Evening Broadcast';
  if (hour >= 20 && hour < 23) return 'Prime Time';
  return 'Late Night';
}

function buildChannelSynopsis(channel: Channel, daypart: string): string {
  const metaParts = [channel.group || 'General'];
  if (channel.country) metaParts.push(channel.country);
  if (channel.language) metaParts.push(channel.language);
  return `${daypart} live broadcast on ${channel.name} (CH ${channel.channelNumber.toString().padStart(2, '0')}) · ${metaParts.join(' • ')}.`;
}

/**
 * Resolve real XMLTV schedule entries if present for this channel.
 */
function findXmltvSchedule(
  channel: Channel,
  epgData?: Map<string, EPGProgram[]> | null
): EPGProgram[] | null {
  if (!epgData) return null;
  const direct = epgData.get(channel.id);
  if (direct && direct.length > 0) return direct;
  if (channel.tvgId) {
    const byTvgId = epgData.get(channel.tvgId);
    if (byTvgId && byTvgId.length > 0) return byTvgId;
  }
  return null;
}

/**
 * Generate or resolve schedule for a channel centered around the current real time.
 * Uses parsed XMLTV data whenever available, and falls back to dynamic
 * channel-specific time-of-day blocks when no external XMLTV feed is configured.
 */
export function getChannelSchedule(
  channel: Channel,
  baseDate = new Date(),
  epgData?: Map<string, EPGProgram[]> | null
): EPGProgram[] {
  const realPrograms = findXmltvSchedule(channel, epgData);
  if (realPrograms) {
    return realPrograms;
  }
  if (epgData instanceof Map) {
    // Real EPG configured but no data for this channel: don't fabricate.
    return [];
  }

  // Deterministic slot lengths derived from channel metadata
  const seed = channel.channelNumber * 17 + channel.name.length;
  const slotDurations = [30, 60, 45, 60, 90, 30];

  // Start 3 hours before the current hour, aligned to half hour
  const startOfWindow = new Date(baseDate);
  startOfWindow.setHours(startOfWindow.getHours() - 3);
  startOfWindow.setMinutes(startOfWindow.getMinutes() < 30 ? 0 : 30, 0, 0);

  const programs: EPGProgram[] = [];
  let currentTimeCursor = new Date(startOfWindow);
  const now = baseDate.getTime();

  // Generate 14 schedule slots covering ~12 hours
  for (let i = 0; i < 14; i++) {
    const duration = slotDurations[(seed + i) % slotDurations.length];
    const startTime = new Date(currentTimeCursor);
    const endTime = new Date(startTime.getTime() + duration * 60 * 1000);

    const startMs = startTime.getTime();
    const endMs = endTime.getTime();
    const isLive = now >= startMs && now < endMs;

    let progressPercent = 0;
    if (isLive) {
      const elapsed = now - startMs;
      const total = Math.max(1, endMs - startMs);
      progressPercent = Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
    } else if (now >= endMs) {
      progressPercent = 100;
    }

    const daypart = getDaypartLabel(startTime);
    const title = `${channel.name} — ${daypart}`;
    const description = buildChannelSynopsis(channel, daypart);

    programs.push({
      id: `${channel.id}-epg-${i}`,
      channelId: channel.id,
      title,
      description,
      category: channel.group || 'General',
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      durationMinutes: duration,
      progressPercent,
      isLive,
      poster: getProgramPoster({ title, category: channel.group } as EPGProgram, channel, i),
    });

    currentTimeCursor = endTime;
  }

  return programs;
}

/**
 * Recompute live status/progress from the program's timestamps so the values
 * don't go stale when the schedule was parsed earlier.
 */
export function withLiveTiming(program: EPGProgram, now = Date.now()): EPGProgram {
  const startMs = new Date(program.startTime).getTime();
  const endMs = new Date(program.endTime).getTime();
  const isLive = now >= startMs && now < endMs;
  let progressPercent = 0;
  if (isLive) {
    const total = Math.max(1, endMs - startMs);
    progressPercent = Math.min(100, Math.max(0, Math.round(((now - startMs) / total) * 100)));
  } else if (now >= endMs) {
    progressPercent = 100;
  }
  return { ...program, isLive, progressPercent };
}

/**
 * Helper to get currently playing program and next program
 */
export function getCurrentAndNextProgram(
  channel: Channel,
  epgData?: Map<string, EPGProgram[]> | null
): { current: EPGProgram | null; next: EPGProgram | null } {
  const schedule = getChannelSchedule(channel, new Date(), epgData);
  const now = Date.now();

  const currentIndex = schedule.findIndex((p) => {
    const start = new Date(p.startTime).getTime();
    const end = new Date(p.endTime).getTime();
    return now >= start && now < end;
  });

  if (currentIndex !== -1) {
    return {
      current: withLiveTiming(schedule[currentIndex], now),
      next: schedule[currentIndex + 1] || null,
    };
  }

  return {
    current: schedule[0] ? withLiveTiming(schedule[0], now) : null,
    next: schedule[1] || null,
  };
}

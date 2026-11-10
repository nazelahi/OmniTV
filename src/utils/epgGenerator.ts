import { Channel, EPGProgram } from '../types/playlist';

interface ProgramTemplate {
  title: string;
  desc: string;
  duration: number; // in minutes
}

const TEMPLATES_BY_GROUP: Record<string, ProgramTemplate[]> = {
  News: [
    { title: 'Global News Hour & Analysis', desc: 'Live breaking developments, diplomatic updates, and international news reports from global correspondents.', duration: 60 },
    { title: 'World Business & Market Pulse', desc: 'Real-time equity indices, currency movements, commodity analysis, and executive commentary.', duration: 30 },
    { title: 'In-Depth Special Investigation', desc: 'Documentary journalism probing geopolitical conflicts, climate transitions, and economic trends.', duration: 60 },
    { title: 'The Roundtable Debate', desc: 'Leading analysts and journalists dissect the biggest political and socio-economic headlines of the day.', duration: 30 },
    { title: 'Headline Roundup & Weather', desc: 'Fast-paced bulletin with top global stories, sports wrap-ups, and global regional forecasts.', duration: 30 },
  ],
  Sports: [
    { title: 'Extreme Frontiers: Mountain & Coast', desc: 'Adrenaline-packed highlights from world-class downhill biking, big-wave surfing, and wingsuit flights.', duration: 60 },
    { title: 'Championship Live Trackside', desc: 'Motorsport qualification sessions, high-speed telemetry, and paddock interviews.', duration: 90 },
    { title: 'Action Sports World Cup', desc: 'Elite athletes competing across skateboarding, BMX, freestyle motocross, and snowboarding.', duration: 60 },
    { title: 'Sporting Legends: The Ascent', desc: 'Archival profiles and behind-the-scenes endurance stories of legendary world champions.', duration: 60 },
  ],
  'Science & Nature': [
    { title: 'Cosmic Horizons: Space Station Live', desc: 'Stunning HD downlink from astronauts aboard the orbital station and live mission control updates.', duration: 60 },
    { title: 'Wild Earth: Ocean Depths & Reefs', desc: 'High-definition underwater exploration into marine sanctuaries, predator migrations, and coral reefs.', duration: 60 },
    { title: 'Quantum Age & Robotics', desc: 'Breakthrough innovations in artificial intelligence, space propulsion, and sustainable power grids.', duration: 30 },
    { title: 'Deep Wilderness: Arctic Expedition', desc: 'Survival documentary following wildlife biologists across sub-zero tundra environments.', duration: 60 },
  ],
  'Movies & Cinema': [
    { title: 'Classic Feature: Golden Era Cinema', desc: 'Restored cinema classic with commentary on directorial craft and vintage set design.', duration: 120 },
    { title: 'Indie Short Film Showcase', desc: 'Award-winning curated animated and live-action shorts from international film festivals.', duration: 45 },
    { title: 'Behind the Lens: Special FX & Stunts', desc: 'The secrets of computer-generated VFX, practical pyro-effects, and motion-capture artistry.', duration: 45 },
    { title: 'Prime Time Feature Presentation', desc: 'Critically acclaimed motion picture broadcast in pristine high definition audio and video.', duration: 110 },
  ],
  'Music & Radio': [
    { title: 'Lofi Chill Lounge & Ambient Stream', desc: 'Downtempo instrumental rhythms, warm analog textures, and visual relaxation soundscapes.', duration: 60 },
    { title: 'Electronic Sessions: Live DJ Set', desc: 'Global electronic club mixes, deep house grooves, and festival stage recordings.', duration: 90 },
    { title: 'Acoustic Unplugged Vault', desc: 'Intimate studio sessions with singer-songwriters and classical ensembles.', duration: 60 },
  ],
  General: [
    { title: 'OmniStream Prime Broadcast', desc: 'Curated international programming featuring documentary shorts, culture, and highlights.', duration: 60 },
    { title: 'Discovery Showcase', desc: 'A wide-ranging tour of travel landmarks, architectural marvels, and culinary traditions.', duration: 45 },
    { title: 'Nightline Focus & Reviews', desc: 'Evening recap of arts, entertainment, and modern living.', duration: 45 },
  ],
};

/**
 * Generate schedule for a channel centered around the current real time
 */
export function getChannelSchedule(channel: Channel, baseDate = new Date(), epgData?: Map<string, EPGProgram[]> | null): EPGProgram[] {
  if (epgData && epgData.has(channel.id) && (epgData.get(channel.id)?.length ?? 0) > 0) {
    return epgData.get(channel.id)!;
  }
  if (epgData instanceof Map) {
    // Real EPG configured but no data for this channel: don't fabricate.
    return [];
  }

  // Seed based on channel number to give stable unique programs per channel
  const seed = channel.channelNumber * 17 + channel.name.length;
  
  // Start 4 hours before the current hour, aligned to half hour
  const startOfWindow = new Date(baseDate);
  startOfWindow.setHours(startOfWindow.getHours() - 3);
  startOfWindow.setMinutes(startOfWindow.getMinutes() < 30 ? 0 : 30, 0, 0);

  const programs: EPGProgram[] = [];
  let currentTimeCursor = new Date(startOfWindow);

  // Generate 12 hours of schedule
  for (let i = 0; i < 14; i++) {
    // Generic, non-fabricated schedule entries (no fake show titles) for the
    // built-in auto engine. Durations cycle through common slot lengths.
    const slotDurations = [30, 45, 60, 30, 60];
    const duration = slotDurations[(seed + i) % slotDurations.length];

    const startTime = new Date(currentTimeCursor);
    const endTime = new Date(startTime.getTime() + duration * 60 * 1000);

    const now = baseDate.getTime();
    const startMs = startTime.getTime();
    const endMs = endTime.getTime();

    const isLive = now >= startMs && now < endMs;
    let progressPercent = 0;

    if (isLive) {
      const elapsed = now - startMs;
      const total = endMs - startMs;
      progressPercent = Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
    } else if (now >= endMs) {
      progressPercent = 100;
    }

    programs.push({
      id: `${channel.id}-epg-${i}`,
      channelId: channel.id,
      title: channel.name,
      description: 'Continuous live broadcast from this channel.',
      category: channel.group,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      durationMinutes: duration,
      progressPercent,
      isLive,
    });

    currentTimeCursor = endTime;
  }

  return programs;
}

/**
 * Helper to get currently playing program and next program
 */
export function getCurrentAndNextProgram(channel: Channel, epgData?: Map<string, EPGProgram[]> | null): { current: EPGProgram | null; next: EPGProgram | null } {
  const schedule = getChannelSchedule(channel, new Date(), epgData);
  const now = Date.now();

  const currentIndex = schedule.findIndex((p) => {
    const start = new Date(p.startTime).getTime();
    const end = new Date(p.endTime).getTime();
    return now >= start && now < end;
  });

  if (currentIndex !== -1) {
    return {
      current: schedule[currentIndex],
      next: schedule[currentIndex + 1] || null,
    };
  }

  return {
    current: schedule[0] || null,
    next: schedule[1] || null,
  };
}

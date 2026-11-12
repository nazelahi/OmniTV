import { Channel, EPGProgram } from '../types/playlist';

export type SearchMatchReason =
  | 'Channel #'
  | 'Channel Name'
  | 'On Now'
  | 'Up Next'
  | 'Schedule'
  | 'Category'
  | 'Region / Language'
  | 'Description';

export interface ProgramPair {
  current: EPGProgram | null;
  next: EPGProgram | null;
}

export interface ChannelSearchResult {
  channel: Channel;
  score: number;
  matchReason: SearchMatchReason;
  matchedProgramTitle?: string;
}

export interface SearchChannelsOptions {
  programsByChannel?: Map<string, ProgramPair>;
  schedulesByChannel?: Map<string, EPGProgram[]>;
  limit?: number;
}

export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[-_./:|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function condenseSearchText(value: string): string {
  return normalizeSearchText(value).replace(/\s+/g, '');
}

/**
 * Recognizes channel number queries such as "12", "012", "#12", "ch12", "ch 12", "channel 12".
 */
export function parseChannelNumberQuery(query: string): number | null {
  const trimmed = query.trim().toLowerCase();
  const match = trimmed.match(/^(?:#|ch(?:annel)?\.?\s*)?(\d{1,5})$/i);
  if (!match) return null;
  const num = parseInt(match[1], 10);
  return Number.isFinite(num) && num > 0 ? num : null;
}

function editDistanceAtMostOne(a: string, b: string): boolean {
  if (a === b) return true;
  const lenDiff = Math.abs(a.length - b.length);
  if (lenDiff > 1) return false;

  let i = 0;
  let j = 0;
  let edits = 0;

  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
    } else {
      edits++;
      if (edits > 1) return false;
      if (a.length > b.length) {
        i++;
      } else if (b.length > a.length) {
        j++;
      } else {
        i++;
        j++;
      }
    }
  }

  if (i < a.length || j < b.length) edits++;
  return edits <= 1;
}

function fieldMatchesToken(normField: string, condensedField: string, token: string): { matched: boolean; quality: 'exact' | 'prefix' | 'substring' | 'fuzzy' | 'none' } {
  if (!normField) return { matched: false, quality: 'none' };

  const words = normField.split(' ');
  if (words.some((w) => w === token)) {
    return { matched: true, quality: 'exact' };
  }
  if (words.some((w) => w.startsWith(token))) {
    return { matched: true, quality: 'prefix' };
  }
  if (normField.includes(token) || (token.length >= 3 && condensedField.includes(token))) {
    return { matched: true, quality: 'substring' };
  }

  // Allow 1-character typo tolerance for longer tokens
  if (token.length >= 4) {
    for (const w of words) {
      if (w.length >= 4 && editDistanceAtMostOne(w, token)) {
        return { matched: true, quality: 'fuzzy' };
      }
    }
  }

  return { matched: false, quality: 'none' };
}

function qualityMultiplier(quality: 'exact' | 'prefix' | 'substring' | 'fuzzy' | 'none'): number {
  switch (quality) {
    case 'exact':
      return 1;
    case 'prefix':
      return 0.85;
    case 'substring':
      return 0.7;
    case 'fuzzy':
      return 0.45;
    default:
      return 0;
  }
}

export function searchChannels(
  channels: Channel[],
  rawQuery: string,
  options: SearchChannelsOptions = {}
): ChannelSearchResult[] {
  const trimmed = rawQuery.trim();
  if (!trimmed) {
    return channels.map((channel) => ({
      channel,
      score: channel.isFavorite ? 10 : 0,
      matchReason: 'Channel Name',
    }));
  }

  const normQuery = normalizeSearchText(trimmed);
  const condensedQuery = normQuery.replace(/\s+/g, '');
  const tokens = normQuery.split(' ').filter(Boolean);
  const numQuery = parseChannelNumberQuery(trimmed);

  const { programsByChannel, schedulesByChannel, limit } = options;
  const results: ChannelSearchResult[] = [];

  for (const channel of channels) {
    const progPair = programsByChannel?.get(channel.id);
    const schedule = schedulesByChannel?.get(channel.id);

    const normName = normalizeSearchText(channel.name || '');
    const condensedName = normName.replace(/\s+/g, '');
    const normTvgName = normalizeSearchText(channel.tvgName || '');
    const condensedTvgName = normTvgName.replace(/\s+/g, '');
    const normGroup = normalizeSearchText(channel.group || '');
    const condensedGroup = normGroup.replace(/\s+/g, '');
    const normRegion = normalizeSearchText(
      [channel.country, channel.language, channel.tvgId].filter(Boolean).join(' ')
    );
    const condensedRegion = normRegion.replace(/\s+/g, '');

    const currentTitle = progPair?.current?.title || '';
    const normCurrent = normalizeSearchText(currentTitle);
    const condensedCurrent = normCurrent.replace(/\s+/g, '');

    const nextTitle = progPair?.next?.title || '';
    const normNext = normalizeSearchText(nextTitle);
    const condensedNext = normNext.replace(/\s+/g, '');

    const scheduleTitles = schedule
      ? schedule.map((p) => p.title).filter(Boolean).join(' ')
      : '';
    const normSchedule = normalizeSearchText(scheduleTitles);
    const condensedSchedule = normSchedule.replace(/\s+/g, '');

    const progDesc = [
      progPair?.current?.category,
      progPair?.current?.description,
      progPair?.next?.category,
      progPair?.next?.description,
    ]
      .filter(Boolean)
      .join(' ');
    const normDesc = normalizeSearchText(progDesc);
    const condensedDesc = normDesc.replace(/\s+/g, '');

    // Fast path for channel number queries like "#12" or "12"
    let numberScore = 0;
    if (numQuery !== null) {
      if (channel.channelNumber === numQuery) {
        numberScore = 1200;
      } else if (channel.channelNumber.toString().startsWith(numQuery.toString())) {
        numberScore = 400;
      }
    }

    // Whole-query bonus
    let wholeBonus = 0;
    if (normName === normQuery || condensedName === condensedQuery) {
      wholeBonus += 500;
    } else if (normName.startsWith(normQuery) || condensedName.startsWith(condensedQuery)) {
      wholeBonus += 300;
    } else if (normName.includes(normQuery) || (condensedQuery.length >= 3 && condensedName.includes(condensedQuery))) {
      wholeBonus += 160;
    }

    // Check every query token against all fields
    let allTokensMatched = tokens.length > 0;
    let totalTokenScore = 0;
    let bestReason: SearchMatchReason = 'Channel Name';
    let bestWeight = -1;
    let matchedProgramTitle: string | undefined;

    for (const token of tokens) {
      const chNumMatch = channel.channelNumber.toString() === token;
      const nameMatch = fieldMatchesToken(normName, condensedName, token);
      const tvgMatch = fieldMatchesToken(normTvgName, condensedTvgName, token);
      const currentMatch = fieldMatchesToken(normCurrent, condensedCurrent, token);
      const nextMatch = fieldMatchesToken(normNext, condensedNext, token);
      const scheduleMatch = fieldMatchesToken(normSchedule, condensedSchedule, token);
      const groupMatch = fieldMatchesToken(normGroup, condensedGroup, token);
      const regionMatch = fieldMatchesToken(normRegion, condensedRegion, token);
      const descMatch = fieldMatchesToken(normDesc, condensedDesc, token);

      const candidates: Array<{
        matched: boolean;
        weight: number;
        reason: SearchMatchReason;
        programTitle?: string;
      }> = [
        { matched: chNumMatch, weight: 900, reason: 'Channel #' },
        {
          matched: nameMatch.matched,
          weight: 700 * qualityMultiplier(nameMatch.quality),
          reason: 'Channel Name',
        },
        {
          matched: tvgMatch.matched,
          weight: 560 * qualityMultiplier(tvgMatch.quality),
          reason: 'Channel Name',
        },
        {
          matched: currentMatch.matched,
          weight: 460 * qualityMultiplier(currentMatch.quality),
          reason: 'On Now',
          programTitle: currentTitle || undefined,
        },
        {
          matched: nextMatch.matched,
          weight: 330 * qualityMultiplier(nextMatch.quality),
          reason: 'Up Next',
          programTitle: nextTitle || undefined,
        },
        {
          matched: scheduleMatch.matched,
          weight: 280 * qualityMultiplier(scheduleMatch.quality),
          reason: 'Schedule',
        },
        {
          matched: groupMatch.matched,
          weight: 260 * qualityMultiplier(groupMatch.quality),
          reason: 'Category',
        },
        {
          matched: regionMatch.matched,
          weight: 200 * qualityMultiplier(regionMatch.quality),
          reason: 'Region / Language',
        },
        {
          matched: descMatch.matched,
          weight: 140 * qualityMultiplier(descMatch.quality),
          reason: 'Description',
        },
      ];

      const matchedCandidates = candidates.filter((c) => c.matched && c.weight > 0);
      if (matchedCandidates.length === 0) {
        allTokensMatched = false;
        break;
      }

      matchedCandidates.sort((a, b) => b.weight - a.weight);
      const top = matchedCandidates[0];
      totalTokenScore += top.weight;
      if (top.weight > bestWeight) {
        bestWeight = top.weight;
        bestReason = top.reason;
        if (top.programTitle) matchedProgramTitle = top.programTitle;
      }
    }

    // Condensed full-query match fallback (e.g. "al jazeera" typed as "aljazeera")
    if (!allTokensMatched && condensedQuery.length >= 3) {
      if (condensedName.includes(condensedQuery)) {
        allTokensMatched = true;
        totalTokenScore += 520;
        bestReason = 'Channel Name';
      } else if (condensedCurrent.includes(condensedQuery)) {
        allTokensMatched = true;
        totalTokenScore += 360;
        bestReason = 'On Now';
        matchedProgramTitle = currentTitle || undefined;
      } else if (condensedGroup.includes(condensedQuery)) {
        allTokensMatched = true;
        totalTokenScore += 220;
        bestReason = 'Category';
      }
    }

    if (numberScore > 0) {
      allTokensMatched = true;
      if (numberScore >= bestWeight) {
        bestReason = 'Channel #';
      }
    }

    if (!allTokensMatched) continue;

    const favoriteBoost = channel.isFavorite ? 15 : 0;
    const totalScore = numberScore + wholeBonus + totalTokenScore + favoriteBoost;

    results.push({
      channel,
      score: totalScore,
      matchReason: bestReason,
      matchedProgramTitle,
    });
  }

  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.channel.channelNumber - b.channel.channelNumber;
  });

  return typeof limit === 'number' && limit > 0 ? results.slice(0, limit) : results;
}

export interface HighlightSegment {
  text: string;
  highlight: boolean;
}

/**
 * Splits display text into highlighted/plain segments matching any token from query.
 */
export function splitHighlightSegments(text: string, query: string): HighlightSegment[] {
  if (!text) return [];
  const tokens = Array.from(
    new Set(
      normalizeSearchText(query)
        .split(' ')
        .map((t) => t.trim())
        .filter((t) => t.length >= 2 || /^\d+$/.test(t))
    )
  ).sort((a, b) => b.length - a.length);

  if (tokens.length === 0) {
    return [{ text, highlight: false }];
  }

  const escaped = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = text.split(regex);

  const tokenSet = new Set(tokens.map((t) => t.toLowerCase()));
  return parts
    .filter((p) => p.length > 0)
    .map((part) => ({
      text: part,
      highlight: tokenSet.has(part.toLowerCase()),
    }));
}

import { Channel, Playlist } from '../types/playlist';

/**
 * Robust parser for M3U and M3U8 IPTV playlists
 */
export function parseM3U(content: string, playlistName = 'Custom Playlist', playlistUrl?: string): Playlist {
  const lines = content.split(/\r?\n/);
  const channels: Channel[] = [];
  const groupsSet = new Set<string>();

  let currentInfo: Partial<Channel> | null = null;
  let currentGroup = 'General';
  let channelCounter = 1;
  let extractedEpgUrl: string | undefined = undefined;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line) continue;

    // Header check: extract x-tvg-url or url-tvg EPG guide URL
    if (line.startsWith('#EXTM3U')) {
      const epgMatch = line.match(/(?:x-tvg-url|url-tvg|tvg-url)=["']([^"']*)["']/i);
      if (epgMatch && epgMatch[1]) {
        extractedEpgUrl = epgMatch[1].trim();
      }
      continue;
    }

    // Group fallback line (some playlists use #EXTGRP:GroupName)
    if (line.startsWith('#EXTGRP:')) {
      currentGroup = line.substring(8).trim() || 'General';
      if (currentInfo) {
        currentInfo.group = currentGroup;
      }
      continue;
    }

    // Channel metadata line
    if (line.startsWith('#EXTINF:')) {
      currentInfo = {};

      // Match attributes: key="value" or key=value
      const tvgIdMatch = line.match(/tvg-id=["']([^"']*)["']/i);
      const tvgNameMatch = line.match(/tvg-name=["']([^"']*)["']/i);
      const tvgLogoMatch = line.match(/tvg-logo=["']([^"']*)["']/i);
      const groupTitleMatch = line.match(/group-title=["']([^"']*)["']/i);
      const tvgChnoMatch = line.match(/tvg-chno=["']?(\d+)["']?/i);

      if (tvgIdMatch && tvgIdMatch[1]) currentInfo.tvgId = tvgIdMatch[1];
      if (tvgNameMatch && tvgNameMatch[1]) currentInfo.tvgName = tvgNameMatch[1];
      if (tvgLogoMatch && tvgLogoMatch[1]) currentInfo.logo = tvgLogoMatch[1];

      let group = currentGroup;
      if (groupTitleMatch && groupTitleMatch[1]) {
        group = groupTitleMatch[1].trim();
      }
      currentInfo.group = group || 'General';

      let channelNum = channelCounter;
      if (tvgChnoMatch && tvgChnoMatch[1]) {
        channelNum = parseInt(tvgChnoMatch[1], 10);
      }
      currentInfo.channelNumber = channelNum;

      // Extract Channel Name: text after the last comma on the EXTINF line
      const commaIndex = line.lastIndexOf(',');
      let name = '';
      if (commaIndex !== -1) {
        name = line.substring(commaIndex + 1).trim();
      }

      if (!name && currentInfo.tvgName) {
        name = currentInfo.tvgName;
      }
      if (!name) {
        name = `Channel ${channelCounter}`;
      }

      currentInfo.name = name;
      continue;
    }

    // Comment lines starting with # (other directives)
    if (line.startsWith('#')) {
      continue;
    }

    // Stream URL line
    if (line.startsWith('http://') || line.startsWith('https://') || line.startsWith('rtmp://') || line.startsWith('//')) {
      const streamUrl = line.startsWith('//') ? `https:${line}` : line;

      const channelName = currentInfo?.name || `Channel ${channelCounter}`;
      const group = currentInfo?.group || 'General';
      const channelNum = currentInfo?.channelNumber || channelCounter;

      const channel: Channel = {
        id: currentInfo?.tvgId ? `${currentInfo.tvgId}-${channelCounter}` : `ch-${channelCounter}-${Date.now().toString(36)}`,
        name: channelName,
        url: streamUrl,
        logo: currentInfo?.logo,
        group: group,
        channelNumber: channelNum,
        tvgId: currentInfo?.tvgId,
        tvgName: currentInfo?.tvgName,
        isFavorite: false,
      };

      channels.push(channel);
      groupsSet.add(channel.group);
      channelCounter++;
      currentInfo = null;
    }
  }

  const groups = Array.from(groupsSet).sort((a, b) => {
    if (a === 'Favorites') return -1;
    if (b === 'Favorites') return 1;
    if (a === 'General') return 1;
    return a.localeCompare(b);
  });

  return {
    id: `playlist-${Date.now().toString(36)}`,
    name: playlistName,
    url: playlistUrl,
    epgUrl: extractedEpgUrl,
    channels,
    groups: groups.length > 0 ? groups : ['General'],
    updatedAt: new Date().toISOString(),
    isCustom: true,
  };
}

/**
 * Generate M3U playlist text from Channel array
 */
export function generateM3U(playlist: Playlist): string {
  let output = '#EXTM3U\n';
  playlist.channels.forEach((ch) => {
    const logoAttr = ch.logo ? ` tvg-logo="${ch.logo}"` : '';
    const idAttr = ch.tvgId ? ` tvg-id="${ch.tvgId}"` : '';
    const nameAttr = ch.tvgName ? ` tvg-name="${ch.tvgName}"` : '';
    const groupAttr = ch.group ? ` group-title="${ch.group}"` : '';
    const chnoAttr = ` tvg-chno="${ch.channelNumber}"`;

    output += `#EXTINF:-1${idAttr}${nameAttr}${logoAttr}${groupAttr}${chnoAttr},${ch.name}\n`;
    output += `${ch.url}\n`;
  });
  return output;
}

import { and, asc, eq, gt } from 'drizzle-orm';
import { db } from './index.ts';
import {
  adminSessions,
  customChannels,
  siteSettings,
  userFavorites,
  userPlaylists,
  userRecentChannels,
} from './schema.ts';

export interface StoredSiteConfig {
  playlistUrl: string;
  playlistName: string;
  epgUrl?: string;
  autoRefreshMinutes: number;
  adminPin: string;
  customChannels: any[];
  disabledChannelIds: string[];
  lastUpdated: string;
  lastSyncStatus?: 'ok' | 'error';
  lastSyncMessage?: string;
  cachedChannelCount?: number;
  appName?: string;
  appLogo?: string;
  appTagline?: string;
  primaryColor?: string;
  accentColor?: string;
}

const SINGLETON_ID = 1;

export async function getSiteConfigFromDb(defaults: StoredSiteConfig): Promise<StoredSiteConfig> {
  try {
    const [settingsRows, customRows] = await Promise.all([
      db.select().from(siteSettings).where(eq(siteSettings.id, SINGLETON_ID)).limit(1),
      db.select().from(customChannels).orderBy(asc(customChannels.channelNumber)),
    ]);

    const row = settingsRows[0];
    if (!row) {
      return {
        ...defaults,
        customChannels: customRows.map((ch) => ({
          id: ch.id,
          channelNumber: ch.channelNumber,
          name: ch.name,
          url: ch.url,
          logo: ch.logo || undefined,
          group: ch.channelGroup || 'Custom',
          country: ch.country || undefined,
          language: ch.language || undefined,
          tvgId: ch.tvgId || undefined,
          tvgName: ch.tvgName || undefined,
        })),
      };
    }

    const effectiveUrl = row.playlistUrl?.trim() || defaults.playlistUrl;
    const effectiveName = row.playlistName?.trim() || defaults.playlistName;

    return {
      playlistUrl: effectiveUrl,
      playlistName: effectiveName,
      epgUrl: row.epgUrl ?? '',
      autoRefreshMinutes: row.autoRefreshMinutes ?? defaults.autoRefreshMinutes,
      adminPin: row.adminPin || defaults.adminPin,
      customChannels: customRows.map((ch) => ({
        id: ch.id,
        channelNumber: ch.channelNumber,
        name: ch.name,
        url: ch.url,
        logo: ch.logo || undefined,
        group: ch.channelGroup || 'Custom',
        country: ch.country || undefined,
        language: ch.language || undefined,
        tvgId: ch.tvgId || undefined,
        tvgName: ch.tvgName || undefined,
      })),
      disabledChannelIds: Array.isArray(row.disabledChannelIds) ? row.disabledChannelIds : [],
      lastUpdated: row.updatedAt ? row.updatedAt.toISOString() : new Date().toISOString(),
      lastSyncStatus:
        row.lastSyncStatus === 'ok' || row.lastSyncStatus === 'error'
          ? row.lastSyncStatus
          : undefined,
      lastSyncMessage: row.lastSyncMessage || undefined,
      cachedChannelCount: row.cachedChannelCount ?? 0,
      appName: row.appName || defaults.appName,
      appLogo: row.appLogo || '',
      appTagline: row.appTagline || defaults.appTagline,
      primaryColor: row.primaryColor || defaults.primaryColor,
      accentColor: row.accentColor || '',
    };
  } catch (error) {
    console.error('Failed to read site settings from database:', error);
    throw new Error('Failed to read configuration from database.', { cause: error });
  }
}

export async function saveSiteConfigToDb(
  config: StoredSiteConfig,
  updatedByUid?: string | null
): Promise<StoredSiteConfig> {
  try {
    const now = new Date();
    await db
      .insert(siteSettings)
      .values({
        id: SINGLETON_ID,
        playlistUrl: config.playlistUrl,
        playlistName: config.playlistName,
        epgUrl: config.epgUrl || '',
        autoRefreshMinutes: config.autoRefreshMinutes,
        adminPin: config.adminPin,
        appName: config.appName || 'OmniStream TV',
        appLogo: config.appLogo || '',
        appTagline: config.appTagline || 'Live TV',
        primaryColor: config.primaryColor || '#e11d48',
        accentColor: config.accentColor || '',
        disabledChannelIds: config.disabledChannelIds || [],
        lastSyncStatus: config.lastSyncStatus || null,
        lastSyncMessage: config.lastSyncMessage || null,
        cachedChannelCount: config.cachedChannelCount || 0,
        updatedByUid: updatedByUid ?? null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: siteSettings.id,
        set: {
          playlistUrl: config.playlistUrl,
          playlistName: config.playlistName,
          epgUrl: config.epgUrl || '',
          autoRefreshMinutes: config.autoRefreshMinutes,
          adminPin: config.adminPin,
          appName: config.appName || 'OmniStream TV',
          appLogo: config.appLogo || '',
          appTagline: config.appTagline || 'Live TV',
          primaryColor: config.primaryColor || '#e11d48',
          accentColor: config.accentColor || '',
          disabledChannelIds: config.disabledChannelIds || [],
          updatedByUid: updatedByUid ?? null,
          updatedAt: now,
        },
      });

    // Replace custom channels cleanly
    await db.delete(customChannels);
    if (Array.isArray(config.customChannels) && config.customChannels.length > 0) {
      await db.insert(customChannels).values(
        config.customChannels
          .filter((ch) => ch && typeof ch.id === 'string' && typeof ch.url === 'string')
          .map((ch, idx) => ({
            id: ch.id,
            channelNumber: typeof ch.channelNumber === 'number' ? ch.channelNumber : 100 + idx,
            name: String(ch.name || 'Custom Channel'),
            url: String(ch.url),
            logo: ch.logo ? String(ch.logo) : null,
            channelGroup: String(ch.group || 'Custom'),
            country: ch.country ? String(ch.country) : null,
            language: ch.language ? String(ch.language) : null,
            tvgId: ch.tvgId ? String(ch.tvgId) : null,
            tvgName: ch.tvgName ? String(ch.tvgName) : null,
          }))
      );
    }

    return {
      ...config,
      lastUpdated: now.toISOString(),
    };
  } catch (error) {
    console.error('Failed to save site settings to database:', error);
    throw new Error('Failed to save configuration to database.', { cause: error });
  }
}

export async function persistSyncStatusInDb(
  defaults: StoredSiteConfig,
  expectedUrl: string,
  status: 'ok' | 'error',
  message: string,
  channelCount?: number
): Promise<void> {
  try {
    const existing = await db
      .select()
      .from(siteSettings)
      .where(eq(siteSettings.id, SINGLETON_ID))
      .limit(1);

    const row = existing[0];
    if (!row) {
      if (expectedUrl !== defaults.playlistUrl) return;
      await db.insert(siteSettings).values({
        id: SINGLETON_ID,
        playlistUrl: defaults.playlistUrl,
        playlistName: defaults.playlistName,
        epgUrl: defaults.epgUrl || '',
        autoRefreshMinutes: defaults.autoRefreshMinutes,
        adminPin: defaults.adminPin,
        appName: defaults.appName || 'OmniStream TV',
        appLogo: defaults.appLogo || '',
        appTagline: defaults.appTagline || 'Live TV',
        primaryColor: defaults.primaryColor || '#e11d48',
        accentColor: defaults.accentColor || '',
        disabledChannelIds: [],
        lastSyncStatus: status,
        lastSyncMessage: message,
        cachedChannelCount: typeof channelCount === 'number' ? channelCount : 0,
        updatedAt: new Date(),
      });
      return;
    }

    if (row.playlistUrl !== expectedUrl) return;

    await db
      .update(siteSettings)
      .set({
        lastSyncStatus: status,
        lastSyncMessage: message,
        ...(typeof channelCount === 'number' ? { cachedChannelCount: channelCount } : {}),
      })
      .where(eq(siteSettings.id, SINGLETON_ID));
  } catch (error) {
    console.error('Failed to persist sync status in database:', error);
  }
}

export async function createAdminSessionInDb(
  token: string,
  expiresAt: Date,
  userUid?: string | null
): Promise<void> {
  try {
    await db.insert(adminSessions).values({
      token,
      userUid: userUid ?? null,
      expiresAt,
    });
  } catch (error) {
    console.error('Failed to store admin session in database:', error);
    throw new Error('Failed to create admin session.', { cause: error });
  }
}

export async function validateAdminSessionInDb(token: string): Promise<boolean> {
  try {
    const rows = await db
      .select()
      .from(adminSessions)
      .where(and(eq(adminSessions.token, token), gt(adminSessions.expiresAt, new Date())))
      .limit(1);
    return rows.length > 0;
  } catch (error) {
    console.error('Failed to validate admin session in database:', error);
    return false;
  }
}

export async function getUserDataFromDb(userUid: string) {
  try {
    const [favoritesRows, playlistRows, recentsRows] = await Promise.all([
      db.select().from(userFavorites).where(eq(userFavorites.userUid, userUid)),
      db.select().from(userPlaylists).where(eq(userPlaylists.userUid, userUid)),
      db
        .select()
        .from(userRecentChannels)
        .where(eq(userRecentChannels.userUid, userUid))
        .limit(1),
    ]);

    return {
      favoriteChannelIds: favoritesRows.map((f) => f.channelId),
      playlists: playlistRows.map((p) => ({
        id: p.id,
        name: p.name,
        url: p.url || undefined,
        epgUrl: p.epgUrl || undefined,
        channels: Array.isArray(p.channels) ? p.channels : [],
        groups: Array.isArray(p.groups) ? p.groups : [],
        updatedAt: p.updatedAt ? p.updatedAt.toISOString() : new Date().toISOString(),
        isCustom: true,
      })),
      recentChannelIds: recentsRows[0]?.recentChannelIds || [],
      activeChannelId: recentsRows[0]?.activeChannelId || null,
    };
  } catch (error) {
    console.error('Failed to load user data from database:', error);
    throw new Error('Failed to load user preferences.', { cause: error });
  }
}

export async function toggleUserFavoriteInDb(
  userUid: string,
  channelId: string,
  isFavorite: boolean,
  channelName?: string
) {
  try {
    if (isFavorite) {
      await db
        .insert(userFavorites)
        .values({
          userUid,
          channelId,
          channelName: channelName || null,
        })
        .onConflictDoUpdate({
          target: [userFavorites.userUid, userFavorites.channelId],
          set: { channelName: channelName || null },
        });
    } else {
      await db
        .delete(userFavorites)
        .where(
          and(
            eq(userFavorites.userUid, userUid),
            eq(userFavorites.channelId, channelId)
          )
        );
    }
  } catch (error) {
    console.error('Failed to toggle favorite in database:', error);
    throw new Error('Failed to update favorite channel.', { cause: error });
  }
}

export async function saveUserPlaylistInDb(
  userUid: string,
  playlist: {
    id: string;
    name: string;
    url?: string;
    epgUrl?: string;
    channels: any[];
    groups: string[];
  }
) {
  try {
    await db
      .insert(userPlaylists)
      .values({
        id: `${userUid}:${playlist.id}`,
        userUid,
        name: playlist.name,
        url: playlist.url || null,
        epgUrl: playlist.epgUrl || null,
        channels: playlist.channels || [],
        groups: playlist.groups || [],
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userPlaylists.id,
        set: {
          name: playlist.name,
          url: playlist.url || null,
          epgUrl: playlist.epgUrl || null,
          channels: playlist.channels || [],
          groups: playlist.groups || [],
          updatedAt: new Date(),
        },
      });
  } catch (error) {
    console.error('Failed to save user playlist in database:', error);
    throw new Error('Failed to save playlist.', { cause: error });
  }
}

export async function deleteUserPlaylistInDb(userUid: string, playlistId: string) {
  try {
    await db
      .delete(userPlaylists)
      .where(
        and(
          eq(userPlaylists.userUid, userUid),
          eq(userPlaylists.id, `${userUid}:${playlistId}`)
        )
      );
  } catch (error) {
    console.error('Failed to delete user playlist in database:', error);
    throw new Error('Failed to delete playlist.', { cause: error });
  }
}

export async function saveUserRecentsInDb(
  userUid: string,
  recentChannelIds: string[],
  activeChannelId?: string | null
) {
  try {
    await db
      .insert(userRecentChannels)
      .values({
        userUid,
        recentChannelIds,
        activeChannelId: activeChannelId ?? null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userRecentChannels.userUid,
        set: {
          recentChannelIds,
          ...(activeChannelId !== undefined ? { activeChannelId } : {}),
          updatedAt: new Date(),
        },
      });
  } catch (error) {
    console.error('Failed to save recent channels in database:', error);
    throw new Error('Failed to save watch history.', { cause: error });
  }
}

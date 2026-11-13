import { relations } from 'drizzle-orm';
import {
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const siteSettings = pgTable('site_settings', {
  id: integer('id').primaryKey(),
  playlistUrl: text('playlist_url').notNull(),
  playlistName: text('playlist_name').notNull(),
  epgUrl: text('epg_url').default('').notNull(),
  autoRefreshMinutes: integer('auto_refresh_minutes').default(60).notNull(),
  adminPin: text('admin_pin').default('1234').notNull(),
  appName: text('app_name').default('OmniStream TV').notNull(),
  appLogo: text('app_logo').default('').notNull(),
  appTagline: text('app_tagline').default('Live TV').notNull(),
  primaryColor: text('primary_color').default('#e11d48').notNull(),
  accentColor: text('accent_color').default('').notNull(),
  disabledChannelIds: jsonb('disabled_channel_ids').$type<string[]>().default([]).notNull(),
  lastSyncStatus: text('last_sync_status'),
  lastSyncMessage: text('last_sync_message'),
  cachedChannelCount: integer('cached_channel_count').default(0).notNull(),
  updatedByUid: text('updated_by_uid').references(() => users.uid, { onDelete: 'set null' }),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const customChannels = pgTable('custom_channels', {
  id: text('id').primaryKey(),
  channelNumber: integer('channel_number').notNull(),
  name: text('name').notNull(),
  url: text('url').notNull(),
  logo: text('logo'),
  channelGroup: text('channel_group').default('Custom').notNull(),
  country: text('country'),
  language: text('language'),
  tvgId: text('tvg_id'),
  tvgName: text('tvg_name'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const userFavorites = pgTable(
  'user_favorites',
  {
    id: serial('id').primaryKey(),
    userUid: text('user_uid')
      .notNull()
      .references(() => users.uid, { onDelete: 'cascade' }),
    channelId: text('channel_id').notNull(),
    channelName: text('channel_name'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('user_favorites_uid_channel_idx').on(table.userUid, table.channelId)]
);

export const userPlaylists = pgTable('user_playlists', {
  id: text('id').primaryKey(),
  userUid: text('user_uid')
    .notNull()
    .references(() => users.uid, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  url: text('url'),
  epgUrl: text('epg_url'),
  channels: jsonb('channels').$type<any[]>().default([]).notNull(),
  groups: jsonb('groups').$type<string[]>().default([]).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const userRecentChannels = pgTable('user_recent_channels', {
  userUid: text('user_uid')
    .primaryKey()
    .references(() => users.uid, { onDelete: 'cascade' }),
  recentChannelIds: jsonb('recent_channel_ids').$type<string[]>().default([]).notNull(),
  activeChannelId: text('active_channel_id'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const adminSessions = pgTable('admin_sessions', {
  token: text('token').primaryKey(),
  userUid: text('user_uid').references(() => users.uid, { onDelete: 'set null' }),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many, one }) => ({
  favorites: many(userFavorites),
  playlists: many(userPlaylists),
  recents: one(userRecentChannels, {
    fields: [users.uid],
    references: [userRecentChannels.userUid],
  }),
}));

export const userFavoritesRelations = relations(userFavorites, ({ one }) => ({
  user: one(users, {
    fields: [userFavorites.userUid],
    references: [users.uid],
  }),
}));

export const userPlaylistsRelations = relations(userPlaylists, ({ one }) => ({
  user: one(users, {
    fields: [userPlaylists.userUid],
    references: [users.uid],
  }),
}));

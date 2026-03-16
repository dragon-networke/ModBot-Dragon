/**
 * src/scripts/api.ts
 * API-Client für den ModBot Dragon Dashboard
 * Kommuniziert mit ticketWebserver.js (Express Backend)
 */

const BASE_URL = import.meta.env.PUBLIC_API_URL || 'http://localhost:3000';

// ── Typen ──────────────────────────────────────────────────────────────────

export interface BotStatus {
  status: 'online' | 'offline';
  ping: number;
  uptime: string;
  guilds: number;
  users: number;
  commandsToday: number;
}

export interface Ticket {
  ticketNumber: number;
  channelId: string;
  userId: string;
  category: string;
  categoryLabel: string;
  createdAt: number;
}

export interface GuildConfig {
  categoryId: string | null;
  logChannelId: string | null;
  transcriptChannelId: string | null;
  supportRoleId: string | null;
  panelTitle: string;
  panelDescription: string | null;
  ticketCounter: number;
  activeTickets: Record<string, Ticket>;
  categoryRoles: Record<string, string[]>;
}

export interface Guild {
  id: string;
  name: string;
  icon: string | null;
  configured: boolean;
}

export interface LogEvent {
  type: string;
  user: string;
  mod: string;
  time: string;
  color: 'red' | 'orange' | 'green' | 'blue';
}

// ── Basis-Request ──────────────────────────────────────────────────────────

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unbekannter Fehler' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}

const get  = <T>(path: string)              => request<T>('GET', path);
const post = <T>(path: string, body: unknown) => request<T>('POST', path, body);
const patch= <T>(path: string, body: unknown) => request<T>('PATCH', path, body);
const del  = <T>(path: string, body?: unknown) => request<T>('DELETE', path, body);

// ── Auth ───────────────────────────────────────────────────────────────────

export const api = {

  auth: {
    me: ()      => get<{ id: string; username: string; avatar: string | null }>('/api/me'),
    logout: ()  => { window.location.href = `${BASE_URL}/auth/logout`; },
    login: ()   => { window.location.href = `${BASE_URL}/auth/login`; },
  },

  // ── Guilds ───────────────────────────────────────────────────────────────

  guilds: {
    list: () => get<Guild[]>('/api/guilds'),
  },

  // ── Guild Config ─────────────────────────────────────────────────────────

  config: {
    get: (guildId: string) =>
      get<{ guildId: string; config: GuildConfig | null }>(`/api/guild/${guildId}/config`),

    setPanel: (guildId: string, panelTitle: string, panelDescription?: string) =>
      patch(`/api/guild/${guildId}/panel`, { panelTitle, panelDescription }),

    setLogChannel: (guildId: string, logChannelId: string | null) =>
      patch(`/api/guild/${guildId}/logchannel`, { logChannelId }),

    setTranscriptChannel: (guildId: string, transcriptChannelId: string | null) =>
      patch(`/api/guild/${guildId}/transcriptchannel`, { transcriptChannelId }),

    setCategory: (guildId: string, categoryId: string | null) =>
      patch(`/api/guild/${guildId}/category`, { categoryId }),

    setSupportRole: (guildId: string, supportRoleId: string | null) =>
      patch(`/api/guild/${guildId}/supportrole`, { supportRoleId }),
  },

  // ── Kategorie-Rollen ─────────────────────────────────────────────────────

  categoryRoles: {
    get: (guildId: string) =>
      get<{ categoryRoles: Record<string, string[]> }>(`/api/guild/${guildId}/categoryroles`),

    add: (guildId: string, category: string, roleId: string) =>
      post(`/api/guild/${guildId}/categoryroles`, { category, roleId }),

    remove: (guildId: string, category: string, roleId: string) =>
      del(`/api/guild/${guildId}/categoryroles`, { category, roleId }),
  },

  // ── Tickets ──────────────────────────────────────────────────────────────

  tickets: {
    list: (guildId: string) =>
      get<{ tickets: Ticket[] }>(`/api/guild/${guildId}/tickets`),
  },
};

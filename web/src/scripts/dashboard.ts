// src/scripts/dashboard.ts
// Angepasst für das neue Layout

// @ts-nocheck

const API_URL = window.__API_URL__ || 'http://localhost:3001';
const API_TOKEN = window.__API_TOKEN__ || '';
const GUILD_ID = window.__GUILD_ID__ || '';

console.log('=== DASHBOARD START ===');
console.log('API_URL   =', API_URL);
console.log('GUILD_ID  =', GUILD_ID || 'nicht gesetzt');

function toast(msg: string, type: 'success' | 'error' | 'info' = 'error') {
  const c = document.getElementById('toast-container');
  if (!c) return;
  const div = document.createElement('div');
  div.className = `toast ${type}`;
  div.textContent = msg;
  c.appendChild(div);
  setTimeout(() => div.remove(), 6000);
}

async function api(method: string, path: string) {
  try {
    const url = `${API_URL}${path.startsWith('/') ? path : '/' + path}`;
    console.log('API Request →', url);

    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${API_TOKEN}` }
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.error('API Fehler:', e);
    toast('API Fehler bei ' + path, 'error');
    throw e;
  }
}

const GET = (path: string) => api('GET', path);

// ── Stats & Live Status ───────────────────────────────────────────────────
async function loadStats() {
  try {
    const s = await GET('/bot/status');
    console.log('Stats erhalten:', s);

    // Stats Cards
    const guildsEl = document.getElementById('stat-guilds');
    if (guildsEl) guildsEl.textContent = String(s.guilds ?? '—');

    const usersEl = document.getElementById('stat-users');
    if (usersEl) usersEl.textContent = s.users?.toLocaleString('de-DE') ?? '—';

    const pingEl = document.getElementById('stat-ping');
    if (pingEl) pingEl.textContent = s.ping != null ? `${s.ping}ms` : '—';

    const ticketsEl = document.getElementById('stat-tickets');
    if (ticketsEl) ticketsEl.textContent = String(s.tickets ?? '—');

    // Live Status Chip
    const chip = document.getElementById('bot-status-chip');
    if (chip) {
      const online = s.status === 'online';
      chip.textContent = online ? '● ONLINE' : '● OFFLINE';
      chip.className = `status-chip ${online ? 'online' : 'offline'}`;
    }

    // Live Status Werte
    const statusEl = document.getElementById('bot-status');
    if (statusEl) statusEl.textContent = (s.status || 'OFFLINE').toUpperCase();

    const pingValueEl = document.getElementById('bot-ping');
    if (pingValueEl) pingValueEl.textContent = s.ping != null ? `${s.ping}ms` : '—';

    const uptimeEl = document.getElementById('bot-uptime');
    if (uptimeEl) uptimeEl.textContent = formatUptime(s.uptime);

  } catch (e) {
    console.error('loadStats failed', e);
  }
}

function formatUptime(seconds?: number): string {
  if (!seconds) return '—';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(' ');
}

// ── Guilds laden ──────────────────────────────────────────────────────────
async function loadGuilds() {
  try {
    const guilds = await GET('/bot/guilds');
    console.log('Guilds erhalten:', guilds.length);

    const container = document.getElementById('guild-list-container') || 
                     document.getElementById('guilds-grid');
    if (!container) return;

    if (guilds.length === 0) {
      container.innerHTML = '<div style="padding:40px;text-align:center;color:#64748b;">Keine Server gefunden</div>';
      return;
    }

    container.innerHTML = guilds.map((g: any) => `
      <div class="guild-row">
        <div class="guild-icon-img">
          ${g.icon ? `<img src="${g.icon}" alt=""/>` : `<span>${g.name[0]}</span>`}
        </div>
        <div style="flex:1; text-align:left;">
          <div style="font-weight:600;">${g.name}</div>
          <div style="font-size:11px;color:#64748b;">ID: ${g.id}</div>
        </div>
        <span style="color:#22c55e; font-size:12px;">AKTIV</span>
      </div>
    `).join('');

  } catch (e) {
    console.error('loadGuilds failed', e);
    const container = document.getElementById('guild-list-container') || document.getElementById('guilds-grid');
    if (container) container.innerHTML = '<div style="padding:24px;color:#ef4444;">Fehler beim Laden der Server</div>';
  }
}

// ── Tickets / Transcripts laden ───────────────────────────────────────────
async function loadTickets() {
  try {
    if (!GUILD_ID) return;

    const tickets = await GET(`/tickets/${GUILD_ID}`);
    const count = tickets.length;

    // Stat-Ticket-Zahl aktualisieren
    const statTickets = document.getElementById('stat-tickets');
    if (statTickets) statTickets.textContent = count;

    // Tabelle aktualisieren (funktioniert in index + transcripts)
    const tbody = document.getElementById('tickets-body') || document.getElementById('transcripts-body');
    if (!tbody) return;

    if (tickets.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;color:#64748b;">Keine offenen Tickets</td></tr>`;
      return;
    }

    tbody.innerHTML = tickets.map((t: any) => `
      <tr>
        <td>#${String(t.ticketNumber || 0).padStart(4, '0')}</td>
        <td>${t.userId || '—'}</td>
        <td><span class="cat-badge">${t.category || 'sonstiges'}</span></td>
        <td><span class="status-dot open">open</span></td>
        <td>${new Date(t.createdAt).toLocaleString('de-DE')}</td>
      </tr>
    `).join('');

  } catch (e) {
    console.error('loadTickets failed', e);
  }
}

// ── Commands laden ────────────────────────────────────────────────────────
async function loadCommands() {
  try {
    const container = document.getElementById('commands-list');
    if (!container) return;

    const commands = [
      { id: "antinuke", name: "AntiNuke", desc: "Schützt den Server vor Massen-Aktionen", enabled: true },
      { id: "appeal", name: "Appeal", desc: "Ban-Appeal System", enabled: true },
      { id: "bannliste", name: "Bannliste", desc: "Zeigt die Bannliste des Servers", enabled: true },
      { id: "createchannel", name: "CreateChannel", desc: "Erstellt temporäre Channels", enabled: false },
      { id: "interactiveban", name: "Interactive Ban", desc: "Interaktives Ban-Menü", enabled: true },
      { id: "music", name: "Music", desc: "Musik-Bot Funktionen", enabled: true },
      { id: "level", name: "Level System", desc: "Leveling & XP System", enabled: true },
      { id: "logging", name: "Logging", desc: "Server-Log System", enabled: true },
      { id: "voicesupport", name: "Voice Support", desc: "Temporäre Voice Channels", enabled: true },
      { id: "ticketpanel", name: "Ticket Panel", desc: "Ticket-Erstellung Panel", enabled: true },
    ];

    container.innerHTML = commands.map(cmd => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid #1f252f;">
        <div style="flex:1;">
          <strong style="font-size:15px;">${cmd.name}</strong>
          <div style="font-size:13px;color:#94a3b8;margin-top:4px;">${cmd.desc}</div>
        </div>
        <div style="display:flex;align-items:center;gap:12px;">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
            <input type="checkbox" ${cmd.enabled ? 'checked' : ''} 
                   onchange="toggleCommand('${cmd.id}', this.checked)">
            <span style="font-size:13px;">Aktiv</span>
          </label>
          <button onclick="openCommandSettings('${cmd.id}')" 
                  class="btn btn-ghost btn-sm">Einstellungen</button>
        </div>
      </div>
    `).join('');

  } catch (e) {
    console.error('loadCommands failed', e);
  }
}

function toggleCommand(id: string, enabled: boolean) {
  toast(`Command ${id} wurde ${enabled ? 'aktiviert' : 'deaktiviert'}`, 'success');
}

function openCommandSettings(id: string) {
  toast(`Einstellungen für "${id}" öffnen... (kommt bald)`, 'info');
}

// ── Start ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Dashboard DOM ready');

  await Promise.allSettled([
    loadStats(),
    loadGuilds(),
    loadTickets(),
    loadCommands()
  ]);

  // Auto-Refresh
  setInterval(loadStats, 30000);
  setInterval(loadGuilds, 60000);
  setInterval(loadTickets, 60000);
});
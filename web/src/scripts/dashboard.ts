/**
 * src/scripts/dashboard.ts
 * Nutzt die bestehende api.js (Bearer Auth, /api/bot/status etc.)
 */

declare const window: any;

// ── Konfiguration ──────────────────────────────────────────────────────────
// Wird in index.astro per define:vars gesetzt
const API_URL   = () => window.__API_URL__   || 'http://localhost:3001';
const API_TOKEN = () => window.__API_TOKEN__ || '';
const CLIENT_ID = () => window.__CLIENT_ID__ || '';

const CATEGORY_COLORS: Record<string, string> = {
  support:   '#3b82f6',
  bug:       '#ef4444',
  frage:     '#f59e0b',
  bewerbung: '#22c55e',
  report:    '#f97316',
  sonstiges: '#6b7280',
};

// ── Toast ──────────────────────────────────────────────────────────────────

function toast(msg: string, type: 'success' | 'error' | 'info' = 'info', ms = 3000) {
  const wrap = document.getElementById('toast-container');
  if (!wrap) return;
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icons[type]}</span><span>${msg}</span>`;
  wrap.appendChild(el);
  setTimeout(() => {
    el.style.animation = 'toastOut 0.2s ease forwards';
    setTimeout(() => el.remove(), 200);
  }, ms);
}
(window as any).showToast = toast;

// ── API Helper ─────────────────────────────────────────────────────────────
// Einheitlicher Wrapper der Bearer-Auth und JSON-Handling übernimmt

async function api(
  method: string,
  path: string,
  body?: unknown
): Promise<any> {
  const res = await fetch(`${API_URL()}${path}`, {
    method,
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${API_TOKEN()}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

const GET  = (path: string)              => api('GET',  path);
const PUT  = (path: string, b: unknown)  => api('PUT',  path, b);
const POST = (path: string, b: unknown)  => api('POST', path, b);

// ── Aktive Guild ───────────────────────────────────────────────────────────

function getGuildId(): string {
  const sel = document.getElementById('guild-select') as HTMLSelectElement;
  return sel?.value || (window.__GUILD_ID__ ?? '');
}

// ── Live Stats laden ───────────────────────────────────────────────────────
// GET /api/bot/status

async function loadStats() {
  try {
    const s = await GET('/api/bot/status');

    // Stat-Cards
    setText('stat-guilds',  String(s.guilds  ?? '—'));
    setText('stat-users',   s.users?.toLocaleString('de-DE') ?? '—');
    setText('stat-ping',    s.ping != null ? `${s.ping}ms` : '—');
    setText('uptime-display', formatUptime(s.uptime));
    setText('latency-value',  s.ping != null ? `${s.ping}ms` : '—');
    setText('uptime-value',   formatUptime(s.uptime));
    setText('ping-display',   s.ping != null ? `${s.ping}ms` : '—');

    // Bot-Avatar & Name in Sidebar
    if (s.username) setText('sidebar-username', s.username);
    if (s.avatar) {
      const el = document.getElementById('sidebar-avatar');
      if (el && el.tagName !== 'IMG') {
        const img = document.createElement('img');
        img.src = s.avatar;
        img.style.cssText = 'width:28px;height:28px;border-radius:50%;object-fit:cover;';
        el.replaceWith(img);
      }
    }

    const online = s.status === 'online';
    setChip('bot-status-chip',  online);
    setChip('status-chip-card', online);
    const sv = document.getElementById('status-value');
    if (sv) { sv.textContent = online ? 'ONLINE' : 'OFFLINE'; sv.style.color = online ? 'var(--green)' : 'var(--red)'; }

  } catch {
    setChip('bot-status-chip',  false);
    setChip('status-chip-card', false);
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

// ── Guild-Liste laden ──────────────────────────────────────────────────────
// GET /api/bot/guilds

async function loadGuilds() {
  const container = document.getElementById('guild-list-container');
  const badge     = document.getElementById('guild-count-badge');
  const select    = document.getElementById('guild-select') as HTMLSelectElement | null;

  try {
    const guilds: any[] = await GET('/api/bot/guilds');

    if (badge)  badge.textContent  = `${guilds.length} Server`;

    // Guild-Select für Settings befüllen
    if (select) {
      select.innerHTML = guilds.map(g =>
        `<option value="${g.id}">${esc(g.name)}</option>`
      ).join('');
      // Beim Wechsel Tickets + Channels neu laden
      select.onchange = () => {
        loadTickets();
        loadChannelsAndRoles();
      };
    }

    if (!container) return;
    if (!guilds.length) { container.innerHTML = empty('Keine Server gefunden'); return; }

    container.innerHTML = guilds.map(g => {
      const icon = g.icon
        ? `<img src="${g.icon}" alt="" />`
        : `<span>${g.name[0]}</span>`;
      return `
        <div class="guild-row">
          <div class="guild-icon-img">${icon}</div>
          <div style="flex:1;">
            <div style="font-weight:600;font-size:14px;">${esc(g.name)}</div>
            <div style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);">
              ID: ${g.id} · ${g.memberCount?.toLocaleString('de-DE') ?? '?'} Mitglieder
            </div>
          </div>
          <span style="font-family:var(--font-mono);font-size:10px;padding:3px 8px;background:var(--green-glow);border:1px solid rgba(34,197,94,0.2);border-radius:4px;color:var(--green);">AKTIV</span>
        </div>`;
    }).join('');

  } catch {
    if (container) container.innerHTML = `<div style="padding:24px;text-align:center;color:var(--red);font-family:var(--font-mono);font-size:12px;">API nicht erreichbar</div>`;
  }
}

// ── Tickets laden ──────────────────────────────────────────────────────────
// GET /api/tickets/:guildId

async function loadTickets() {
  const guildId = getGuildId();
  if (!guildId) return;

  try {
    const tickets: any[] = await GET(`/api/tickets/${guildId}`);

    renderTickets('tickets-body',       tickets, true);
    renderTickets('tickets-full-body',  tickets, false);

    const count = String(tickets.length);
    setText('stat-tickets',       count);
    setText('tickets-badge',      `${count} offen`);
    setText('tickets-full-badge', `${count} offen`);
  } catch { /* ignore */ }
}

function renderTickets(id: string, tickets: any[], compact: boolean) {
  const el = document.getElementById(id);
  if (!el) return;

  if (!tickets.length) {
    el.innerHTML = `
      <div style="padding:32px;text-align:center;color:var(--text-muted);font-family:var(--font-mono);font-size:12px;display:flex;flex-direction:column;align-items:center;gap:8px;">
        <span style="font-size:28px;opacity:0.3;">🎫</span>
        <span>Keine offenen Tickets</span>
      </div>`;
    return;
  }

  const cols = compact
    ? 'grid-template-columns:70px 1fr 110px 80px 1fr'
    : 'grid-template-columns:70px 1fr 110px 1fr';

  el.innerHTML = tickets.map((t: any) => {
    const c = CATEGORY_COLORS[t.category] || '#888';
    const d = new Date(t.createdAt).toLocaleString('de-DE', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    });
    return `
      <div class="table-row" style="${cols};">
        <span class="table-id">#${String(t.ticketNumber).padStart(4, '0')}</span>
        <span class="table-user">${esc(t.userId)}</span>
        <span><span class="cat-badge" style="background:${c}18;color:${c}">${esc(t.category)}</span></span>
        ${compact ? `<span class="status-dot open">open</span>` : ''}
        <span class="table-time">${d}</span>
      </div>`;
  }).join('');
}

// ── Ticket-Config laden & speichern ────────────────────────────────────────
// GET /api/config/tickets/:guildId
// PUT /api/config/tickets/:guildId

async function loadTicketConfig() {
  const guildId = getGuildId();
  if (!guildId) return;

  try {
    const cfg = await GET(`/api/config/tickets/${guildId}`);
    if (!cfg) return;

    setVal('panel-title',          cfg.panelTitle       || '');
    setVal('panel-description',    cfg.panelDescription || '');
    setVal('log-channel-id',       cfg.logChannelId     || '');
    setVal('transcript-channel-id',cfg.transcriptChannelId || '');
    setVal('category-id',          cfg.categoryId       || '');
    setVal('support-role-id',      cfg.supportRoleId    || '');
  } catch { /* ignore */ }
}

// ── Channels & Rollen für Dropdowns laden ─────────────────────────────────
// GET /api/guild/:guildId/channels
// GET /api/guild/:guildId/roles

async function loadChannelsAndRoles() {
  const guildId = getGuildId();
  if (!guildId) return;

  try {
    const [channels, roles]: [any[], any[]] = await Promise.all([
      GET(`/api/guild/${guildId}/channels`),
      GET(`/api/guild/${guildId}/roles`),
    ]);

    // Channel-Dropdowns befüllen
    const textChannels  = channels.filter(c => c.type === 0);
    const categories    = channels.filter(c => c.type === 4);

    fillSelect('log-channel-select',        textChannels,  'Log-Channel wählen...');
    fillSelect('transcript-channel-select', textChannels,  'Transcript-Channel wählen...');
    fillSelect('ticket-category-select',    categories,    'Kategorie wählen...');

    // Rollen-Dropdowns befüllen
    fillSelect('support-role-select', roles, 'Support-Rolle wählen...');

    // Commands-Sektion: Rollen-Selects aktualisieren
    document.querySelectorAll<HTMLSelectElement>('[id^="cmd-role-select-"]').forEach(sel => {
      const current = sel.value;
      sel.innerHTML = `<option value="">Rolle auswählen...</option>` +
        roles.map(r => `<option value="${r.id}">${esc(r.name)}</option>`).join('');
      if (current) sel.value = current;
    });

  } catch { /* ignore */ }
}

function fillSelect(id: string, items: any[], placeholder: string) {
  const el = document.getElementById(id) as HTMLSelectElement | null;
  if (!el) return;
  el.innerHTML = `<option value="">${placeholder}</option>` +
    items.map(i => `<option value="${i.id}">${esc(i.name)}</option>`).join('');
}

// ── AntiNuke Config laden ──────────────────────────────────────────────────
// GET /api/config/antinuke/:guildId

async function loadAntiNukeConfig() {
  const guildId = getGuildId();
  if (!guildId) return;

  try {
    const cfg = await GET(`/api/config/antinuke/${guildId}`);
    if (!cfg) return;

    // Toggles setzen
    const toggles: Record<string, string> = {
      'antinuke-enabled':         'enabled',
      'antinuke-ban':             'banProtection',
      'antinuke-kick':            'kickProtection',
      'antinuke-channel-delete':  'channelDeleteProtection',
      'antinuke-role-delete':     'roleDeleteProtection',
      'antinuke-webhook':         'webhookProtection',
    };

    for (const [elId, key] of Object.entries(toggles)) {
      const input = document.getElementById(elId) as HTMLInputElement | null;
      if (input) input.checked = !!cfg[key];
    }
  } catch { /* ignore */ }
}

// ── Voice Support Config laden ─────────────────────────────────────────────
// GET /api/config/voicesupport/:guildId

async function loadVoiceConfig() {
  const guildId = getGuildId();
  if (!guildId) return;

  try {
    const cfg = await GET(`/api/config/voicesupport/${guildId}`);
    if (!cfg) return;
    setVal('voice-channel-id',  cfg.channelId  || '');
    setVal('voice-category-id', cfg.categoryId || '');
  } catch { /* ignore */ }
}

// ── Forms absenden ─────────────────────────────────────────────────────────

function initForms() {

  // Panel + Ticket-Config
  document.getElementById('panel-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const guildId = getGuildId();
    if (!guildId) return toast('Bitte zuerst einen Server auswählen', 'error');
    try {
      await PUT(`/api/config/tickets/${guildId}`, {
        panelTitle:           val('panel-title'),
        panelDescription:     val('panel-description') || null,
      });
      toast('Panel gespeichert!', 'success');
    } catch (e: any) { toast(e.message, 'error'); }
  });

  // Channel & Rollen IDs
  document.getElementById('channel-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const guildId = getGuildId();
    if (!guildId) return toast('Bitte zuerst einen Server auswählen', 'error');
    try {
      await PUT(`/api/config/tickets/${guildId}`, {
        logChannelId:        val('log-channel-id')        || val('log-channel-select')        || null,
        transcriptChannelId: val('transcript-channel-id') || val('transcript-channel-select') || null,
        categoryId:          val('category-id')           || val('ticket-category-select')    || null,
        supportRoleId:       val('support-role-id')       || val('support-role-select')       || null,
      });
      toast('Channel-Einstellungen gespeichert!', 'success');
    } catch (e: any) { toast(e.message, 'error'); }
  });

  // AntiNuke
  document.getElementById('antinuke-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const guildId = getGuildId();
    if (!guildId) return toast('Bitte zuerst einen Server auswählen', 'error');
    try {
      await PUT(`/api/config/antinuke/${guildId}`, {
        enabled:                  isChecked('antinuke-enabled'),
        banProtection:            isChecked('antinuke-ban'),
        kickProtection:           isChecked('antinuke-kick'),
        channelDeleteProtection:  isChecked('antinuke-channel-delete'),
        roleDeleteProtection:     isChecked('antinuke-role-delete'),
        webhookProtection:        isChecked('antinuke-webhook'),
      });
      toast('AntiNuke gespeichert!', 'success');
    } catch (e: any) { toast(e.message, 'error'); }
  });

  // Voice Support
  document.getElementById('voice-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const guildId = getGuildId();
    if (!guildId) return toast('Bitte zuerst einen Server auswählen', 'error');
    try {
      await PUT(`/api/config/voicesupport/${guildId}`, {
        channelId:  val('voice-channel-id')  || val('voice-channel-select')  || null,
        categoryId: val('voice-category-id') || val('voice-category-select') || null,
      });
      toast('Voice-Support gespeichert!', 'success');
    } catch (e: any) { toast(e.message, 'error'); }
  });
}

// ── Navigation ─────────────────────────────────────────────────────────────

function initNav() {
  document.querySelectorAll<HTMLElement>('.nav-item[data-section]').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      const section = item.dataset.section!;
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');

      const crumb = document.querySelector('.crumb-active');
      if (crumb) crumb.textContent = item.textContent?.trim() ?? '';

      document.querySelectorAll<HTMLElement>('.page-section').forEach(sec => {
        const show = sec.id === section;
        sec.style.display = show ? 'flex' : 'none';
        if (show) { sec.style.flexDirection = 'column'; sec.style.gap = '28px'; }
      });

      // Lazy-load beim ersten Öffnen
      if (section === 'settings') {
        loadTicketConfig();
        loadChannelsAndRoles();
      }
      if (section === 'antinuke') loadAntiNukeConfig();
      if (section === 'voice')    loadVoiceConfig();
    });
  });
}

// ── Pulse Bars ─────────────────────────────────────────────────────────────

function initPulseBars() {
  const container = document.getElementById('pulse-bar');
  if (!container) return;
  container.innerHTML = Array.from({ length: 32 }).map((_, i) =>
    `<div class="pulse-bar-item" style="height:${Math.floor(Math.random() * 80 + 15)}%;animation-delay:${i * 0.04}s"></div>`
  ).join('');
  setInterval(() => {
    container.querySelectorAll<HTMLElement>('.pulse-bar-item').forEach(b => {
      b.style.height  = `${Math.random() * 80 + 15}%`;
      b.style.opacity = `${Math.random() * 0.5 + 0.3}`;
    });
  }, 900);
}

// ── Refresh ────────────────────────────────────────────────────────────────

function initRefresh() {
  document.getElementById('refresh-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('refresh-btn')!;
    btn.classList.add('spinning');
    await Promise.allSettled([loadStats(), loadGuilds(), loadTickets()]);
    setTimeout(() => btn.classList.remove('spinning'), 500);
    toast('Aktualisiert!', 'success');
  });
}

// ── Invite Link ────────────────────────────────────────────────────────────

function initInvite() {
  const cid = CLIENT_ID();
  const url = cid
    ? `https://discord.com/oauth2/authorize?client_id=${cid}&permissions=8&scope=bot%20applications.commands`
    : null;

  const display = document.getElementById('invite-url-display');
  const linkBtn = document.getElementById('invite-link-btn') as HTMLAnchorElement | null;
  const copyBtn = document.getElementById('copy-invite-btn');

  if (url) {
    if (display) display.textContent = url;
    if (linkBtn) linkBtn.href = url;
  } else {
    if (display) display.textContent = 'PUBLIC_DISCORD_CLIENT_ID in .env setzen';
    if (linkBtn) { linkBtn.style.opacity = '0.4'; linkBtn.style.pointerEvents = 'none'; }
  }

  copyBtn?.addEventListener('click', () => {
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => toast('Link kopiert!', 'success'));
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────

function setText(id: string, v: string)         { const el = document.getElementById(id); if (el) el.textContent = v; }
function setVal(id: string, v: string)           { const el = document.getElementById(id) as HTMLInputElement; if (el) el.value = v; }
function val(id: string): string                 { return (document.getElementById(id) as HTMLInputElement)?.value?.trim() || ''; }
function isChecked(id: string): boolean          { return !!(document.getElementById(id) as HTMLInputElement)?.checked; }
function setChip(id: string, online: boolean)    {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = online ? '● ONLINE' : '● OFFLINE';
  el.className   = `status-chip ${online ? 'online' : 'offline'}`;
}
function esc(s: string): string {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function empty(msg: string): string {
  return `<div style="padding:24px;text-align:center;color:var(--text-muted);font-family:var(--font-mono);font-size:12px;">${msg}</div>`;
}

// ── Boot ───────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  initNav();
  initPulseBars();
  initRefresh();
  initForms();
  initInvite();

  // Erst Guilds laden (befüllt den Select), dann Stats + Tickets
  await loadGuilds();
  await Promise.allSettled([loadStats(), loadTickets()]);

  // Auto-Refresh
  setInterval(loadStats,   30_000);
  setInterval(loadTickets, 60_000);
});

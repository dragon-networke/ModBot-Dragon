require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.API_PORT || 3001;
const API_SECRET = process.env.API_SECRET || 'changeme';

app.use(express.json());
app.use(cors({
  origin: process.env.DASHBOARD_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Middleware: API-Key Authentifizierung
function requireAuth(req, res, next) {
  const auth = req.headers['authorization'];
  if (!auth || auth !== 'Bearer ' + API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Hilfsfunktionen
function loadJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) return {};
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (e) {
    return {};
  }
}

function saveJson(filePath, data) {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (e) {
    console.error('Fehler beim Speichern:', e.message);
    return false;
  }
}

const DATA_DIR = path.join(process.cwd(), 'data');

// ==================== BOT STATUS ====================

let botClient = null;

function setBotClient(client) {
  botClient = client;
}

app.get('/api/bot/status', requireAuth, (req, res) => {
  if (!botClient) {
    return res.json({ status: 'offline', guilds: 0, users: 0, ping: 0 });
  }
  res.json({
    status: 'online',
    guilds: botClient.guilds.cache.size,
    users: botClient.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0),
    ping: botClient.ws.ping,
    uptime: Math.floor(botClient.uptime / 1000),
    username: botClient.user?.username,
    avatar: botClient.user?.displayAvatarURL(),
  });
});

app.get('/api/bot/guilds', requireAuth, (req, res) => {
  if (!botClient) return res.json([]);
  const guilds = botClient.guilds.cache.map(g => ({
    id: g.id,
    name: g.name,
    icon: g.iconURL(),
    memberCount: g.memberCount,
  }));
  res.json(guilds);
});

// ==================== TICKET CONFIG ====================

app.get('/api/config/tickets/:guildId', requireAuth, (req, res) => {
  const config = loadJson(path.join(DATA_DIR, 'tickets.json'));
  res.json(config[req.params.guildId] || null);
});

app.put('/api/config/tickets/:guildId', requireAuth, (req, res) => {
  const config = loadJson(path.join(DATA_DIR, 'tickets.json'));
  config[req.params.guildId] = {
    ...config[req.params.guildId],
    ...req.body,
  };
  const ok = saveJson(path.join(DATA_DIR, 'tickets.json'), config);
  res.json({ success: ok });
});

app.get('/api/tickets/:guildId', requireAuth, (req, res) => {
  const config = loadJson(path.join(DATA_DIR, 'tickets.json'));
  const guildConfig = config[req.params.guildId];
  if (!guildConfig) return res.json([]);
  const tickets = Object.values(guildConfig.activeTickets || {});
  res.json(tickets);
});

// ==================== ANTINUKE CONFIG ====================

app.get('/api/config/antinuke/:guildId', requireAuth, (req, res) => {
  const config = loadJson(path.join(DATA_DIR, 'antinuke.json'));
  res.json(config[req.params.guildId] || null);
});

app.put('/api/config/antinuke/:guildId', requireAuth, (req, res) => {
  const config = loadJson(path.join(DATA_DIR, 'antinuke.json'));
  config[req.params.guildId] = {
    ...config[req.params.guildId],
    ...req.body,
  };
  const ok = saveJson(path.join(DATA_DIR, 'antinuke.json'), config);
  res.json({ success: ok });
});

// ==================== VOICE SUPPORT CONFIG ====================

app.get('/api/config/voicesupport/:guildId', requireAuth, (req, res) => {
  const config = loadJson(path.join(DATA_DIR, 'voiceSupport.json'));
  res.json(config[req.params.guildId] || null);
});

app.put('/api/config/voicesupport/:guildId', requireAuth, (req, res) => {
  const config = loadJson(path.join(DATA_DIR, 'voiceSupport.json'));
  config[req.params.guildId] = {
    ...config[req.params.guildId],
    ...req.body,
  };
  const ok = saveJson(path.join(DATA_DIR, 'voiceSupport.json'), config);
  res.json({ success: ok });
});

// ==================== APPEAL CONFIG ====================

app.get('/api/config/appeal/:guildId', requireAuth, (req, res) => {
  const config = loadJson(path.join(DATA_DIR, 'appealConfig.json'));
  res.json(config[req.params.guildId] || null);
});

app.put('/api/config/appeal/:guildId', requireAuth, (req, res) => {
  const config = loadJson(path.join(DATA_DIR, 'appealConfig.json'));
  config[req.params.guildId] = {
    ...config[req.params.guildId],
    ...req.body,
  };
  const ok = saveJson(path.join(DATA_DIR, 'appealConfig.json'), config);
  res.json({ success: ok });
});

// ==================== APPEALS ====================

// Alle Appeals einer Guild (optional nach Status filtern)
app.get('/api/appeals/:guildId', requireAuth, (req, res) => {
  const appeals = loadJson(path.join(DATA_DIR, 'appeals.json'));
  const guildAppeals = Object.values(appeals[req.params.guildId] || {});

  const { status } = req.query;
  const filtered = status
    ? guildAppeals.filter(a => a.status === status)
    : guildAppeals;

  filtered.sort((a, b) => b.createdAt - a.createdAt);
  res.json(filtered);
});

// Einzelnes Appeal
app.get('/api/appeals/:guildId/:appealId', requireAuth, (req, res) => {
  const appeals = loadJson(path.join(DATA_DIR, 'appeals.json'));
  const appeal  = appeals[req.params.guildId]?.[req.params.appealId];
  if (!appeal) return res.status(404).json({ error: 'Appeal nicht gefunden' });
  res.json(appeal);
});

// Appeal Status ändern
app.patch('/api/appeals/:guildId/:appealId', requireAuth, async (req, res) => {
  const { status, reviewNote } = req.body;
  const validStatuses = ['pending', 'accepted', 'denied'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Ungültiger Status' });
  }

  const appeals = loadJson(path.join(DATA_DIR, 'appeals.json'));
  const appeal  = appeals[req.params.guildId]?.[req.params.appealId];
  if (!appeal) return res.status(404).json({ error: 'Appeal nicht gefunden' });

  appeal.status     = status;
  appeal.reviewNote = reviewNote || appeal.reviewNote;
  appeal.reviewedAt = Date.now();

  saveJson(path.join(DATA_DIR, 'appeals.json'), appeals);

  // User per DM benachrichtigen wenn Bot-Client verfügbar
  if (botClient && status !== 'pending') {
    try {
      const { EmbedBuilder } = require('discord.js');
      const user   = await botClient.users.fetch(appeal.userId);
      const guild  = botClient.guilds.cache.get(req.params.guildId);
      const colors = { accepted: 0x22c55e, denied: 0xef4444 };
      const labels = { accepted: 'angenommen ✅', denied: 'abgelehnt ❌' };

      await user.send({
        embeds: [
          new EmbedBuilder()
            .setTitle(`Dein Appeal wurde ${labels[status]}`)
            .setColor(colors[status])
            .setDescription(
              `**Server:** ${guild?.name || req.params.guildId}\n\n` +
              (reviewNote ? `**Begründung:**\n${reviewNote}` : '')
            )
            .setTimestamp(),
        ],
      }).catch(() => {});
    } catch { /* User nicht erreichbar */ }
  }

  res.json({ success: true, appeal });
});

// Appeal löschen
app.delete('/api/appeals/:guildId/:appealId', requireAuth, (req, res) => {
  const appeals = loadJson(path.join(DATA_DIR, 'appeals.json'));
  if (!appeals[req.params.guildId]?.[req.params.appealId]) {
    return res.status(404).json({ error: 'Appeal nicht gefunden' });
  }
  delete appeals[req.params.guildId][req.params.appealId];
  saveJson(path.join(DATA_DIR, 'appeals.json'), appeals);
  res.json({ success: true });
});

// ==================== GUILD CHANNELS & ROLES ====================

app.get('/api/guild/:guildId/channels', requireAuth, async (req, res) => {
  if (!botClient) return res.json([]);
  try {
    const guild = botClient.guilds.cache.get(req.params.guildId);
    if (!guild) return res.json([]);
    const channels = guild.channels.cache
      .filter(c => [0, 2, 4].includes(c.type))
      .map(c => ({ id: c.id, name: c.name, type: c.type }));
    res.json(channels);
  } catch (e) {
    res.json([]);
  }
});

app.get('/api/guild/:guildId/roles', requireAuth, async (req, res) => {
  if (!botClient) return res.json([]);
  try {
    const guild = botClient.guilds.cache.get(req.params.guildId);
    if (!guild) return res.json([]);
    const roles = guild.roles.cache
      .filter(r => r.id !== guild.id)
      .map(r => ({ id: r.id, name: r.name, color: r.hexColor }));
    res.json(roles);
  } catch (e) {
    res.json([]);
  }
});


// ==================== MEMBERS ====================

app.get('/api/guild/:guildId/members', requireAuth, async (req, res) => {
  if (!botClient) return res.json([]);
  try {
    const guild   = botClient.guilds.cache.get(req.params.guildId);
    if (!guild) return res.json([]);
    const members = await guild.members.fetch();
    res.json(members.map(m => ({
      id:       m.id,
      username: m.user.username,
      nickname: m.nickname,
      avatar:   m.user.displayAvatarURL(),
      roles:    m.roles.cache.filter(r => r.id !== guild.id).map(r => r.name),
      joinedAt: m.joinedTimestamp,
    })));
  } catch (e) { res.json([]); }
});

app.get('/api/guild/:guildId/member/:userId', requireAuth, async (req, res) => {
  if (!botClient) return res.status(503).json({ error: 'Bot nicht verfügbar' });
  try {
    const guild  = botClient.guilds.cache.get(req.params.guildId);
    if (!guild) return res.status(404).json({ error: 'Guild nicht gefunden' });
    const member = await guild.members.fetch(req.params.userId);
    res.json({
      id:       member.id,
      username: member.user.username,
      nickname: member.nickname,
      avatar:   member.user.displayAvatarURL(),
      roles:    member.roles.cache.filter(r => r.id !== guild.id).map(r => r.name),
      joinedAt: member.joinedTimestamp,
    });
  } catch (e) { res.status(404).json({ error: 'Nutzer nicht gefunden' }); }
});

app.post('/api/guild/:guildId/member/:userId/ban', requireAuth, async (req, res) => {
  if (!botClient) return res.status(503).json({ error: 'Bot nicht verfügbar' });
  try {
    const guild = botClient.guilds.cache.get(req.params.guildId);
    if (!guild) return res.status(404).json({ error: 'Guild nicht gefunden' });
    await guild.members.ban(req.params.userId, { reason: req.body.reason || 'Dashboard Aktion' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/guild/:guildId/member/:userId/kick', requireAuth, async (req, res) => {
  if (!botClient) return res.status(503).json({ error: 'Bot nicht verfügbar' });
  try {
    const guild  = botClient.guilds.cache.get(req.params.guildId);
    if (!guild) return res.status(404).json({ error: 'Guild nicht gefunden' });
    const member = await guild.members.fetch(req.params.userId);
    await member.kick(req.body.reason || 'Dashboard Aktion');
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/guild/:guildId/member/:userId/role', requireAuth, async (req, res) => {
  if (!botClient) return res.status(503).json({ error: 'Bot nicht verfügbar' });
  try {
    const { roleId, action } = req.body;
    const guild  = botClient.guilds.cache.get(req.params.guildId);
    if (!guild) return res.status(404).json({ error: 'Guild nicht gefunden' });
    const member = await guild.members.fetch(req.params.userId);
    if (action === 'add')    await member.roles.add(roleId);
    if (action === 'remove') await member.roles.remove(roleId);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==================== TRANSCRIPTS ====================

app.get('/api/transcripts/:guildId', requireAuth, (req, res) => {
  const data = loadJson(path.join(DATA_DIR, 'transcripts.json'));
  const list = Object.values(data[req.params.guildId] || {});
  list.sort((a, b) => (b.closedAt || 0) - (a.closedAt || 0));
  res.json(list);
});

app.get('/api/transcripts/:guildId/:ticketNumber', requireAuth, (req, res) => {
  const data       = loadJson(path.join(DATA_DIR, 'transcripts.json'));
  const guildData  = data[req.params.guildId] || {};
  const transcript = Object.values(guildData).find(t => String(t.ticketNumber) === req.params.ticketNumber);
  if (!transcript) return res.status(404).json({ error: 'Transcript nicht gefunden' });
  res.json(transcript);
});

// ==================== GUILD ACTIONS ====================

app.post('/api/guild/:guildId/close-all-tickets', requireAuth, (req, res) => {
  const config = loadJson(path.join(DATA_DIR, 'tickets.json'));
  if (config[req.params.guildId]) {
    config[req.params.guildId].activeTickets = {};
    saveJson(path.join(DATA_DIR, 'tickets.json'), config);
  }
  res.json({ success: true });
});

app.post('/api/guild/:guildId/leave', requireAuth, async (req, res) => {
  if (!botClient) return res.status(503).json({ error: 'Bot nicht verfügbar' });
  try {
    const guild = botClient.guilds.cache.get(req.params.guildId);
    if (!guild) return res.status(404).json({ error: 'Guild nicht gefunden' });
    await guild.leave();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==================== HEALTH CHECK ====================

app.get('/api/health', (req, res) => {
  res.json({ ok: true, timestamp: Date.now() });
});

// ==================== API STARTEN ====================

function startApi(client) {
  botClient = client;
  app.listen(port, () => {
    console.log('[API] Laeuft auf http://localhost:' + port);
  });
}

module.exports = { startApi, setBotClient };
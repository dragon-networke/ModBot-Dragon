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
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
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
  const guildConfig = config[req.params.guildId] || null;
  res.json(guildConfig);
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

// ==================== HEALTH CHECK ====================

app.get('/api/health', (req, res) => {
  res.json({ ok: true, timestamp: Date.now() });
});

// API starten
function startApi(client) {
  botClient = client;
  app.listen(port, () => {
    console.log('[API] Laeuft auf http://localhost:' + port);
  });
}

module.exports = { startApi, setBotClient };
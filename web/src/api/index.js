// src/api/index.js  ← Finale Version für Vercel + Astro Dashboard

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const API_SECRET = process.env.API_SECRET || 'changeme';

app.use(express.json());

app.use(cors({
  origin: process.env.DASHBOARD_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Auth Middleware
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

let botClient = null;

function setBotClient(client) {
  botClient = client;
}

// ==================== ROUTEN (ohne /api/ Prefix) ====================

app.get('/bot/status', requireAuth, (req, res) => {
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

app.get('/bot/guilds', requireAuth, (req, res) => {
  if (!botClient) return res.json([]);
  const guilds = botClient.guilds.cache.map(g => ({
    id: g.id,
    name: g.name,
    icon: g.iconURL(),
    memberCount: g.memberCount,
  }));
  res.json(guilds);
});

// Ticket Config
app.get('/config/tickets/:guildId', requireAuth, (req, res) => {
  const config = loadJson(path.join(DATA_DIR, 'tickets.json'));
  res.json(config[req.params.guildId] || null);
});

app.put('/config/tickets/:guildId', requireAuth, (req, res) => {
  const config = loadJson(path.join(DATA_DIR, 'tickets.json'));
  config[req.params.guildId] = { ...config[req.params.guildId], ...req.body };
  const ok = saveJson(path.join(DATA_DIR, 'tickets.json'), config);
  res.json({ success: ok });
});

app.get('/tickets/:guildId', requireAuth, (req, res) => {
  const config = loadJson(path.join(DATA_DIR, 'tickets.json'));
  const guildConfig = config[req.params.guildId];
  if (!guildConfig) return res.json([]);
  res.json(Object.values(guildConfig.activeTickets || {}));
});

// AntiNuke
app.get('/config/antinuke/:guildId', requireAuth, (req, res) => {
  const config = loadJson(path.join(DATA_DIR, 'antinuke.json'));
  res.json(config[req.params.guildId] || null);
});

app.put('/config/antinuke/:guildId', requireAuth, (req, res) => {
  const config = loadJson(path.join(DATA_DIR, 'antinuke.json'));
  config[req.params.guildId] = { ...config[req.params.guildId], ...req.body };
  const ok = saveJson(path.join(DATA_DIR, 'antinuke.json'), config);
  res.json({ success: ok });
});

// Voice Support
app.get('/config/voicesupport/:guildId', requireAuth, (req, res) => {
  const config = loadJson(path.join(DATA_DIR, 'voiceSupport.json'));
  res.json(config[req.params.guildId] || null);
});

app.put('/config/voicesupport/:guildId', requireAuth, (req, res) => {
  const config = loadJson(path.join(DATA_DIR, 'voiceSupport.json'));
  config[req.params.guildId] = { ...config[req.params.guildId], ...req.body };
  const ok = saveJson(path.join(DATA_DIR, 'voiceSupport.json'), config);
  res.json({ success: ok });
});

// Appeal Config
app.get('/config/appeal/:guildId', requireAuth, (req, res) => {
  const config = loadJson(path.join(DATA_DIR, 'appealConfig.json'));
  res.json(config[req.params.guildId] || null);
});

app.put('/config/appeal/:guildId', requireAuth, (req, res) => {
  const config = loadJson(path.join(DATA_DIR, 'appealConfig.json'));
  config[req.params.guildId] = { ...config[req.params.guildId], ...req.body };
  const ok = saveJson(path.join(DATA_DIR, 'appealConfig.json'), config);
  res.json({ success: ok });
});

// Appeals
app.get('/appeals/:guildId', requireAuth, (req, res) => {
  const appeals = loadJson(path.join(DATA_DIR, 'appeals.json'));
  const guildAppeals = Object.values(appeals[req.params.guildId] || {});
  const { status } = req.query;
  const filtered = status ? guildAppeals.filter(a => a.status === status) : guildAppeals;
  filtered.sort((a, b) => b.createdAt - a.createdAt);
  res.json(filtered);
});

app.patch('/appeals/:guildId/:appealId', requireAuth, async (req, res) => {
  const { status, reviewNote } = req.body;
  const validStatuses = ['pending', 'accepted', 'denied'];
  if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Ungültiger Status' });

  const appeals = loadJson(path.join(DATA_DIR, 'appeals.json'));
  const appeal = appeals[req.params.guildId]?.[req.params.appealId];
  if (!appeal) return res.status(404).json({ error: 'Appeal nicht gefunden' });

  appeal.status = status;
  appeal.reviewNote = reviewNote || appeal.reviewNote;
  appeal.reviewedAt = Date.now();

  saveJson(path.join(DATA_DIR, 'appeals.json'), appeals);
  res.json({ success: true, appeal });
});

app.delete('/appeals/:guildId/:appealId', requireAuth, (req, res) => {
  const appeals = loadJson(path.join(DATA_DIR, 'appeals.json'));
  if (!appeals[req.params.guildId]?.[req.params.appealId]) return res.status(404).json({ error: 'Appeal nicht gefunden' });
  delete appeals[req.params.guildId][req.params.appealId];
  saveJson(path.join(DATA_DIR, 'appeals.json'), appeals);
  res.json({ success: true });
});

// Guild Channels & Roles
app.get('/guild/:guildId/channels', requireAuth, async (req, res) => {
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

app.get('/guild/:guildId/roles', requireAuth, async (req, res) => {
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

// Health Check
app.get('/health', (req, res) => {
  res.json({ ok: true, timestamp: Date.now() });
});

// WICHTIG für Vercel
module.exports = app;
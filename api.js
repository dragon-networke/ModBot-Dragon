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

// ==================== BOT CLIENT ====================

let botClient = null;

function setBotClient(client) {
  botClient = client;
}

// ==================== BOT STATUS ====================

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
  });
});

// ==================== SERVER DES BOTS (nur wo Bot drin ist) ====================

app.get('/bot/guilds', requireAuth, (req, res) => {
  if (!botClient) return res.json([]);
  const guilds = botClient.guilds.cache.map(g => ({
    id: g.id,
    name: g.name,
    icon: g.iconURL(),
    memberCount: g.memberCount,
    bot_in_guild: true
  }));
  res.json(guilds);
});

// ==================== ALLE SERVER DES USERS (Admin-Rechte) ====================

app.get('/bot/user-guilds', requireAuth, async (req, res) => {
  if (!botClient) return res.json([]);

  try {
    // Hier brauchst du den User Access Token aus dem Login-Flow
    // Für den Anfang nutzen wir eine vereinfachte Version mit botClient
    const userGuilds = botClient.guilds.cache.map(g => ({
      id: g.id,
      name: g.name,
      icon: g.iconURL(),
      memberCount: g.memberCount,
      bot_in_guild: true,
      permissions: "Administrator" // Platzhalter
    }));

    res.json(userGuilds);

  } catch (e) {
    console.error('Fehler beim Laden der User-Guilds:', e);
    res.json([]);
  }
});

// ==================== COMMANDS ====================

app.get('/bot/commands', requireAuth, (req, res) => {
  if (!botClient) return res.json([]);

  try {
    const slashCommands = botClient.application?.commands.cache.map(cmd => ({
      id: cmd.name.toLowerCase().replace(/\s+/g, ''),
      name: cmd.name,
      description: cmd.description || 'Keine Beschreibung',
      enabled: true,
      type: 'slash'
    })) || [];

    const manualCommands = [
      { id: "antinuke", name: "AntiNuke", description: "Schützt den Server vor Massen-Aktionen", enabled: true },
      { id: "appeal", name: "Appeal", description: "Ban-Appeal System", enabled: true },
      { id: "bannliste", name: "Bannliste", description: "Zeigt die Bannliste", enabled: true },
      { id: "music", name: "Music", description: "Musik-Bot Funktionen", enabled: true },
      { id: "level", name: "Level System", description: "Leveling & XP System", enabled: true },
      { id: "logging", name: "Logging", description: "Server-Log System", enabled: true },
      { id: "voicesupport", name: "Voice Support", description: "Temporäre Voice Channels", enabled: true },
      { id: "ticketpanel", name: "Ticket Panel", description: "Ticket-Erstellung Panel", enabled: true },
    ];

    res.json([...slashCommands, ...manualCommands]);

  } catch (e) {
    console.error('Fehler beim Laden der Commands:', e);
    res.json([]);
  }
});

// ==================== RESTLICHE ROUTEN (unverändert) ====================

// ... (deine bestehenden Routen für tickets, antinuke, voicesupport, appeals usw. bleiben gleich)

// ==================== API STARTEN ====================

function startApi(client) {
  botClient = client;
  app.listen(port, () => {
    console.log(`[API] Läuft auf http://localhost:${port}`);
  });
}

module.exports = { startApi, setBotClient };
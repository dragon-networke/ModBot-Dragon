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

function requireAuth(req, res, next) {
  const auth = req.headers['authorization'];
  if (!auth || auth !== 'Bearer ' + API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Hilfsfunktionen (unverändert)
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

// ==================== BOT STATUS ====================

app.get('/bot/status', requireAuth, (req, res) => {
  if (!botClient) return res.json({ status: 'offline', guilds: 0, users: 0, ping: 0 });
  res.json({
    status: 'online',
    guilds: botClient.guilds.cache.size,
    users: botClient.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0),
    ping: botClient.ws.ping,
    uptime: Math.floor(botClient.uptime / 1000),
  });
});

// ==================== SERVER, AUF DENEN DER BOT BEREITS IST ====================

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

// ==================== ALLE SERVER, AUF DENEN DER USER ADMIN/OWNER IST ====================

app.get('/bot/user-guilds', requireAuth, async (req, res) => {
  if (!botClient) return res.json([]);

  try {
    const userGuilds = [];

    // Hole alle Guilds, in denen der Bot ist
    for (const guild of botClient.guilds.cache.values()) {
      try {
        const member = await guild.members.fetch(botClient.user.id);
        const isAdmin = member.permissions.has('Administrator') || guild.ownerId === botClient.user.id;

        userGuilds.push({
          id: guild.id,
          name: guild.name,
          icon: guild.iconURL(),
          memberCount: guild.memberCount,
          bot_in_guild: true,
          isAdmin: isAdmin
        });
      } catch (e) {
        continue;
      }
    }

    res.json(userGuilds);

  } catch (e) {
    console.error('Fehler beim Laden der User-Guilds:', e);
    res.json([]);
  }
});

// ==================== COMMANDS (unverändert) ====================

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

// ==================== USER GUILDS (ALL) ====================

app.get('/bot/all-user-guilds', requireAuth, async (req, res) => {
  const discordToken = req.headers['x-discord-token'];
  if (!discordToken) {
    return res.status(400).json({ error: 'Discord Token erforderlich' });
  }

  try {
    // Hole alle Guilds des Users vom Discord API
    const response = await fetch('https://discord.com/api/users/@me/guilds', {
      headers: { Authorization: 'Bearer ' + discordToken }
    });

    if (!response.ok) {
      return res.status(401).json({ error: 'Ungültiger Discord Token' });
    }

    const userGuilds = await response.json();

    // Hole alle Guilds, auf denen der Bot ist
    const botGuildIds = new Set(botClient?.guilds.cache.keys() || []);
    
    console.log('Bot Guild IDs:', Array.from(botGuildIds));
    console.log('User Guilds Count:', userGuilds.length);

    // Filter: Guilds wo User Admin/Owner ist
    const filteredGuilds = userGuilds
      .filter(g => {
        // Check Admin permission (0x8) or Manage Guild permission (0x20)
        const hasPermission = (g.permissions & 0x8) === 0x8 || (g.permissions & 0x20) === 0x20;
        return hasPermission;
      })
      .map(g => {
        const isBotInGuild = botGuildIds.has(g.id);
        return {
          id: g.id,
          name: g.name,
          icon: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png` : null,
          bot_in_guild: isBotInGuild
        };
      });

    console.log('Filtered Guilds:', filteredGuilds.map(g => ({ name: g.name, bot_in_guild: g.bot_in_guild })));

    res.json(filteredGuilds);

  } catch (e) {
    console.error('Fehler beim Laden der User-Guilds:', e);
    res.status(500).json({ error: e.message });
  }
});

// ==================== RESTLICHE ROUTEN (unverändert lassen) ====================

// Deine bestehenden Routen für tickets, antinuke, voicesupport, appeals usw. bleiben gleich

// ==================== API STARTEN ====================

function startApi(client) {
  botClient = client;
  app.listen(port, () => {
    console.log(`[API] Läuft auf http://localhost:${port}`);
  });
}

module.exports = { startApi, setBotClient };

// --- Serve frontend when built -------------------------------------------------
// If the Astro/Vite build exists at /web/dist, serve it as static files so the
// same server can provide the frontend and the API.
const webDist = path.join(process.cwd(), 'web', 'dist');
if (fs.existsSync(webDist)) {
  app.use(express.static(webDist));
  console.log('[API] Serving static site from', webDist);

  // Fallback: serve index.html for non-API routes (SPA support)
  app.get('*', (req, res, next) => {
    // Let API routes continue to their handlers
    if (req.path.startsWith('/bot') || req.path.startsWith('/api')) return next();

    const filePath = path.join(webDist, req.path);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return res.sendFile(filePath);
    }
    return res.sendFile(path.join(webDist, 'index.html'));
  });

} else {
  console.log('[API] No built web site found at', webDist, '- run `npm run build` inside /web to generate it.');
}
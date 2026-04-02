/**
 * src/scripts/config.js
 * Zentrale Konfiguration für alle Dashboard-Seiten
 */

const API_URL   = window.__API_URL__   || '/api';
const API_TOKEN = window.__API_TOKEN__ || '';
const CLIENT_ID = window.__CLIENT_ID__ || '';
const GUILD_ID  = window.__GUILD_ID__  || '';

// Globale Variablen für alle Scripts verfügbar machen
window.__API_URL__   = API_URL;
window.__API_TOKEN__ = API_TOKEN;
window.__CLIENT_ID__ = CLIENT_ID;
window.__GUILD_ID__  = GUILD_ID;

console.log('[Config] API_URL gesetzt auf:', API_URL);
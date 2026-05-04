import { getDiscordGuilds } from '../lib/discord';

export async function loadUserGuilds(accessToken: string, apiSecret: string, apiUrl: string = '/api') {
  try {
    // Hole alle Guilds des Users vom Discord
    const userGuilds = await getDiscordGuilds(accessToken);
    
    // Frage den Bot-Status ab
    const response = await fetch(`${apiUrl}/bot/all-user-guilds`, {
      headers: {
        'Authorization': `Bearer ${apiSecret}`,
        'x-discord-token': accessToken,
      }
    });

    if (!response.ok) {
      throw new Error('Failed to load bot guilds');
    }

    return await response.json();
  } catch (error) {
    console.error('Fehler beim Laden der Guilds:', error);
    return [];
  }
}

export async function getClientId() {
  return import.meta.env.PUBLIC_DISCORD_CLIENT_ID || '1442980448597708892';
}

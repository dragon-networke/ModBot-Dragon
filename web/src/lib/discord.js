const DISCORD_CLIENT_ID = import.meta.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = import.meta.env.DISCORD_CLIENT_SECRET;
const DISCORD_REDIRECT_URI = import.meta.env.DISCORD_REDIRECT_URI;

export function getOAuthURL() {
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify guilds',
  });
  return 'https://discord.com/api/oauth2/authorize?' + params.toString();
}

export async function exchangeCode(code) {
  const res = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: DISCORD_CLIENT_ID,
      client_secret: DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: DISCORD_REDIRECT_URI,
    }),
  });
  if (!res.ok) throw new Error('OAuth Fehler');
  return res.json();
}

export async function getDiscordUser(accessToken) {
  const res = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: 'Bearer ' + accessToken },
  });
  if (!res.ok) throw new Error('User Fehler');
  return res.json();
}

export async function getDiscordGuilds(accessToken) {
  const res = await fetch('https://discord.com/api/users/@me/guilds', {
    headers: { Authorization: 'Bearer ' + accessToken },
  });
  if (!res.ok) throw new Error('Guilds Fehler');
  return res.json();
}
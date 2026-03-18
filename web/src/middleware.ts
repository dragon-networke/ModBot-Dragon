import { defineMiddleware } from 'astro:middleware';

// Seiten die KEIN Login brauchen
const PUBLIC_PATHS = ['/login', '/auth/callback', '/auth/logout'];

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  // Öffentliche Seiten durchlassen
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return next();
  }

  // Session-Cookie prüfen
  const session = context.cookies.get('session')?.value;

  if (!session) {
    return context.redirect('/login');
  }

  try {
    // Session dekodieren (Base64 JSON)
    const data = JSON.parse(Buffer.from(session, 'base64').toString('utf-8'));

    // Abgelaufen?
    if (data.expires && Date.now() > data.expires) {
      context.cookies.delete('session', { path: '/' });
      return context.redirect('/login');
    }

    // User in locals für alle Seiten verfügbar machen
    context.locals.user    = data.user;
    context.locals.guildId = context.cookies.get('selectedGuild')?.value || null;

  } catch {
    context.cookies.delete('session', { path: '/' });
    return context.redirect('/login');
  }

  return next();
});

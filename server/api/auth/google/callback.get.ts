import type { H3Event } from 'h3';
import { getRequestHeader } from 'h3';
import { getPublicOrigin } from '~/server/utils/publicOrigin';
import { useDb } from '~/server/utils/db';
import { log, logEnvSnapshot } from '~/server/utils/log';

export default defineEventHandler(async (event: H3Event) => {
  log(event, 'INFO', 'google:callback:hit');
  logEnvSnapshot(event);

  const query = getQuery(event);
  const code = query.code ? String(query.code) : '';

  if (!code) {
    log(event, 'WARN', 'google:callback:no_code', { query });
    event.node.res.writeHead(302, { Location: '/login?error=no_code' });
    event.node.res.end();
    return;
  }

  const config = useRuntimeConfig();
  const googleClientId = (config.googleClientId || process.env.GOOGLE_CLIENT_ID || '').toString().trim();
  const googleClientSecret = (config.googleClientSecret || process.env.GOOGLE_CLIENT_SECRET || '').toString().trim();

  if (!googleClientId || !googleClientSecret) {
    log(event, 'ERROR', 'google:callback:missing_google_env', {
      hasClientId: !!googleClientId,
      hasClientSecret: !!googleClientSecret
    });
    event.node.res.writeHead(302, { Location: '/login?error=server_error' });
    event.node.res.end();
    return;
  }

  const baseUrl = getPublicOrigin(event);
  const redirectUri = `${baseUrl}/api/auth/google/callback`;

  const xfProto = String(getRequestHeader(event, 'x-forwarded-proto') || '');
  const arrSsl = Boolean(getRequestHeader(event, 'x-arr-ssl'));

  log(event, 'DEBUG', 'google:callback:computed', {
    baseUrl,
    redirectUri,
    xfProto,
    arrSsl
  });

  try {
    // 1) token exchange
    log(event, 'DEBUG', 'google:token:request', { redirectUri });

    const tokenResponse: any = await $fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      body: new URLSearchParams({
        code,
        client_id: googleClientId,
        client_secret: googleClientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });

    log(event, 'DEBUG', 'google:token:response', {
      keys: Object.keys(tokenResponse || {}),
      hasAccessToken: !!tokenResponse?.access_token,
      tokenType: tokenResponse?.token_type || null,
      expiresIn: tokenResponse?.expires_in || null
    });

    // 2) profile
    const googleUser: any = await $fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
    });

    const email = String(googleUser?.email || '');
    const domain = email.includes('@') ? email.split('@')[1] : '';

    log(event, 'DEBUG', 'google:userinfo', {
      hasEmail: !!email,
      domain,
      subPresent: !!googleUser?.sub,
      picturePresent: !!googleUser?.picture
    });

    // 3) DB lookup / create
    const db = await useDb();

    const [rows]: any = await db.execute(
      `SELECT u.*, p.nombre as plantel_nombre, r.nombre as role_name, r.nivel_permiso
       FROM users u
       LEFT JOIN planteles p ON u.plantel_id = p.id
       JOIN roles r ON u.role_id = r.id
       WHERE u.email = ?`,
      [email]
    );

    let user = rows[0];
    log(event, 'DEBUG', 'db:user:lookup', { found: !!user });

    if (!user) {
      const allowedDomains = ['casitaiedis.edu.mx', 'iedis.edu.mx', 'gmail.com'];
      if (!allowedDomains.includes(domain)) {
        log(event, 'WARN', 'db:user:blocked_domain', { domain });
        event.node.res.writeHead(302, { Location: '/login?error=unauthorized_domain' });
        event.node.res.end();
        return;
      }

      const [roles]: any = await db.execute('SELECT id FROM roles WHERE nivel_permiso = 1 LIMIT 1');
      const defaultRoleId = roles?.[0]?.id ?? 2;

      const [result]: any = await db.execute(
        `INSERT INTO users (nombre, email, google_id, avatar_url, role_id, activo)
         VALUES (?, ?, ?, ?, ?, 1)`,
        [googleUser.name, email, googleUser.sub || googleUser.id, googleUser.picture, defaultRoleId]
      );

      log(event, 'INFO', 'db:user:created', { id: result.insertId });

      const [newUserRows]: any = await db.execute(
        `SELECT u.*, p.nombre as plantel_nombre, r.nombre as role_name, r.nivel_permiso
         FROM users u
         LEFT JOIN planteles p ON u.plantel_id = p.id
         JOIN roles r ON u.role_id = r.id
         WHERE u.id = ?`,
        [result.insertId]
      );

      user = newUserRows[0];
    } else {
      await db.execute('UPDATE users SET google_id = ?, avatar_url = ? WHERE id = ?', [
        googleUser.sub || googleUser.id,
        googleUser.picture,
        user.id
      ]);
      log(event, 'INFO', 'db:user:updated', { id: user.id });
    }

    const isHttps =
      baseUrl.startsWith('https://') ||
      Boolean(getRequestHeader(event, 'x-arr-ssl')) ||
      String(getRequestHeader(event, 'x-forwarded-proto') || '').startsWith('https');

    const sessionUser = {
      id: user.id,
      nombre: user.nombre,
      email: user.email,
      role_name: user.role_name,
      role_level: user.nivel_permiso,
      plantel_id: user.plantel_id || null,
      plantel_nombre: user.plantel_nombre || 'Sin Asignar',
      avatar: googleUser.picture
    };

    setCookie(event, 'user', JSON.stringify(sessionUser), {
      httpOnly: false,
      secure: isHttps,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/'
    });

    log(event, 'INFO', 'google:callback:success', { userId: user.id });

    event.node.res.writeHead(302, { Location: '/' });
    event.node.res.end();
  } catch (err: any) {
    // ofetch errors often expose: statusCode, data
    log(event, 'ERROR', 'google:callback:failed', {
      message: err?.message,
      statusCode: err?.statusCode || err?.status,
      data: err?.data ? { ...err.data, access_token: undefined, refresh_token: undefined } : undefined
    });

    event.node.res.writeHead(302, { Location: '/login?error=server_error' });
    event.node.res.end();
  }
});

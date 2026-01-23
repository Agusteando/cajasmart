import type { H3Event } from 'h3';
import { getRequestHeader } from 'h3';
import { useDb } from '~/server/utils/db';
import { getPublicOrigin } from '~/server/utils/publicOrigin';
import { htmlRedirect } from '~/server/utils/htmlRedirect';
import { log, logEnvSnapshot, logStep } from '~/server/utils/log';

function extractFetchError(err: any) {
  // ofetch FetchError usually has: err.response.status, err.response._data
  const status = err?.response?.status ?? err?.status;
  const data = err?.response?._data ?? err?.data;
  return { status, data, message: err?.message };
}

export default defineEventHandler(async (event: H3Event) => {
  logStep(event, 'callback:hit');

  const query = getQuery(event);
  const code = query.code ? String(query.code) : '';
  const scope = query.scope ? String(query.scope) : '';
  const error = query.error ? String(query.error) : '';

  // Google can send ?error=access_denied when user cancels
  if (error) {
    log(event, 'WARN', 'google:callback returned error from google', { error });
    return htmlRedirect(event, '/login?error=no_code');
  }

  if (!code) {
    log(event, 'WARN', 'google:callback missing code', { scope });
    return htmlRedirect(event, '/login?error=no_code');
  }

  const cfg = useRuntimeConfig() as any;

  const googleClientId =
    String(cfg.googleClientId || process.env.GOOGLE_CLIENT_ID || '').trim();
  const googleClientSecret =
    String(cfg.googleClientSecret || process.env.GOOGLE_CLIENT_SECRET || '').trim();

  const baseUrl = getPublicOrigin(event);
  const redirectUri = `${baseUrl}/api/auth/google/callback`;

  logStep(event, 'callback:computed', {
    baseUrl,
    redirectUri,
    hasClientId: !!googleClientId,
    hasClientSecret: !!googleClientSecret,
    codeLen: code.length
  });

  if (!googleClientId || !googleClientSecret) {
    log(event, 'ERROR', 'google:callback missing creds');
    logEnvSnapshot(event);
    return htmlRedirect(event, '/login?error=server_error');
  }

  let token: any;
  try {
    logStep(event, 'token:exchange:start');

    token = await $fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: googleClientId,
        client_secret: googleClientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      }).toString()
    });

    logStep(event, 'token:exchange:ok', {
      hasAccessToken: !!token?.access_token,
      tokenType: token?.token_type
    });
  } catch (err: any) {
    const e = extractFetchError(err);
    log(event, 'ERROR', 'token:exchange:failed', {
      ...e,
      hint:
        'If data.error is "redirect_uri_mismatch", set BASE_URL to the exact public URL and add the exact redirect URI in Google Console.'
    });
    return htmlRedirect(event, '/login?error=server_error');
  }

  let googleUser: any;
  try {
    logStep(event, 'userinfo:fetch:start');

    googleUser = await $fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token.access_token}` }
    });

    logStep(event, 'userinfo:fetch:ok', {
      email: googleUser?.email,
      sub: googleUser?.sub
    });
  } catch (err: any) {
    const e = extractFetchError(err);
    log(event, 'ERROR', 'userinfo:fetch:failed', e as any);
    return htmlRedirect(event, '/login?error=server_error');
  }

  try {
    logStep(event, 'db:connect:start');
    const db = await useDb();
    logStep(event, 'db:connect:ok');

    const [rows]: any = await db.execute(
      `SELECT u.*, p.nombre as plantel_nombre, r.nombre as role_name, r.nivel_permiso
       FROM users u
       LEFT JOIN planteles p ON u.plantel_id = p.id
       JOIN roles r ON u.role_id = r.id
       WHERE u.email = ?`,
      [googleUser.email]
    );

    let user = rows[0];

    if (!user) {
      const email = String(googleUser.email).toLowerCase();
      const domain = email.split('@')[1] || '';
      const allowedDomains = ['casitaiedis.edu.mx', 'iedis.edu.mx', 'gmail.com'];

      if (!allowedDomains.includes(domain)) {
        log(event, 'WARN', 'unauthorized domain', { domain, email });
        return htmlRedirect(event, '/login?error=unauthorized_domain');
      }

      const [roles]: any = await db.execute('SELECT id FROM roles WHERE nivel_permiso = 1 LIMIT 1');
      const defaultRoleId = roles?.[0]?.id ?? 2;

      const googleId = googleUser.sub || googleUser.id;

      const [res]: any = await db.execute(
        `INSERT INTO users (nombre, email, google_id, avatar_url, role_id, activo)
         VALUES (?, ?, ?, ?, ?, 1)`,
        [googleUser.name, email, googleId, googleUser.picture, defaultRoleId]
      );

      const [newRows]: any = await db.execute(
        `SELECT u.*, p.nombre as plantel_nombre, r.nombre as role_name, r.nivel_permiso
         FROM users u
         LEFT JOIN planteles p ON u.plantel_id = p.id
         JOIN roles r ON u.role_id = r.id
         WHERE u.id = ?`,
        [res.insertId]
      );

      user = newRows[0];
      logStep(event, 'user:create:ok', { id: user?.id, email: user?.email });
    } else {
      const googleId = googleUser.sub || googleUser.id;
      await db.execute('UPDATE users SET google_id = ?, avatar_url = ? WHERE id = ?', [
        googleId,
        googleUser.picture,
        user.id
      ]);
      logStep(event, 'user:update:ok', { id: user?.id, email: user?.email });
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

    logStep(event, 'cookie:set', { secure: isHttps, userId: sessionUser.id });

    return htmlRedirect(event, '/');
  } catch (err: any) {
    log(event, 'ERROR', 'db:flow:failed', {
      message: err?.message,
      stack: err?.stack
    });
    return htmlRedirect(event, '/login?error=server_error');
  }
});

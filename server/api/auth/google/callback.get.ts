// server/api/auth/google/callback.get.ts

import type { H3Event } from 'h3';
import { Buffer } from 'node:buffer';
import { useDb } from '~/server/utils/db';
import { getPublicOrigin } from '~/server/utils/publicOrigin';
import { htmlRedirect } from '~/server/utils/htmlRedirect';
import { log, logEnvSnapshot, logStep } from '~/server/utils/log';
import { ensureEnvLoaded, normalizeEnvValue, maskMid } from '~/server/utils/env';
import { setUserSessionCookie } from '~/server/utils/sessionCookie';

function extractFetchError(err: any) {
  const status = err?.response?.status ?? err?.status;
  const data = err?.response?._data ?? err?.data;
  return { status, data, message: err?.message };
}

async function exchangeTokenWithBody(params: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}) {
  return await $fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: params.code,
      client_id: params.clientId,
      client_secret: params.clientSecret,
      redirect_uri: params.redirectUri,
      grant_type: 'authorization_code'
    }).toString()
  });
}

async function exchangeTokenWithBasic(params: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}) {
  const basic = Buffer.from(`${params.clientId}:${params.clientSecret}`).toString('base64');

  return await $fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basic}`
    },
    body: new URLSearchParams({
      code: params.code,
      redirect_uri: params.redirectUri,
      grant_type: 'authorization_code'
    }).toString()
  });
}

export default defineEventHandler(async (event: H3Event) => {
  ensureEnvLoaded();
  logStep(event, 'callback:hit');

  const query = getQuery(event);
  const code = query.code ? String(query.code) : '';
  const error = query.error ? String(query.error) : '';

  if (error) {
    log(event, 'WARN', 'google:callback google returned error', { error });
    return htmlRedirect(event, '/login?error=no_code');
  }

  if (!code) {
    log(event, 'WARN', 'google:callback missing code');
    return htmlRedirect(event, '/login?error=no_code');
  }

  const cfg = useRuntimeConfig() as any;

  const cfgId = normalizeEnvValue(cfg.googleClientId);
  const envId = normalizeEnvValue(process.env.GOOGLE_CLIENT_ID);
  const clientId = cfgId || envId;

  const cfgSecret = normalizeEnvValue(cfg.googleClientSecret);
  const envSecret = normalizeEnvValue(process.env.GOOGLE_CLIENT_SECRET);
  const clientSecret = cfgSecret || envSecret;

  const baseUrl = getPublicOrigin(event);
  const redirectUri = `${baseUrl}/api/auth/google/callback`;

  logStep(event, 'callback:computed', {
    baseUrl,
    redirectUri,
    clientId: clientId ? maskMid(clientId) : null,
    clientIdFrom: cfgId ? 'runtimeConfig' : envId ? 'process.env' : 'none',
    clientSecret: clientSecret ? `***${clientSecret.slice(-6)}` : null,
    secretFrom: cfgSecret ? 'runtimeConfig' : envSecret ? 'process.env' : 'none',
    codeLen: code.length
  });

  if (!clientId || !clientSecret) {
    log(event, 'ERROR', 'google:callback missing creds');
    logEnvSnapshot(event);
    return htmlRedirect(event, '/login?error=oauth_client');
  }

  // 1) Exchange code -> token
  let token: any;
  try {
    logStep(event, 'token:exchange:body:start');
    token = await exchangeTokenWithBody({ code, clientId, clientSecret, redirectUri });
    logStep(event, 'token:exchange:body:ok', {
      hasAccessToken: !!token?.access_token,
      tokenType: token?.token_type
    });
  } catch (err: any) {
    const e = extractFetchError(err);
    const googleErr = e.data?.error;

    log(event, 'ERROR', 'token:exchange:body:failed', {
      ...e,
      clientId: maskMid(clientId),
      clientSecret: `***${clientSecret.slice(-6)}`
    });

    // Retry using HTTP Basic only when Google says invalid_client
    if (e.status === 401 && googleErr === 'invalid_client') {
      try {
        logStep(event, 'token:exchange:basic:retry:start');
        token = await exchangeTokenWithBasic({ code, clientId, clientSecret, redirectUri });
        logStep(event, 'token:exchange:basic:retry:ok', {
          hasAccessToken: !!token?.access_token,
          tokenType: token?.token_type
        });
      } catch (err2: any) {
        const e2 = extractFetchError(err2);
        log(event, 'ERROR', 'token:exchange:basic:retry:failed', {
          ...e2,
          hint:
            'invalid_client => your client_id/client_secret pair is wrong (mismatched, rotated secret, wrong OAuth client).'
        });
        return htmlRedirect(event, '/login?error=oauth_client');
      }
    } else {
      return htmlRedirect(event, '/login?error=server_error');
    }
  }

  // 2) Fetch userinfo
  let googleUser: any;
  try {
    logStep(event, 'userinfo:fetch:start');
    googleUser = await $fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token.access_token}` }
    });
    logStep(event, 'userinfo:fetch:ok', { email: googleUser?.email, sub: googleUser?.sub });
  } catch (err: any) {
    const e = extractFetchError(err);
    log(event, 'ERROR', 'userinfo:fetch:failed', e as any);
    return htmlRedirect(event, '/login?error=server_error');
  }

  // 3) DB lookup/upsert + set cookie
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

    // ✅ Localhost-safe cookie: secure=false on localhost, otherwise based on https
    const { host, secure } = setUserSessionCookie(event, sessionUser);

    logStep(event, 'cookie:set', { secure, host, userId: sessionUser.id });
    return htmlRedirect(event, '/');
  } catch (err: any) {
    log(event, 'ERROR', 'db:flow:failed', { message: err?.message, stack: err?.stack });
    return htmlRedirect(event, '/login?error=server_error');
  }
});

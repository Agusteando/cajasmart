import type { H3Event } from 'h3';
import { getRequestHeader } from 'h3';
import { getPublicOrigin } from '~/server/utils/publicOrigin';
import { useDb } from '~/server/utils/db';

export default defineEventHandler(async (event: H3Event) => {
  console.log('[google:callback] hit');

  const query = getQuery(event);
  const code = query.code ? String(query.code) : '';

  if (!code) {
    console.warn('[google:callback] missing code');
    event.node.res.writeHead(302, { Location: '/login?error=no_code' });
    event.node.res.end();
    return;
  }

  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!googleClientId || !googleClientSecret) {
    console.error('[google:callback] missing env', {
      hasId: !!googleClientId,
      hasSecret: !!googleClientSecret
    });
    event.node.res.writeHead(302, { Location: '/login?error=server_error' });
    event.node.res.end();
    return;
  }

  const baseUrl = getPublicOrigin(event);
  const redirectUri = `${baseUrl}/api/auth/google/callback`;
  console.log('[google:callback] redirectUri=', redirectUri);

  try {
    const token: any = await $fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      body: new URLSearchParams({
        code,
        client_id: googleClientId,
        client_secret: googleClientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });

    console.log('[google:callback] token ok');

    const googleUser: any = await $fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token.access_token}` }
    });

    console.log('[google:callback] email=', googleUser?.email);

    const db = await useDb();

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
        console.warn('[google:callback] unauthorized domain=', domain);
        event.node.res.writeHead(302, { Location: '/login?error=unauthorized_domain' });
        event.node.res.end();
        return;
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
      console.log('[google:callback] created user id=', user.id);
    } else {
      const googleId = googleUser.sub || googleUser.id;
      await db.execute('UPDATE users SET google_id = ?, avatar_url = ? WHERE id = ?', [
        googleId,
        googleUser.picture,
        user.id
      ]);
      console.log('[google:callback] updated user id=', user.id);
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

    console.log('[google:callback] success');

    event.node.res.writeHead(302, { Location: '/' });
    event.node.res.end();
  } catch (err: any) {
    console.error('[google:callback] FAILED', {
      message: err?.message,
      status: err?.status,
      data: err?.data
    });
    event.node.res.writeHead(302, { Location: '/login?error=server_error' });
    event.node.res.end();
  }
});

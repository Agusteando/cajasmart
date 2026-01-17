// Auto-imports: useDb from server/utils/db.ts
import { H3Event } from 'h3';

export default defineEventHandler(async (event: H3Event) => {
  const config = useRuntimeConfig();
  const query = getQuery(event);
  const code = query.code;

  // Helper for Native Redirects
  const redirect = (url: string) => {
    event.node.res.writeHead(302, { Location: url });
    event.node.res.end();
  };

  if (!code) return redirect('/login?error=no_code');

  try {
    // 1. Swap Code for Access Token
    const tokenResponse: any = await $fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      body: {
        code,
        client_id: config.googleClientId,
        client_secret: config.googleClientSecret,
        redirect_uri: `${config.baseUrl}/api/auth/google/callback`,
        grant_type: 'authorization_code',
      },
    });

    // 2. Get User Profile
    const googleUser: any = await $fetch('https://www.googleapis.com/oauth2/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
    });

    // 3. Connect to DB
    const db = await useDb();

    // 4. Check User Existence
    let [rows]: any = await db.execute(
      `SELECT u.*, p.nombre as plantel_nombre, r.nombre as role_name, r.nivel_permiso 
       FROM users u 
       LEFT JOIN planteles p ON u.plantel_id = p.id 
       JOIN roles r ON u.role_id = r.id 
       WHERE u.email = ?`,
      [googleUser.email]
    );

    let user = rows[0];

    // ==========================================
    //  AUTO-REGISTRATION (CasitaIEDIS Logic)
    // ==========================================
    if (!user) {
      const email = googleUser.email.toLowerCase();
      const domain = email.split('@')[1];
      
      // Allow specific domains (Added gmail for your testing)
      const allowedDomains = ['casitaiedis.edu.mx', 'iedis.edu.mx', 'gmail.com'];

      if (allowedDomains.includes(domain)) {
        // Get Default Role (ID 2 = Admin Plantel / Level 1)
        // Ensure this role exists in your DB!
        const [roles]: any = await db.execute("SELECT id FROM roles WHERE nivel_permiso = 1 LIMIT 1");
        const defaultRoleId = roles.length > 0 ? roles[0].id : 2;

        // Create User
        const [result]: any = await db.execute(
          `INSERT INTO users (nombre, email, google_id, avatar_url, role_id, activo) 
           VALUES (?, ?, ?, ?, ?, 1)`,
          [googleUser.name, email, googleUser.id, googleUser.picture, defaultRoleId]
        );

        // Fetch new user data
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
        return redirect('/login?error=unauthorized_domain');
      }
    } else {
      // Update existing user avatar
      await db.execute('UPDATE users SET google_id = ?, avatar_url = ? WHERE id = ?', [
        googleUser.id,
        googleUser.picture,
        user.id
      ]);
    }

    // 5. Create Session Cookie
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
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/'
    });

    // 6. Native Redirect to Dashboard
    return redirect('/');

  } catch (error) {
    console.error('Login Error:', error);
    return redirect('/login?error=server_error');
  }
});
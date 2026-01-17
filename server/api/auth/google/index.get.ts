export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  
  const rootUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
  
  const options = {
    redirect_uri: `${config.baseUrl}/api/auth/google/callback`,
    client_id: config.googleClientId,
    access_type: 'offline',
    response_type: 'code',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email'
    ].join(' ')
  };

  const qs = new URLSearchParams(options).toString();
  const fullUrl = `${rootUrl}?${qs}`;

  // ⚡ FIX: Use Native Node.js Response to force the browser to jump
  // This bypasses any Nuxt JSON serialization issues.
  event.node.res.writeHead(302, { Location: fullUrl });
  event.node.res.end();
});
export async function onRequestGet(context){const origin=new URL(context.request.url).origin;return new Response(`User-agent: *
Allow: /
Disallow: /admin
Disallow: /admin-login
Disallow: /admin-setup
Disallow: /admin-forgot
Disallow: /admin-recover
Disallow: /api/
Disallow: /automation-worker/
Sitemap: ${origin}/sitemap.xml
`,{headers:{'content-type':'text/plain; charset=utf-8','cache-control':'public, max-age=3600'}});}

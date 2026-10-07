export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...extraHeaders,
    },
  });
}

export function badRequest(message = 'Invalid request') { return json({ ok:false, error:message }, 400); }
export function unauthorized(message = 'Authentication required') { return json({ ok:false, error:message }, 401); }
export function forbidden(message = 'Not allowed') { return json({ ok:false, error:message }, 403); }

export async function readJson(request) {
  try { return await request.json(); } catch { return null; }
}

export function sameOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}

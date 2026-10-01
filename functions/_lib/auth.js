import { json, unauthorized, forbidden } from './http.js';

const COOKIE = 'ot_session';
const SESSION_SECONDS = 60 * 60 * 8;
const PBKDF2_ITERATIONS = 210000;

function bytesToB64url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function b64urlToBytes(s) {
  s = s.replace(/-/g,'+').replace(/_/g,'/');
  while (s.length % 4) s += '=';
  const bin = atob(s); const out = new Uint8Array(bin.length);
  for (let i=0;i<bin.length;i++) out[i]=bin.charCodeAt(i);
  return out;
}
function randomToken(size = 32) { const b = new Uint8Array(size); crypto.getRandomValues(b); return bytesToB64url(b); }
async function sha256(s) { const b = new TextEncoder().encode(s); const d = await crypto.subtle.digest('SHA-256', b); return bytesToB64url(new Uint8Array(d)); }

export async function hashPassword(password, saltText = null) {
  const salt = saltText ? b64urlToBytes(saltText) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name:'PBKDF2', salt, iterations:PBKDF2_ITERATIONS, hash:'SHA-256' }, key, 256);
  return { hash: bytesToB64url(new Uint8Array(bits)), salt: bytesToB64url(salt) };
}

export async function verifyPassword(password, salt, expectedHash) {
  const got = await hashPassword(password, salt);
  const a = new TextEncoder().encode(got.hash); const b = new TextEncoder().encode(expectedHash || '');
  if (a.length !== b.length) return false;
  let diff = 0; for (let i=0;i<a.length;i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function parseCookies(request) {
  const raw = request.headers.get('Cookie') || '';
  const out = {};
  raw.split(';').forEach(p => { const i=p.indexOf('='); if(i>0) out[p.slice(0,i).trim()] = p.slice(i+1).trim(); });
  return out;
}

export async function createSession(env, userId) {
  const token = randomToken(32);
  const tokenHash = await sha256(token);
  const expires = new Date(Date.now() + SESSION_SECONDS*1000).toISOString();
  await env.DB.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(tokenHash,userId,expires).run();
  return { token, expires };
}

export function sessionCookie(token) {
  return `${COOKIE}=${token}; Max-Age=${SESSION_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Strict`;
}
export function clearSessionCookie() { return `${COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict`; }

export async function destroySession(env, request) {
  const token = parseCookies(request)[COOKIE];
  if (!token) return;
  const tokenHash = await sha256(token);
  await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(tokenHash).run();
}

export async function getSessionUser(env, request) {
  const token = parseCookies(request)[COOKIE];
  if (!token || !env.DB) return null;
  const tokenHash = await sha256(token);
  const row = await env.DB.prepare(`
    SELECT u.id,u.username,u.email,u.role,u.status,s.expires_at
    FROM sessions s JOIN users u ON u.id=s.user_id
    WHERE s.token_hash=? LIMIT 1
  `).bind(tokenHash).first();
  if (!row || row.status !== 'active' || new Date(row.expires_at).getTime() <= Date.now()) {
    if (row) await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(tokenHash).run();
    return null;
  }
  return row;
}

export async function requireUser(context, role = null) {
  if (!context.env.DB) return { response: json({ok:false,error:'Database is not configured.'},503) };
  const user = await getSessionUser(context.env, context.request);
  if (!user) return { response: unauthorized() };
  if (role && user.role !== role) return { response: forbidden('Super Admin access required.') };
  return { user };
}

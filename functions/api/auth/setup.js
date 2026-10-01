import { ensureSchema } from '../../_lib/db.js';
import { json, badRequest, readJson, sameOrigin } from '../../_lib/http.js';
import { hashPassword, createSession, sessionCookie } from '../../_lib/auth.js';
export async function onRequestPost(context){
  await ensureSchema(context.env);
  if(!sameOrigin(context.request)) return json({ok:false,error:'Origin rejected.'},403);
  if(!context.env.DB) return json({ok:false,error:'Database binding DB is missing.'},503);
  const count = await context.env.DB.prepare('SELECT COUNT(*) AS c FROM users').first();
  if(Number(count?.c||0)>0) return json({ok:false,error:'Initial setup is already complete.'},409);
  const b = await readJson(context.request); if(!b) return badRequest();
  const username = String(b.username||'').trim(); const email=String(b.email||'').trim().toLowerCase();
  const password=String(b.password||''); const recovery=String(b.recoveryKey||'');
  if(!/^[A-Za-z0-9_.-]{4,40}$/.test(username)) return badRequest('Username must be 4–40 characters and use letters, numbers, dot, dash or underscore.');
  if(!/^\S+@\S+\.\S+$/.test(email)) return badRequest('Enter a valid email address.');
  if(password.length<10) return badRequest('Password must be at least 10 characters.');
  if(recovery.length<12) return badRequest('Recovery key must be at least 12 characters. Save it somewhere safe.');
  const ph=await hashPassword(password); const rh=await hashPassword(recovery);
  const res=await context.env.DB.prepare(`INSERT INTO users(username,email,password_hash,password_salt,role,status,recovery_hash,recovery_salt) VALUES(?,?,?,?, 'super_admin','active',?,?)`)
    .bind(username,email,ph.hash,ph.salt,rh.hash,rh.salt).run();
  const sess=await createSession(context.env, res.meta.last_row_id);
  return json({ok:true,user:{id:res.meta.last_row_id,username,email,role:'super_admin'}},200,{'Set-Cookie':sessionCookie(sess.token)});
}

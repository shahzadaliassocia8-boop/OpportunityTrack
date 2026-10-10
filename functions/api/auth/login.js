import { ensureSchema } from '../../_lib/db.js';
import { json, badRequest, readJson, sameOrigin } from '../../_lib/http.js';
import { verifyPassword, createSession, sessionCookie } from '../../_lib/auth.js';
export async function onRequestPost(context){
  await ensureSchema(context.env);
  if(!sameOrigin(context.request)) return json({ok:false,error:'Origin rejected.'},403);
  if(!context.env.DB) return json({ok:false,error:'Database binding DB is missing.'},503);
  const b=await readJson(context.request); if(!b) return badRequest();
  const username=String(b.username||'').trim(); const password=String(b.password||''); const mode=b.mode==='super_admin'?'super_admin':'admin';
  const u=await context.env.DB.prepare('SELECT * FROM users WHERE username=? COLLATE NOCASE LIMIT 1').bind(username).first();
  if(!u || u.status!=='active' || u.role!==mode || !(await verifyPassword(password,u.password_salt,u.password_hash))) return json({ok:false,error:'Username or password is incorrect.'},401);
  await context.env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(new Date().toISOString()).run();
  const sess=await createSession(context.env,u.id);
  return json({ok:true,user:{id:u.id,username:u.username,email:u.email,role:u.role}},200,{'Set-Cookie':sessionCookie(sess.token)});
}

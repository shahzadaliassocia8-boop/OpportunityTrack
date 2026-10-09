import { ensureSchema } from '../../_lib/db.js';
import { json, badRequest, readJson, sameOrigin } from '../../_lib/http.js';
import { verifyPassword, hashPassword } from '../../_lib/auth.js';
export async function onRequestPost(context){
  await ensureSchema(context.env);
  if(!sameOrigin(context.request)) return json({ok:false,error:'Origin rejected.'},403);
  if(!context.env.DB) return json({ok:false,error:'Database binding DB is missing.'},503);
  const b=await readJson(context.request); if(!b) return badRequest();
  const username=String(b.username||'').trim(); const key=String(b.recoveryKey||''); const password=String(b.newPassword||'');
  if(password.length<10) return badRequest('New password must be at least 10 characters.');
  const u=await context.env.DB.prepare("SELECT * FROM users WHERE username=? COLLATE NOCASE AND role='super_admin' LIMIT 1").bind(username).first();
  if(!u || !u.recovery_hash || !(await verifyPassword(key,u.recovery_salt,u.recovery_hash))) return json({ok:false,error:'Recovery details are incorrect.'},401);
  const ph=await hashPassword(password);
  await context.env.DB.batch([
    context.env.DB.prepare('UPDATE users SET password_hash=?,password_salt=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(ph.hash,ph.salt,u.id),
    context.env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(u.id)
  ]);
  return json({ok:true,message:'Super Admin password has been reset. You can now sign in.'});
}

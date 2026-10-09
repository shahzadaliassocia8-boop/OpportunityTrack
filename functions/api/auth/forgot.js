import { ensureSchema } from '../../_lib/db.js';
import { json, readJson, sameOrigin } from '../../_lib/http.js';
export async function onRequestPost(context){
  await ensureSchema(context.env);
  if(!sameOrigin(context.request)) return json({ok:false,error:'Origin rejected.'},403);
  if(!context.env.DB) return json({ok:false,error:'Database binding DB is missing.'},503);
  const b=await readJson(context.request); const identifier=String(b?.identifier||'').trim();
  if(identifier){
    const u=await context.env.DB.prepare('SELECT id,role FROM users WHERE username=? COLLATE NOCASE OR email=? COLLATE NOCASE LIMIT 1').bind(identifier,identifier.toLowerCase()).first();
    if(u && u.role==='admin'){
      const old=await context.env.DB.prepare("SELECT id FROM password_reset_requests WHERE user_id=? AND status='pending' LIMIT 1").bind(u.id).first();
      if(!old) await context.env.DB.prepare("INSERT INTO password_reset_requests(user_id,status) VALUES(?,'pending')").bind(u.id).run();
    }
  }
  return json({ok:true,message:'If this is a normal Admin account, a password-reset request has been recorded for the Super Admin. Super Admins can use the recovery-key option.'});
}

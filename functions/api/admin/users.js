import { ensureSchema } from '../../_lib/db.js';
import { json, badRequest, readJson, sameOrigin } from '../../_lib/http.js';
import { requireUser, hashPassword } from '../../_lib/auth.js';
export async function onRequestGet(context){
  await ensureSchema(context.env);
  const a=await requireUser(context,'super_admin');if(a.response)return a.response;
  const users=await context.env.DB.prepare('SELECT id,username,email,role,status,created_at,updated_at FROM users ORDER BY role DESC,username').all();
  const resets=await context.env.DB.prepare(`SELECT r.id,r.requested_at,r.status,u.id AS user_id,u.username,u.email FROM password_reset_requests r JOIN users u ON u.id=r.user_id WHERE r.status='pending' ORDER BY r.requested_at DESC`).all();
  return json({ok:true,users:users.results||[],resetRequests:resets.results||[]});
}
export async function onRequestPost(context){
  await ensureSchema(context.env);
  if(!sameOrigin(context.request))return json({ok:false,error:'Origin rejected.'},403);const a=await requireUser(context,'super_admin');if(a.response)return a.response;const b=await readJson(context.request);if(!b)return badRequest();const action=String(b.action||'');
  if(action==='create'){
    const username=String(b.username||'').trim(),email=String(b.email||'').trim().toLowerCase(),password=String(b.password||'');
    if(!/^[A-Za-z0-9_.-]{4,40}$/.test(username))return badRequest('Username must be 4–40 characters.');if(!/^\S+@\S+\.\S+$/.test(email))return badRequest('Valid email required.');if(password.length<10)return badRequest('Password must be at least 10 characters.');
    const ph=await hashPassword(password);try{const r=await context.env.DB.prepare(`INSERT INTO users(username,email,password_hash,password_salt,role,status) VALUES(?,?,?,?, 'admin','active')`).bind(username,email,ph.hash,ph.salt).run();return json({ok:true,id:r.meta.last_row_id},201);}catch(e){return badRequest('Username or email already exists.');}
  }
  if(action==='resetPassword'){
    const userId=Number(b.userId),password=String(b.newPassword||'');if(!userId||password.length<10)return badRequest('User and a 10+ character password are required.');const target=await context.env.DB.prepare("SELECT id,role FROM users WHERE id=? AND role='admin'").bind(userId).first();if(!target)return badRequest('Admin account not found.');const ph=await hashPassword(password);await context.env.DB.batch([context.env.DB.prepare('UPDATE users SET password_hash=?,password_salt=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(ph.hash,ph.salt,userId),context.env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(userId),context.env.DB.prepare("UPDATE password_reset_requests SET status='resolved',resolved_at=CURRENT_TIMESTAMP WHERE user_id=? AND status='pending'").bind(userId)]);return json({ok:true});
  }
  if(action==='setStatus'){
    const userId=Number(b.userId),status=b.status==='disabled'?'disabled':'active';const target=await context.env.DB.prepare("SELECT id,role FROM users WHERE id=? AND role='admin'").bind(userId).first();if(!target)return badRequest('Admin account not found.');await context.env.DB.prepare('UPDATE users SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(status,userId).run();if(status==='disabled')await context.env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(userId).run();return json({ok:true});
  }
  return badRequest('Unknown action.');
}

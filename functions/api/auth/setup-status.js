import { ensureSchema } from '../../_lib/db.js';
import { json } from '../../_lib/http.js';
export async function onRequestGet(context){
  await ensureSchema(context.env);
  if(!context.env.DB) return json({ok:false,configured:false,error:'Database binding DB is missing.'},503);
  const row = await context.env.DB.prepare('SELECT COUNT(*) AS c FROM users').first();
  return json({ok:true,configured:true,needsSetup:Number(row?.c||0)===0});
}

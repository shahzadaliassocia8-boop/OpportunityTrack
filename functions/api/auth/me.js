import { json } from '../../_lib/http.js';
import { getSessionUser } from '../../_lib/auth.js';
export async function onRequestGet(context){
  if(!context.env.DB) return json({ok:false,error:'Database binding DB is missing.'},503);
  const u=await getSessionUser(context.env,context.request);
  if(!u) return json({ok:false,user:null},401);
  return json({ok:true,user:{id:u.id,username:u.username,email:u.email,role:u.role}});
}

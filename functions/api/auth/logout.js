import { json } from '../../_lib/http.js';
import { destroySession, clearSessionCookie } from '../../_lib/auth.js';
export async function onRequestPost(context){
  if(context.env.DB) await destroySession(context.env,context.request);
  return json({ok:true},200,{'Set-Cookie':clearSessionCookie()});
}

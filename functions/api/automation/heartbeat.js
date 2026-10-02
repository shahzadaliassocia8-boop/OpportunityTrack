import { ensureSchema } from '../../_lib/db.js';
import { json } from '../../_lib/http.js';
import { checkAllSources } from '../../_lib/source-monitor.js';

const MIN_GAP_MS=60*60*1000;
export async function onRequestPost(context){
  await ensureSchema(context.env); if(!context.env.DB)return json({ok:true,started:false,reason:'database-not-configured'});
  const count=await context.env.DB.prepare('SELECT COUNT(*) c FROM official_sources WHERE active=1').first(); if(!Number(count?.c||0))return json({ok:true,started:false,reason:'no-active-sources'});
  const row=await context.env.DB.prepare(`SELECT value FROM automation_state WHERE key='heartbeat_last_attempt'`).first();
  const last=row?.value?new Date(row.value).getTime():0; if(last&&Date.now()-last<MIN_GAP_MS)return json({ok:true,started:false,reason:'rate-limited'});
  const now=new Date().toISOString();
  await context.env.DB.prepare(`INSERT INTO automation_state(key,value,updated_at) VALUES('heartbeat_last_attempt',?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP`).bind(now).run();
  context.waitUntil((async()=>{const results=await checkAllSources(context.env,{force:false,limit:8});await context.env.DB.prepare(`INSERT INTO automation_state(key,value,updated_at) VALUES('heartbeat_last_result',?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP`).bind(JSON.stringify({at:new Date().toISOString(),results})).run();})());
  return json({ok:true,started:true});
}

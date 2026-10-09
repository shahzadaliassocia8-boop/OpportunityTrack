import { ensureSchema } from '../../_lib/db.js';
import { json, badRequest, readJson, sameOrigin } from '../../_lib/http.js';
import { requireUser } from '../../_lib/auth.js';
import { checkSource, checkAllSources } from '../../_lib/source-monitor.js';

const CATS=new Set(['Scholarship','Admission','Internship','Fellowship','Job','Scheme','Update']);
const TYPES=new Set(['auto','rss','html']);
function clean(v,max=300){return String(v??'').trim().slice(0,max);}
function cleanUrl(v){try{const u=new URL(String(v||'').trim());if(!/^https?:$/.test(u.protocol))return '';const h=u.hostname.toLowerCase();if(h==='localhost'||h.endsWith('.local')||h==='0.0.0.0'||h==='::1'||/^127\./.test(h)||/^10\./.test(h)||/^192\.168\./.test(h)||/^169\.254\./.test(h)||/^172\.(1[6-9]|2\d|3[01])\./.test(h))return '';return u.href;}catch{return '';}}
function bool(v){return v===true||v===1||v==='1'||v==='true';}

function cleanCategories(v){
  const raw=Array.isArray(v)?v:String(v??'').split(',');
  const out=[];
  for(const x of raw){const c=clean(x,30);if(CATS.has(c)&&!out.includes(c))out.push(c);}
  return out;
}

export async function onRequestGet(context){
  await ensureSchema(context.env); const a=await requireUser(context); if(a.response)return a.response;
  const r=await context.env.DB.prepare(`SELECT s.*,
      SUM(CASE WHEN i.status='pending' THEN 1 ELSE 0 END) AS pending_count,
      SUM(CASE WHEN i.status='imported' THEN 1 ELSE 0 END) AS imported_count
    FROM official_sources s LEFT JOIN source_items i ON i.source_id=s.id
    GROUP BY s.id ORDER BY s.active DESC,s.name COLLATE NOCASE ASC`).all();
  const p=await context.env.DB.prepare(`SELECT COUNT(*) c FROM source_items WHERE status='pending'`).first();
  return json({ok:true,sources:r.results||[],pendingCount:Number(p?.c||0)});
}

export async function onRequestPost(context){
  await ensureSchema(context.env); if(!sameOrigin(context.request))return json({ok:false,error:'Origin rejected.'},403);
  const a=await requireUser(context); if(a.response)return a.response;
  const b=await readJson(context.request); if(!b)return badRequest(); const action=clean(b.action,40);

  if(action==='create'||action==='update'){
    const id=Number(b.id||0), name=clean(b.name,160), url=cleanUrl(b.url), sourceType=clean(b.source_type,20)||'auto';
    const allowed=cleanCategories(b.allowed_categories);
    const requestedFallback=clean(b.default_category,30);
    const cat=(CATS.has(requestedFallback)&&allowed.includes(requestedFallback))?requestedFallback:(allowed[0]||'Scholarship');
    const interval=Math.max(1,Math.min(Number(b.check_interval_hours||12)||12,168)), active=bool(b.active)?1:0;
    if(!name||!url||!TYPES.has(sourceType)||!allowed.length)return badRequest('Name, valid source URL, source type and at least one content type are required.');
    const allowedJson=JSON.stringify(allowed);
    const duplicate=await context.env.DB.prepare('SELECT id FROM official_sources WHERE url=? AND id<>? LIMIT 1').bind(url,id||0).first();
    if(duplicate)return badRequest('This official link is already connected. Edit the existing source and tick any additional content types there.');
    if(action==='create'){
      const run=await context.env.DB.prepare(`INSERT INTO official_sources(name,url,source_type,default_category,allowed_categories,active,check_interval_hours,created_by) VALUES(?,?,?,?,?,?,?,?)`)
        .bind(name,url,sourceType,cat,allowedJson,active,interval,a.user.id).run();
      const item=await context.env.DB.prepare('SELECT * FROM official_sources WHERE id=?').bind(run.meta.last_row_id).first(); return json({ok:true,source:item},201);
    }
    if(!id)return badRequest('Source ID is required.');
    await context.env.DB.prepare(`UPDATE official_sources SET name=?,url=?,source_type=?,default_category=?,allowed_categories=?,active=?,check_interval_hours=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .bind(name,url,sourceType,cat,allowedJson,active,interval,id).run();
    const placeholders=allowed.map(()=>'?').join(',');
    if(placeholders) await context.env.DB.prepare(`DELETE FROM source_items WHERE source_id=? AND status='pending' AND detected_category NOT IN (${placeholders})`).bind(id,...allowed).run();
    const item=await context.env.DB.prepare('SELECT * FROM official_sources WHERE id=?').bind(id).first(); return item?json({ok:true,source:item}):json({ok:false,error:'Source not found.'},404);
  }

  if(action==='delete'){
    const id=Number(b.id||0); if(!id)return badRequest('Source ID is required.');
    await context.env.DB.prepare('DELETE FROM official_sources WHERE id=?').bind(id).run(); return json({ok:true});
  }
  if(action==='check'){
    const id=Number(b.id||0); if(!id)return badRequest('Source ID is required.');
    const source=await context.env.DB.prepare('SELECT * FROM official_sources WHERE id=?').bind(id).first(); if(!source)return json({ok:false,error:'Source not found.'},404);
    const result=await checkSource(context.env,source); return json({ok:result.ok,result},result.ok?200:422);
  }
  if(action==='checkAll'){
    const results=await checkAllSources(context.env,{force:true,limit:20}); return json({ok:true,results});
  }
  return badRequest('Unknown action.');
}

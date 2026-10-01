import { ensureSchema } from '../../_lib/db.js';
import { json, badRequest, readJson, sameOrigin } from '../../_lib/http.js';
import { requireUser } from '../../_lib/auth.js';

function slugify(s){return String(s||'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,90)||'opportunity';}
async function uniqueSlug(env,title){let base=slugify(title),slug=base,n=2;while(await env.DB.prepare('SELECT id FROM opportunities WHERE slug=?').bind(slug).first())slug=`${base}-${n++}`;return slug;}
function isoDate(v){if(!v)return '';const d=new Date(v);return Number.isNaN(d.getTime())?'':d.toISOString().slice(0,10);}

export async function onRequestGet(context){
  await ensureSchema(context.env); const a=await requireUser(context); if(a.response)return a.response;
  const url=new URL(context.request.url), status=url.searchParams.get('status')||'pending';
  const allowed=new Set(['pending','imported','ignored']); const st=allowed.has(status)?status:'pending';
  const r=await context.env.DB.prepare(`SELECT i.*,s.name AS source_name,s.url AS source_home,s.default_category
    FROM source_items i JOIN official_sources s ON s.id=i.source_id WHERE i.status=? ORDER BY i.detected_at DESC LIMIT 300`).bind(st).all();
  return json({ok:true,items:r.results||[]});
}

export async function onRequestPost(context){
  await ensureSchema(context.env); if(!sameOrigin(context.request))return json({ok:false,error:'Origin rejected.'},403);
  const a=await requireUser(context); if(a.response)return a.response;
  const b=await readJson(context.request); if(!b)return badRequest(); const id=Number(b.id||0), action=String(b.action||'');
  if(!id)return badRequest('Discovery ID is required.');
  const item=await context.env.DB.prepare(`SELECT i.*,s.name source_name,s.default_category FROM source_items i JOIN official_sources s ON s.id=i.source_id WHERE i.id=?`).bind(id).first();
  if(!item)return json({ok:false,error:'Discovery not found.'},404);
  if(action==='ignore'){
    await context.env.DB.prepare(`UPDATE source_items SET status='ignored',reviewed_at=CURRENT_TIMESTAMP WHERE id=?`).bind(id).run(); return json({ok:true});
  }
  if(action==='restore'){
    await context.env.DB.prepare(`UPDATE source_items SET status='pending',reviewed_at=NULL WHERE id=?`).bind(id).run(); return json({ok:true});
  }
  if(action==='import'){
    if(item.status==='imported'&&item.opportunity_id)return json({ok:true,opportunityId:item.opportunity_id,alreadyImported:true});
    const existing=await context.env.DB.prepare(`SELECT id FROM opportunities WHERE official_source=? OR application_link=? LIMIT 1`).bind(item.url,item.url).first();
    if(existing){await context.env.DB.prepare(`UPDATE source_items SET status='imported',opportunity_id=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=?`).bind(existing.id,id).run();return json({ok:true,opportunityId:existing.id,alreadyImported:true});}
    const slug=await uniqueSlug(context.env,item.title), category=item.detected_category||item.default_category||'Update';
    const short='Imported as a private draft from an official source. Review the official page and replace this text with an original, useful summary before publishing.';
    const details=`Source review required before publication.\n\nOfficial source: ${item.url}`;
    const run=await context.env.DB.prepare(`INSERT INTO opportunities(slug,title,category,published_date,featured,status,short_description,full_details,application_link,official_source,tags,created_by,updated_by) VALUES(?,?,?,?,0,'draft',?,?,?,?,?,?,?)`)
      .bind(slug,item.title,category,isoDate(item.source_published_date),short,details,item.url,item.url,'Official source import',a.user.id,a.user.id).run();
    const oid=run.meta.last_row_id;
    await context.env.DB.prepare(`UPDATE source_items SET status='imported',opportunity_id=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=?`).bind(oid,id).run();
    return json({ok:true,opportunityId:oid},201);
  }
  return badRequest('Unknown action.');
}

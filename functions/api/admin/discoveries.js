import { ensureSchema } from '../../_lib/db.js';
import { json, badRequest, readJson, sameOrigin } from '../../_lib/http.js';
import { requireUser } from '../../_lib/auth.js';
import { enrichOpportunityFromOfficialPage } from '../../_lib/opportunity-enrich.js';

function slugify(s){return String(s||'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,90)||'opportunity';}
async function uniqueSlug(env,title){let base=slugify(title),slug=base,n=2;while(await env.DB.prepare('SELECT id FROM opportunities WHERE slug=?').bind(slug).first())slug=`${base}-${n++}`;return slug;}
function sameUrl(a,b){try{const x=new URL(String(a||'')),y=new URL(String(b||''));x.hash='';y.hash='';return x.href.replace(/\/$/,'')===y.href.replace(/\/$/,'');}catch{return false;}}
function isoDate(v){if(!v)return '';const d=new Date(v);return Number.isNaN(d.getTime())?String(v).slice(0,30):d.toISOString().slice(0,10);}

export async function onRequestGet(context){
  await ensureSchema(context.env); const a=await requireUser(context); if(a.response)return a.response;
  const url=new URL(context.request.url), status=url.searchParams.get('status')||'pending';
  const allowed=new Set(['pending','imported','ignored']); const st=allowed.has(status)?status:'pending';
  const r=await context.env.DB.prepare(`SELECT i.*,s.name AS source_name,s.url AS source_home,s.default_category,s.allowed_categories
    FROM source_items i JOIN official_sources s ON s.id=i.source_id WHERE i.status=? ORDER BY i.detected_at DESC LIMIT 300`).bind(st).all();
  return json({ok:true,items:r.results||[]});
}

export async function onRequestPost(context){
  await ensureSchema(context.env); if(!sameOrigin(context.request))return json({ok:false,error:'Origin rejected.'},403);
  const a=await requireUser(context); if(a.response)return a.response;
  const b=await readJson(context.request); if(!b)return badRequest(); const id=Number(b.id||0), action=String(b.action||'');
  if(!id)return badRequest('Discovery ID is required.');
  const item=await context.env.DB.prepare(`SELECT i.*,s.name source_name,s.url source_home,s.default_category,s.allowed_categories FROM source_items i JOIN official_sources s ON s.id=i.source_id WHERE i.id=?`).bind(id).first();
  if(!item)return json({ok:false,error:'Discovery not found.'},404);
  if(action==='ignore'){
    await context.env.DB.prepare(`UPDATE source_items SET status='ignored',reviewed_at=CURRENT_TIMESTAMP WHERE id=?`).bind(id).run(); return json({ok:true});
  }
  if(action==='restore'){
    await context.env.DB.prepare(`UPDATE source_items SET status='pending',reviewed_at=NULL WHERE id=?`).bind(id).run(); return json({ok:true});
  }
  if(action==='import'){
    let existing=null;
    if(item.opportunity_id) existing=await context.env.DB.prepare(`SELECT * FROM opportunities WHERE id=? LIMIT 1`).bind(item.opportunity_id).first();
    if(!existing) existing=await context.env.DB.prepare(`SELECT * FROM opportunities WHERE official_source=? OR application_link=? LIMIT 1`).bind(item.url,item.url).first();
    if(existing?.status==='published'){
      await context.env.DB.prepare(`UPDATE source_items SET status='imported',opportunity_id=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=?`).bind(existing.id,id).run();
      return json({ok:true,opportunityId:existing.id,alreadyImported:true,alreadyPublished:true,warning:'This opportunity is already published.'});
    }

    let autoFill=null,warning='';
    try{
      autoFill=await enrichOpportunityFromOfficialPage(item,{name:item.source_name,url:item.source_home,default_category:item.default_category});
    }catch(e){warning=String(e.message||'Could not read the official page automatically.');}

    const allowed=sourceAllowedCategories(item);const candidate=autoFill?.category||item.detected_category||existing?.category||item.default_category||allowed[0]||'Update';const category=allowed.includes(candidate)?candidate:(allowed.includes(item.detected_category)?item.detected_category:allowed[0]);
    const title=autoFill?.title||item.title||existing?.title||'Opportunity';
    const organization=autoFill?.organization||existing?.organization||String(item.source_name||'').replace(/\b(scholarships?|fellowships?|internships?|admissions?|jobs?|official)\b/gi,' ').replace(/\s+/g,' ').trim();
    const published=autoFill?.published_date||existing?.published_date||isoDate(item.source_published_date)||new Date().toISOString().slice(0,10);
    const short=autoFill?.short_description||existing?.short_description||`${title} is a ${String(category).toLowerCase()} opportunity detected from the official ${organization||'provider'} source. Review the provider page for the latest eligibility, deadline, funding details, and application instructions before applying.`;
    const eligibility=autoFill?.eligibility||existing?.eligibility||`Eligibility is determined by ${organization||'the official provider'}. Confirm the current academic or professional background, nationality or residency conditions, required documents, and programme-specific criteria on the official source.`;
    const details=autoFill?.full_details||existing?.full_details||`${title} was detected from the official provider page and prepared as a private draft.\n\nBefore publishing, confirm the current deadline, eligibility, funding terms, required documents, and application route on the official source.`;
    const country=autoFill?.country||existing?.country||'', city=autoFill?.city||existing?.city||'', funding=autoFill?.funding||existing?.funding||'', degree=autoFill?.degree_level||existing?.degree_level||'', deadline=autoFill?.deadline||existing?.deadline||'';
    const priorApplication=existing?.application_link&&!sameUrl(existing.application_link,existing.official_source||item.url)?existing.application_link:'';
    const application=autoFill?.application_link||priorApplication||'';
    const tags=autoFill?.tags||existing?.tags||[category,organization,country].filter(Boolean).join(', ');

    let oid;
    if(existing){
      oid=existing.id;
      const slug=existing.slug||await uniqueSlug(context.env,title);
      await context.env.DB.prepare(`UPDATE opportunities SET slug=?,title=?,category=?,organization=?,country=?,city=?,funding=?,degree_level=?,deadline=?,published_date=?,status='draft',short_description=?,eligibility=?,full_details=?,application_link=?,official_source=?,image_url=?,tags=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
        .bind(slug,title,category,organization,country,city,funding,degree,deadline,published,short,eligibility,details,application,item.url,existing?.image_url||'',tags,a.user.id,oid).run();
    }else{
      const slug=await uniqueSlug(context.env,title);
      const run=await context.env.DB.prepare(`INSERT INTO opportunities(slug,title,category,organization,country,city,funding,degree_level,deadline,published_date,featured,status,short_description,eligibility,full_details,application_link,official_source,image_url,tags,created_by,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,0,'draft',?,?,?,?,?,?,?,?,?)`)
        .bind(slug,title,category,organization,country,city,funding,degree,deadline,published,short,eligibility,details,application,item.url,'',tags,a.user.id,a.user.id).run();
      oid=run.meta.last_row_id;
    }
    await context.env.DB.prepare(`UPDATE source_items SET status='imported',opportunity_id=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=?`).bind(oid,id).run();
    return json({ok:true,opportunityId:oid,autoFilled:Boolean(autoFill),warning,refreshedExisting:Boolean(existing)},existing?200:201);
  }
  return badRequest('Unknown action.');
}

import { ensureSchema } from '../../../_lib/db.js';
import { json, badRequest, readJson, sameOrigin } from '../../../_lib/http.js';
import { requireUser } from '../../../_lib/auth.js';
const ALLOWED=new Set(['Scholarship','Admission','Internship','Fellowship','Job','Scheme','Update']);
const GENERIC_TITLE_RE=/^(?:home|homepage|funding options?|scholarships?|fellowships?|internships?|admissions?|jobs?|schemes?|updates?|read more|learn more|apply now|view details|click here)$/i;
function badPublicTitle(v=''){return GENERIC_TITLE_RE.test(String(v).trim());}

function slugify(s){return String(s||'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,90)||'opportunity';}
function cleanImageUrl(s){s=String(s||'').trim();if(!s)return '';try{const u=new URL(s);return u.protocol==='https:'?u.href:'';}catch{return '';}}
function cleanUrl(s){s=String(s||'').trim(); if(!s)return '';try{const u=new URL(s);return /^https?:$/.test(u.protocol)?u.href:'';}catch{return '';}}
function field(v,max=12000){return String(v||'').trim().slice(0,max);}
async function uniqueSlug(env,title,preferred,id){let base=slugify(preferred||title),slug=base,n=2;while(true){const r=await env.DB.prepare('SELECT id FROM opportunities WHERE slug=? LIMIT 1').bind(slug).first();if(!r||Number(r.id)===Number(id))return slug;slug=`${base}-${n++}`;}}
export async function onRequestPut(context){
  await ensureSchema(context.env);
  if(!sameOrigin(context.request))return json({ok:false,error:'Origin rejected.'},403);const a=await requireUser(context);if(a.response)return a.response;
  const id=Number(context.params.id);if(!id)return badRequest();const current=await context.env.DB.prepare('SELECT * FROM opportunities WHERE id=?').bind(id).first();if(!current)return json({ok:false,error:'Not found.'},404);
  const b=await readJson(context.request);if(!b)return badRequest();const title=field(b.title,220),category=field(b.category,30),short=field(b.short_description,1800);if(!title||!ALLOWED.has(category)||!short)return badRequest('Title, category and short description are required.');if(b.status==='published'&&badPublicTitle(title)) return badRequest('Use the specific opportunity title before publishing; generic titles such as Homepage or Funding Options cannot be published.');
  const slug=await uniqueSlug(context.env,title,b.slug,id);await context.env.DB.prepare(`UPDATE opportunities SET slug=?,title=?,category=?,organization=?,country=?,city=?,funding=?,degree_level=?,deadline=?,published_date=?,featured=?,status=?,short_description=?,eligibility=?,full_details=?,application_link=?,official_source=?,image_url=?,tags=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
    .bind(slug,title,category,field(b.organization,220),field(b.country,120),field(b.city,120),field(b.funding,180),field(b.degree_level,180),field(b.deadline,80),field(b.published_date,30),b.featured?1:0,b.status==='published'?'published':'draft',short,field(b.eligibility,12000),field(b.full_details,20000),cleanUrl(b.application_link),cleanUrl(b.official_source),cleanImageUrl(b.image_url),field(b.tags,800),a.user.id,id).run();
  const item=await context.env.DB.prepare('SELECT * FROM opportunities WHERE id=?').bind(id).first();return json({ok:true,item});
}
export async function onRequestDelete(context){
  await ensureSchema(context.env);
  if(!sameOrigin(context.request))return json({ok:false,error:'Origin rejected.'},403);const a=await requireUser(context);if(a.response)return a.response;const id=Number(context.params.id);if(!id)return badRequest();await context.env.DB.prepare('DELETE FROM opportunities WHERE id=?').bind(id).run();return json({ok:true});
}

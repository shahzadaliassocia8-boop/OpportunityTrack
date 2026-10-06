import { ensureSchema } from '../../_lib/db.js';
import { json, badRequest, readJson, sameOrigin } from '../../_lib/http.js';
import { requireUser } from '../../_lib/auth.js';
const ALLOWED = new Set(['Scholarship','Admission','Internship','Fellowship','Job','Scheme','Update']);
const GENERIC_TITLE_RE=/^(?:home|homepage|funding options?|scholarships?|fellowships?|internships?|admissions?|jobs?|schemes?|updates?|read more|learn more|apply now|view details|click here)$/i;
function badPublicTitle(v=''){return GENERIC_TITLE_RE.test(String(v).trim());}
function slugify(s){return String(s||'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,90)||'opportunity';}
function cleanImageUrl(s){s=String(s||'').trim();if(!s)return '';try{const u=new URL(s);return u.protocol==='https:'?u.href:'';}catch{return '';}}
function cleanUrl(s){s=String(s||'').trim(); if(!s) return ''; try{const u=new URL(s); return /^https?:$/.test(u.protocol)?u.href:'';}catch{return '';}}
function field(v,max=12000){return String(v||'').trim().slice(0,max);}
async function uniqueSlug(env,title,preferred,id=null){let base=slugify(preferred||title), slug=base, n=2; while(true){const row=await env.DB.prepare('SELECT id FROM opportunities WHERE slug=? LIMIT 1').bind(slug).first(); if(!row || (id && Number(row.id)===Number(id))) return slug; slug=`${base}-${n++}`;}}
export async function onRequestGet(context){
  await ensureSchema(context.env);
  const a=await requireUser(context); if(a.response) return a.response;
  const url=new URL(context.request.url); const category=url.searchParams.get('category'); const q=(url.searchParams.get('q')||'').trim();
  let sql='SELECT * FROM opportunities WHERE 1=1'; const binds=[];
  if(category && ALLOWED.has(category)){sql+=' AND category=?';binds.push(category);} if(q){const x=`%${q}%`;sql+=' AND (title LIKE ? OR organization LIKE ? OR country LIKE ?)';binds.push(x,x,x);}
  sql+=' ORDER BY updated_at DESC,id DESC LIMIT 250'; const r=await context.env.DB.prepare(sql).bind(...binds).all();
  return json({ok:true,items:r.results||[]});
}
export async function onRequestPost(context){
  await ensureSchema(context.env);
  if(!sameOrigin(context.request)) return json({ok:false,error:'Origin rejected.'},403);
  const a=await requireUser(context); if(a.response) return a.response;
  const b=await readJson(context.request); if(!b) return badRequest(); const title=field(b.title,220), category=field(b.category,30), short=field(b.short_description,1800);
  if(!title || !ALLOWED.has(category) || !short) return badRequest('Title, category and short description are required.');
  if(b.status==='published'&&badPublicTitle(title)) return badRequest('Use the specific opportunity title before publishing; generic titles such as Homepage or Funding Options cannot be published.');
  const slug=await uniqueSlug(context.env,title,b.slug);
  const values={slug,title,category,organization:field(b.organization,220),country:field(b.country,120),city:field(b.city,120),funding:field(b.funding,180),degree_level:field(b.degree_level,180),deadline:field(b.deadline,80),published_date:field(b.published_date,30),featured:b.featured?1:0,status:b.status==='published'?'published':'draft',short_description:short,eligibility:field(b.eligibility,12000),full_details:field(b.full_details,20000),application_link:cleanUrl(b.application_link),official_source:cleanUrl(b.official_source),image_url:cleanImageUrl(b.image_url),tags:field(b.tags,800)};
  const r=await context.env.DB.prepare(`INSERT INTO opportunities(slug,title,category,organization,country,city,funding,degree_level,deadline,published_date,featured,status,short_description,eligibility,full_details,application_link,official_source,image_url,tags,created_by,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(values.slug,values.title,values.category,values.organization,values.country,values.city,values.funding,values.degree_level,values.deadline,values.published_date,values.featured,values.status,values.short_description,values.eligibility,values.full_details,values.application_link,values.official_source,values.image_url,values.tags,a.user.id,a.user.id).run();
  const item=await context.env.DB.prepare('SELECT * FROM opportunities WHERE id=?').bind(r.meta.last_row_id).first(); return json({ok:true,item},201);
}

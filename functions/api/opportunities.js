import { ensureSchema } from '../_lib/db.js';
import { json } from '../_lib/http.js';
const ALLOWED = new Set(['Scholarship','Admission','Internship','Fellowship','Job','Scheme','Update']);
export async function onRequestGet(context){
  await ensureSchema(context.env);
  if(!context.env.DB) return json({ok:true,items:[],databaseConfigured:false});
  const url=new URL(context.request.url); const category=url.searchParams.get('category'); const featured=url.searchParams.get('featured'); const q=(url.searchParams.get('q')||'').trim();
  const limit=Math.min(Math.max(Number(url.searchParams.get('limit')||24),1),100);
  const offset=Math.max(Number(url.searchParams.get('offset')||0),0);
  let sql=`SELECT id,slug,title,category,organization,country,city,funding,degree_level,deadline,published_date,featured,short_description,eligibility,application_link,official_source,image_url,tags,updated_at FROM opportunities WHERE status='published' AND LENGTH(TRIM(title))>=5 AND LOWER(TRIM(title)) NOT IN ('home','homepage','home page','funding','funding option','funding options','funding programme','funding programmes','funding program','funding programs','scholarship','scholarships','fellowship','fellowships','internship','internships','admission','admissions','job','jobs','scheme','schemes','update','updates','opportunity','opportunities','programme','programmes','program','programs','read more','learn more','apply now','view details','click here','overview','search','news','all','more','menu','finding scholarships','find scholarships','search scholarships','scholarship search','scholarship database','funding database','find funding','search funding','funding opportunities','study scholarships','study funding','programme search','program search','course search','search programmes','search programs','all scholarships','all opportunities','opportunity search')`;
  const binds=[];
  if(category && ALLOWED.has(category)){sql+=' AND category=?';binds.push(category);}
  if(featured==='1'){sql+=' AND featured=1';}
  if(q){sql+=' AND (title LIKE ? OR short_description LIKE ? OR organization LIKE ? OR country LIKE ? OR tags LIKE ?)';const x=`%${q}%`;binds.push(x,x,x,x,x);}
  sql+=' ORDER BY COALESCE(published_date,created_at) DESC, id DESC LIMIT ? OFFSET ?';binds.push(limit,offset);
  const result=await context.env.DB.prepare(sql).bind(...binds).all();
  return json({ok:true,items:result.results||[],databaseConfigured:true},200,{'cache-control':'public, max-age=15'});
}

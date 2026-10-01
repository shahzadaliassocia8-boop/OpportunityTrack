import { ensureSchema } from '../_lib/db.js';
import { json } from '../_lib/http.js';
const ALLOWED = new Set(['Scholarship','Admission','Internship','Fellowship','Job','Scheme','Update']);
export async function onRequestGet(context){
  await ensureSchema(context.env);
  if(!context.env.DB) return json({ok:true,items:[],databaseConfigured:false});
  const url=new URL(context.request.url); const category=url.searchParams.get('category'); const featured=url.searchParams.get('featured'); const q=(url.searchParams.get('q')||'').trim();
  const limit=Math.min(Math.max(Number(url.searchParams.get('limit')||24),1),100);
  let sql=`SELECT id,slug,title,category,organization,country,city,funding,degree_level,deadline,published_date,featured,short_description,eligibility,application_link,official_source,tags,updated_at FROM opportunities WHERE status='published'`;
  const binds=[];
  if(category && ALLOWED.has(category)){sql+=' AND category=?';binds.push(category);}
  if(featured==='1'){sql+=' AND featured=1';}
  if(q){sql+=' AND (title LIKE ? OR short_description LIKE ? OR organization LIKE ? OR country LIKE ? OR tags LIKE ?)';const x=`%${q}%`;binds.push(x,x,x,x,x);}
  sql+=' ORDER BY COALESCE(published_date,created_at) DESC, id DESC LIMIT ?';binds.push(limit);
  const result=await context.env.DB.prepare(sql).bind(...binds).all();
  return json({ok:true,items:result.results||[],databaseConfigured:true},200,{'cache-control':'public, max-age=15'});
}

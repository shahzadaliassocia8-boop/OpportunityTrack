import { ensureSchema } from './_lib/db.js';
function x(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
export async function onRequestGet(context){
  await ensureSchema(context.env);
  const origin=new URL(context.request.url).origin;
  const core=['/','/scholarships','/admissions','/internships','/fellowships','/jobs','/schemes','/updates','/guides','/guide-scholarship-application','/guide-sop-motivation-letter','/guide-cv','/guide-ielts','/guide-hat-gre','/guide-student-visa','/about','/faq','/contact','/privacy-policy'];
  let urls=core.map(p=>`<url><loc>${x(origin+p)}</loc></url>`);
  if(context.env.DB){try{const r=await context.env.DB.prepare("SELECT slug,COALESCE(updated_at,published_date,created_at) AS lastmod FROM opportunities WHERE status='published' ORDER BY id DESC LIMIT 5000").all();for(const o of r.results||[]){urls.push(`<url><loc>${x(origin+'/opportunities/'+encodeURIComponent(o.slug))}</loc>${o.lastmod?`<lastmod>${x(String(o.lastmod).slice(0,10))}</lastmod>`:''}</url>`);}}catch{}}
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>`,{headers:{'content-type':'application/xml; charset=utf-8','cache-control':'public, max-age=300'}});
}

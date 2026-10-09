const CATEGORIES = ['Scholarship','Admission','Internship','Fellowship','Job','Scheme','Update'];
const KEYWORDS = /(scholarship|fellowship|internship|admission|studentship|grant|funding|funded|exchange|traineeship|vacanc|job|career|programme|program|scheme|opportunit|award|bursary|doctoral|phd|master|postdoc|deadline|announcement|notice)/i;
const EXCLUDE = /(privacy|cookie|terms|login|sign[ -]?in|register|contact|about|facebook|instagram|linkedin|twitter|youtube|javascript:|mailto:|tel:|#|breadcrumb|navigation|skip to|site map|sitemap)/i;

function sourceCategories(source){
  let arr=[];
  const raw=source?.allowed_categories;
  if(Array.isArray(raw)) arr=raw;
  else if(raw){
    try{const j=JSON.parse(raw);arr=Array.isArray(j)?j:String(raw).split(',');}
    catch{arr=String(raw).split(',');}
  }
  arr=arr.map(x=>String(x||'').trim()).filter(x=>CATEGORIES.includes(x));
  arr=[...new Set(arr)];
  if(!arr.length && CATEGORIES.includes(source?.default_category)) arr=[source.default_category];
  return arr.length?arr:['Scholarship'];
}
function explicitCategory(text=''){
  const t=String(text||'').toLowerCase();
  // Prefer specific opportunity types before broad words such as “funding” or “programme”.
  if(/admission|apply for (a |the )?(bachelor|master|phd)|enrol|enroll|degree programme|degree program/.test(t)) return 'Admission';
  if(/internship|\bintern\b|traineeship|trainee/.test(t)) return 'Internship';
  if(/fellowship|\bfellow\b|research fellow|exchange program|exchange programme/.test(t)) return 'Fellowship';
  if(/\bjob\b|vacanc|career|position|opening|employment/.test(t)) return 'Job';
  if(/scholarship|bursary|studentship|tuition|funding|funded/.test(t)) return 'Scholarship';
  if(/scheme|\bgrant\b|\baward\b|\bprogram\b|\bprogramme\b/.test(t)) return 'Scheme';
  if(/update|deadline|announcement|notice/.test(t)) return 'Update';
  return '';
}
function classifyForSource(text, source){
  const allowed=sourceCategories(source);
  const explicit=explicitCategory(text);
  if(explicit) return allowed.includes(explicit)?explicit:'';
  const fallback=CATEGORIES.includes(source?.default_category)?source.default_category:allowed[0];
  return allowed.includes(fallback)?fallback:allowed[0];
}

function decodeEntities(s=''){
  return String(s)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1')
    .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
    .replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'")
    .replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCharCode(parseInt(n,16)));
}
function stripTags(s=''){
  return decodeEntities(String(s).replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim();
}
function cleanTitle(s=''){return stripTags(s).replace(/\s+[|–—-]\s+[^|–—-]{2,60}$/,'').trim().slice(0,260);}
function cleanSummary(s=''){return stripTags(s).slice(0,1200);}
const GENERIC_TITLE_RE=/^(?:home|homepage|home page|funding|funding options?|funding programmes?|funding programs?|scholarships?|fellowships?|internships?|admissions?|jobs?|schemes?|updates?|opportunities?|programmes?|programs?|read more|learn more|apply now|view details|click here|overview|search|news|all|more|menu|finding\ scholarships|find\ scholarships|search\ scholarships|scholarship\ search|scholarship\ database|funding\ database|find\ funding|search\ funding|funding\ opportunities|study\ scholarships|study\ funding|programme\ search|program\ search|course\ search|search\ programmes|search\ programs|all\ scholarships|all\ opportunities|opportunity\ search)$/i;
function usefulTitle(title=''){const t=cleanTitle(title).replace(/\s+/g,' ').trim();return t.length>=5 && !GENERIC_TITLE_RE.test(t);}
function normalizeUrl(raw, base){
  try{
    const u=new URL(raw,base); if(!/^https?:$/.test(u.protocol)) return '';
    const h=u.hostname.toLowerCase();
    if(h==='localhost'||h.endsWith('.local')||h==='0.0.0.0'||h==='::1'||/^127\./.test(h)||/^10\./.test(h)||/^192\.168\./.test(h)||/^169\.254\./.test(h)||/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return '';
    u.hash='';
    ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','fbclid','gclid'].forEach(k=>u.searchParams.delete(k));
    return u.href;
  }catch{return '';}
}
function classify(title, source){return classifyForSource(title,source);}
function firstTag(block,names){
  for(const name of names){
    const re=new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`,'i'); const m=block.match(re); if(m) return m[1];
  }
  return '';
}
function feedLink(block, base){
  let m=block.match(/<link(?:\s[^>]*)?href=["']([^"']+)["'][^>]*\/?\s*>/i); if(m) return normalizeUrl(m[1],base);
  const simple=firstTag(block,['link']); if(simple && !/<[^>]+>/.test(simple)) return normalizeUrl(stripTags(simple),base);
  return '';
}
function parseFeed(text, base, source){
  const blocks=[...text.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map(m=>m[0]);
  if(!blocks.length) blocks.push(...[...text.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)].map(m=>m[0]));
  const out=[];
  for(const b of blocks.slice(0,100)){
    const title=cleanTitle(firstTag(b,['title']));
    let url=feedLink(b,base);
    if(!url){const id=stripTags(firstTag(b,['guid','id'])); if(/^https?:\/\//i.test(id)) url=normalizeUrl(id,base);}
    if(!usefulTitle(title)||!url) continue;
    const summary=cleanSummary(firstTag(b,['description','summary','content','content:encoded']));
    const date=stripTags(firstTag(b,['pubDate','published','updated','dc:date'])).slice(0,120);
    const detected=classify(`${title} ${summary} ${url}`,source); if(!detected) continue;
    out.push({title,url,summary,source_published_date:date,detected_category:detected});
  }
  return out;
}
function discoverFeedUrl(html, base){
  const m=html.match(/<link\b[^>]*rel=["'][^"']*alternate[^"']*["'][^>]*type=["']application\/(?:rss\+xml|atom\+xml)["'][^>]*href=["']([^"']+)["'][^>]*>/i)
    || html.match(/<link\b[^>]*type=["']application\/(?:rss\+xml|atom\+xml)["'][^>]*href=["']([^"']+)["'][^>]*>/i);
  return m?normalizeUrl(m[1],base):'';
}
function parseHtmlLinks(html, base, source){
  let host=''; try{host=new URL(base).hostname.replace(/^www\./,'');}catch{}
  const seen=new Set(), out=[];
  const re=/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for(const m of html.matchAll(re)){
    if(out.length>=60) break;
    const title=cleanTitle(m[2]); if(!usefulTitle(title) || title.length<8 || !KEYWORDS.test(title) || EXCLUDE.test(title)) continue;
    if(/^(?:find|search|browse|explore|all)\s+(?:scholarships?|funding|opportunities?|programmes?|programs?)$/i.test(title)) continue;
    const url=normalizeUrl(m[1],base); if(!url || seen.has(url)) continue;
    try{
      const u=new URL(url), b=new URL(base);
      const h=u.hostname.replace(/^www\./,'');
      if(host && h!==host && !h.endsWith('.'+host) && !host.endsWith('.'+h)) continue;
      // Never treat the source page itself or a plain site-home link as an opportunity.
      const cleanU=u.href.replace(/\/$/,'').replace(/#.*$/,'');
      const cleanB=b.href.replace(/\/$/,'').replace(/#.*$/,'');
      if(cleanU===cleanB) continue;
      if((u.pathname==='/' || u.pathname==='') && !u.search) continue;
    }catch{continue;}
    const detected=classify(`${title} ${url}`,source); if(!detected) continue;
    seen.add(url); out.push({title,url,summary:'',source_published_date:'',detected_category:detected});
  }
  return out;
}
async function fetchText(url){
  const res=await fetch(url,{redirect:'follow',headers:{'user-agent':'OpportunityTrackBot/1.0 (+official opportunity monitoring; human review before publication)','accept':'application/rss+xml, application/atom+xml, application/xml, text/xml, application/feed+json, application/json, text/html;q=0.9, */*;q=0.1'}});
  const len=Number(res.headers.get('content-length')||0); if(len>3_000_000) throw new Error('Source response is too large to process safely.');
  const text=(await res.text()).slice(0,3_000_000);
  return {res,text,contentType:(res.headers.get('content-type')||'').toLowerCase()};
}
function parseJsonFeed(text, base, source){
  try{
    const data=JSON.parse(text); const arr=Array.isArray(data)?data:(data.items||data.results||data.entries||[]); if(!Array.isArray(arr)) return [];
    return arr.slice(0,100).map(x=>{const title=cleanTitle(x.title||x.name||''); const url=normalizeUrl(x.url||x.external_url||x.link||x.id||'',base); if(!usefulTitle(title)||!url)return null;const summary=cleanSummary(x.summary||x.description||x.content_text||'');const detected=classify(`${title} ${summary} ${url}`,source);if(!detected)return null;return {title,url,summary,source_published_date:String(x.date_published||x.published_at||x.date||'').slice(0,120),detected_category:detected};}).filter(Boolean);
  }catch{return [];}
}

export async function scanSource(source){
  const start=Date.now();
  const first=await fetchText(source.url);
  if(!first.res.ok) throw Object.assign(new Error(`Official source returned HTTP ${first.res.status}.`),{httpStatus:first.res.status});
  let items=[], mode=source.source_type||'auto', checkedUrl=first.res.url||source.url, httpStatus=first.res.status;
  const looksFeed=/rss|atom|xml/.test(first.contentType)||/<(?:rss|feed)\b/i.test(first.text.slice(0,2000));
  const looksJson=/json/.test(first.contentType)||/^\s*[\[{]/.test(first.text);
  if(mode==='rss' || (mode==='auto'&&looksFeed)) items=parseFeed(first.text,checkedUrl,source);
  else if(mode==='auto'&&looksJson) items=parseJsonFeed(first.text,checkedUrl,source);
  else {
    if(mode==='auto'){
      const feed=discoverFeedUrl(first.text,checkedUrl);
      if(feed){
        try{const second=await fetchText(feed); if(second.res.ok){items=parseFeed(second.text,second.res.url||feed,source);checkedUrl=second.res.url||feed;httpStatus=second.res.status;mode='rss';}}
        catch{/* fall back to HTML discovery */}
      }
    }
    if(!items.length) items=parseHtmlLinks(first.text,checkedUrl,source);
  }
  const dedup=new Map(); for(const x of items){if(x.url&&!dedup.has(x.url))dedup.set(x.url,x);} items=[...dedup.values()].slice(0,40);
  return {items,mode,httpStatus,checkedUrl,durationMs:Date.now()-start};
}

export async function checkSource(env, source){
  const now=new Date().toISOString();
  try{
    const result=await scanSource(source); let added=0;
    for(const item of result.items){
      const existing=await env.DB.prepare(`SELECT id FROM opportunities WHERE official_source=? OR application_link=? LIMIT 1`).bind(item.url,item.url).first();
      // Avoid duplicate Pending Review cards when the same official URL is discovered by more than one source.
      const seen=await env.DB.prepare(`SELECT id,opportunity_id,status FROM source_items WHERE url=? LIMIT 1`).bind(item.url).first();
      if(seen && !existing) continue;
      const initialStatus=existing?'imported':'pending';
      const run=await env.DB.prepare(`INSERT OR IGNORE INTO source_items(source_id,external_key,title,url,summary,detected_category,source_published_date,status,opportunity_id) VALUES(?,?,?,?,?,?,?,?,?)`)
        .bind(source.id,item.url,item.title,item.url,item.summary||'',item.detected_category||sourceCategories(source)[0],item.source_published_date||'',initialStatus,existing?.id||null).run();
      if((run.meta?.changes||0)>0 && !existing) added++;
    }
    await env.DB.prepare(`UPDATE official_sources SET last_checked_at=?,last_success_at=?,last_http_status=?,last_error=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .bind(now,now,result.httpStatus,source.id).run();
    return {ok:true,sourceId:source.id,name:source.name,found:result.items.length,added,mode:result.mode,httpStatus:result.httpStatus,durationMs:result.durationMs};
  }catch(e){
    await env.DB.prepare(`UPDATE official_sources SET last_checked_at=?,last_http_status=?,last_error=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .bind(now,Number(e.httpStatus||0)||null,String(e.message||'Source check failed').slice(0,800),source.id).run();
    return {ok:false,sourceId:source.id,name:source.name,error:String(e.message||'Source check failed'),httpStatus:Number(e.httpStatus||0)||null};
  }
}

export async function checkAllSources(env,{force=false,limit=8}={}){
  const r=await env.DB.prepare(`SELECT * FROM official_sources WHERE active=1 ORDER BY COALESCE(last_checked_at,'') ASC,id ASC LIMIT ?`).bind(Math.max(1,Math.min(Number(limit)||8,20))).all();
  const now=Date.now();
  const due=(r.results||[]).filter(source=>{
    if(force||!source.last_checked_at)return true;
    const age=now-new Date(source.last_checked_at).getTime();
    return !Number.isFinite(age)||age>=Number(source.check_interval_hours||12)*3600_000;
  });
  const results=[];
  for(let i=0;i<due.length;i+=3){
    const batch=await Promise.all(due.slice(i,i+3).map(source=>checkSource(env,source)));
    results.push(...batch);
  }
  return results;
}

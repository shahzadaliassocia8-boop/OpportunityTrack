const COUNTRY_NAMES = [
  'Germany','Spain','France','Italy','Netherlands','Belgium','Switzerland','Austria','Sweden','Norway','Denmark','Finland','Ireland','Portugal','Poland','Czech Republic','Hungary','Greece','United Kingdom','UK','United States','USA','Canada','Australia','New Zealand','Japan','China','South Korea','Singapore','United Arab Emirates','UAE','Saudi Arabia','Qatar','Pakistan','India','Türkiye','Turkey','South Africa','Brazil','Mexico'
];

function decodeEntities(s=''){
  return String(s)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1')
    .replace(/&nbsp;/gi,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
    .replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'")
    .replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCharCode(parseInt(n,16)));
}
function stripTags(s=''){
  return decodeEntities(String(s)
    .replace(/<script[\s\S]*?<\/script>/gi,' ')
    .replace(/<style[\s\S]*?<\/style>/gi,' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi,' ')
    .replace(/<br\s*\/?\s*>/gi,'\n')
    .replace(/<\/p\s*>/gi,'\n')
    .replace(/<\/li\s*>/gi,'\n')
    .replace(/<[^>]+>/g,' '))
    .replace(/[\t\r ]+/g,' ').replace(/\n\s+/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
}
function oneLine(s=''){return stripTags(s).replace(/\s+/g,' ').trim();}
const GENERIC_TITLE_RE=/^(?:home|homepage|home page|funding|funding options?|funding programmes?|funding programs?|scholarships?|fellowships?|internships?|admissions?|jobs?|schemes?|updates?|opportunities?|programmes?|programs?|read more|learn more|apply now|view details|click here|overview|search|news|all|more|menu)$/i;
function usefulTitle(s=''){const t=oneLine(s);return t.length>=5&&!GENERIC_TITLE_RE.test(t);}
function clip(s='',n=500){return String(s||'').trim().slice(0,n);}
function safeUrl(raw){
  try{
    const u=new URL(String(raw||''));
    if(!/^https?:$/.test(u.protocol)) return '';
    const h=u.hostname.toLowerCase();
    if(h==='localhost'||h.endsWith('.local')||h==='0.0.0.0'||h==='::1'||/^127\./.test(h)||/^10\./.test(h)||/^192\.168\./.test(h)||/^169\.254\./.test(h)||/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return '';
    return u.href;
  }catch{return '';}
}

function absoluteUrl(raw,base){
  try{const u=new URL(String(raw||''),base);return safeUrl(u.href);}catch{return '';}
}
function findApplicationLink(html,baseUrl){
  const base=safeUrl(baseUrl); if(!base)return '';
  let baseObj=null; try{baseObj=new URL(base);}catch{}
  const candidates=[];
  const re=/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for(const m of html.matchAll(re)){
    const href=absoluteUrl(m[1],base); if(!href)continue;
    let u; try{u=new URL(href);}catch{continue;}
    const label=oneLine(m[2]).toLowerCase(); const path=(u.pathname+' '+u.search).toLowerCase();
    if(/(?:facebook|instagram|linkedin|twitter|youtube|privacy|cookie|terms|login|sign[- ]?in)/i.test(label+' '+path))continue;
    let score=0;
    if(/apply now|start application|submit application|application portal|apply online|online application|apply here/.test(label))score+=10;
    else if(/\bapply\b/.test(label))score+=7;
    else if(/application/.test(label))score+=4;
    if(/\bapply\b|application|admission-portal|application-portal|bewerb|candidature|candidacy/.test(path))score+=5;
    if(baseObj && (u.hostname!==baseObj.hostname || u.pathname!==baseObj.pathname))score+=1;
    if(baseObj && u.href===baseObj.href)score-=12;
    if(score>0)candidates.push({href,score,label});
  }
  candidates.sort((a,b)=>b.score-a.score);
  return candidates[0]&&candidates[0].score>=6?candidates[0].href:'';
}
function escRe(s){return String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
function meta(html, key){
  const k=escRe(key);
  const patterns=[
    new RegExp(`<meta\\b[^>]*(?:name|property)=["']${k}["'][^>]*content=["']([^"']*)["'][^>]*>`,`i`),
    new RegExp(`<meta\\b[^>]*content=["']([^"']*)["'][^>]*(?:name|property)=["']${k}["'][^>]*>`,`i`)
  ];
  for(const re of patterns){const m=html.match(re);if(m)return oneLine(m[1]);}
  return '';
}
function firstTag(html,tag){const m=html.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`,'i'));return m?oneLine(m[1]):'';}
function sectionText(html, labels){
  for(const label of labels){
    const re=new RegExp(`<h[1-4]\\b[^>]*>[^<]*(?:${label})[^<]*<\\/h[1-4]>([\\s\\S]*?)(?=<h[1-4]\\b|<footer\\b|$)`,'i');
    const m=html.match(re); if(m){const t=stripTags(m[1]); if(t) return clip(t,1600);}
  }
  return '';
}
function labelValue(text, labels, max=240){
  const lines=String(text||'').split(/\n+/).map(x=>x.trim()).filter(Boolean);
  for(const label of labels){
    const re=new RegExp(`^(?:${label})\\s*[:–—-]\\s*(.{2,${max}})$`,'i');
    for(const line of lines){const m=line.match(re);if(m)return clip(m[1],max);}
  }
  return '';
}
function normalizeDate(raw=''){
  const s=oneLine(raw); if(!s)return '';
  const direct=s.match(/\b(20\d{2})[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])\b/);
  if(direct)return `${direct[1]}-${String(direct[2]).padStart(2,'0')}-${String(direct[3]).padStart(2,'0')}`;
  const d=new Date(s); if(!Number.isNaN(d.getTime()) && d.getFullYear()>2000 && d.getFullYear()<2100)return d.toISOString().slice(0,10);
  return clip(s,80);
}
function findDate(text){
  const m=String(text||'').match(/(?:application\s+deadline|deadline|closing\s+date|apply\s+by)\s*[:–—-]?\s*([^\n.;]{4,80})/i);
  return m?normalizeDate(m[1]):'';
}
function findCountry(text){
  const labeled=labelValue(text,['country','host country','location'],120);
  if(labeled){for(const c of COUNTRY_NAMES){if(new RegExp(`\\b${escRe(c)}\\b`,'i').test(labeled))return c==='UK'?'United Kingdom':c==='USA'?'United States':c==='UAE'?'United Arab Emirates':c==='Turkey'?'Türkiye':c;}}
  const compact=String(text||'').slice(0,5000);
  for(const c of COUNTRY_NAMES){if(new RegExp(`\\b${escRe(c)}\\b`,'i').test(compact))return c==='UK'?'United Kingdom':c==='USA'?'United States':c==='UAE'?'United Arab Emirates':c==='Turkey'?'Türkiye':c;}
  return '';
}
function findDegree(text){
  const t=String(text||'').toLowerCase(); const v=[];
  if(/\bbachelor'?s?\b|undergraduate/.test(t))v.push("Bachelor's");
  if(/\bmaster'?s?\b|postgraduate/.test(t))v.push("Master's");
  if(/\bph\.?d\b|doctoral/.test(t))v.push('PhD / Doctoral');
  if(/postdoc|post-doctor/.test(t))v.push('Postdoctoral');
  if(/researcher|research staff|scientist/.test(t))v.push('Researchers');
  if(/artist|musician|creative/.test(t))v.push('Artists / Creatives');
  if(/professional/.test(t))v.push('Professionals');
  return [...new Set(v)].slice(0,4).join(', ');
}
function findFunding(text){
  const labeled=labelValue(text,['funding','funding type','scholarship value','award value','financial support','benefits'],180);
  if(labeled)return labeled;
  const t=String(text||'');
  if(/fully[- ]funded/i.test(t))return 'Fully funded';
  if(/partial(?:ly)?[- ]funded/i.test(t))return 'Partial funding';
  if(/tuition waiver/i.test(t))return 'Tuition waiver / funding support';
  if(/stipend/i.test(t))return 'Stipend / funding support';
  return '';
}
function cleanOrgName(sourceName=''){
  return oneLine(sourceName).replace(/\b(scholarships?|fellowships?|internships?|admissions?|jobs?|schemes?|updates?|official)\b/gi,' ').replace(/\s+/g,' ').trim();
}
function walkJson(node,out=[]){
  if(Array.isArray(node)){for(const x of node)walkJson(x,out);return out;}
  if(node&&typeof node==='object'){out.push(node);if(node['@graph'])walkJson(node['@graph'],out);for(const v of Object.values(node)){if(v&&typeof v==='object'&&v!==node['@graph'])walkJson(v,out);}}
  return out;
}
function jsonLdObjects(html){
  const out=[]; for(const m of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
    try{const data=JSON.parse(decodeEntities(m[1]).trim());walkJson(data,out);}catch{}
  } return out;
}
function nameOf(v){return typeof v==='string'?oneLine(v):v&&typeof v==='object'?oneLine(v.name||v.legalName||''):'';}
function jsonField(objs,keys){for(const o of objs){for(const k of keys){if(o?.[k])return o[k];}}return null;}
function extractFromJsonLd(html){
  const objs=jsonLdObjects(html); if(!objs.length)return {};
  let org='',country='',city='';
  for(const o of objs){
    org ||= nameOf(o.hiringOrganization)||nameOf(o.provider)||nameOf(o.organizer)||nameOf(o.publisher)||nameOf(o.sponsor);
    const loc=o.jobLocation||o.location||o.contentLocation;
    const addr=loc?.address||loc;
    if(addr&&typeof addr==='object'){country ||= nameOf(addr.addressCountry)||oneLine(addr.addressCountry||'');city ||= oneLine(addr.addressLocality||'');}
  }
  return {
    title:oneLine(jsonField(objs,['headline','name'])||''),
    description:oneLine(jsonField(objs,['description','abstract'])||''),
    organization:org,
    country,city,
    deadline:normalizeDate(jsonField(objs,['applicationDeadline','validThrough','endDate'])||''),
    published_date:normalizeDate(jsonField(objs,['datePublished','datePosted','dateCreated'])||''),
    application_link:safeUrl(jsonField(objs,['applicationUrl'])||'')
  };
}
function eligibilitySignals(section='',allText=''){
  const t=`${section} ${allText}`.toLowerCase(); const signals=[];
  if(/bachelor|undergraduate/.test(t))signals.push("Bachelor's-level background where applicable");
  if(/master|postgraduate/.test(t))signals.push("Master's-level background where applicable");
  if(/ph\.?d|doctoral/.test(t))signals.push('doctoral-level applicants where applicable');
  if(/researcher|scientist|academic/.test(t))signals.push('research or academic background');
  if(/professional|work experience|experience/.test(t))signals.push('relevant professional experience');
  if(/nationality|citizen|citizenship|resident|residency/.test(t))signals.push('nationality or residency conditions');
  if(/english|ielts|toefl|language proficiency|language requirement/.test(t))signals.push('language requirements');
  if(/age limit|under the age|maximum age/.test(t))signals.push('age conditions');
  if(/portfolio|audition|artist|musician/.test(t))signals.push('portfolio or discipline-specific requirements');
  return [...new Set(signals)].slice(0,6);
}

function buildOriginalCopy(f){
  const cat=(f.category||'Opportunity').toLowerCase();
  const org=f.organization||'the official provider';
  const place=f.country?` in ${f.country}`:'';
  const bits=[];
  if(f.funding)bits.push(`Funding/type: ${f.funding}.`);
  if(f.degree_level)bits.push(`Applicant level: ${f.degree_level}.`);
  if(f.deadline)bits.push(`The listed deadline is ${f.deadline}.`);
  const short=clip(`${f.title} is a ${cat} opportunity listed by ${org}${place}. ${bits.join(' ')} Applicants should confirm the current requirements and submission instructions on the official source before applying.`,1700);
  const signals=f.eligibilitySignals||[];
  const eligibility=signals.length
    ? `Eligibility is determined by ${org}. The official page appears to include criteria related to ${signals.join(', ')}. Confirm the exact requirements, exceptions, required documents, and any country-specific conditions on the official source before applying.`
    : `Eligibility is determined by ${org}. Review the official source for the current academic or professional background, nationality or residency conditions, experience requirements, required documents, and any programme-specific criteria before applying.`;
  const details=[
    `${f.title} is listed by ${org}${place} as a ${cat} opportunity. OpportunityTrack detected the listing from the official provider page and organized the available facts into a consistent format.`,
    f.funding?`Funding / type: ${f.funding}.`:'Funding or financial-support details should be confirmed on the official source.',
    f.degree_level?`Applicant level: ${f.degree_level}.`:'The applicable study or applicant level should be confirmed on the official source.',
    f.deadline?`Application deadline: ${f.deadline}.`:'The current application deadline should be checked on the official source.',
    `Before applying, verify the latest eligibility criteria, required documents, funding terms, dates, and submission route directly with ${org}.`
  ].join('\n\n');
  return {short,eligibility,details:clip(details,20000)};
}

export function extractOpportunityFromHtml(html,url,{sourceName='',fallbackTitle='',fallbackCategory='Update',sourcePublishedDate='',feedSummary=''}={}){
  const json=extractFromJsonLd(html); const text=stripTags(html).slice(0,180000);
  const candidates=[json.title,meta(html,'og:title'),meta(html,'twitter:title'),firstTag(html,'h1'),fallbackTitle,firstTag(html,'title')].map(oneLine).filter(Boolean); const title=clip(candidates.find(usefulTitle)||oneLine(fallbackTitle)||candidates[0]||'Opportunity',220);
  const description=clip(json.description||meta(html,'description')||meta(html,'og:description')||feedSummary||'',1200);
  const organization=clip(json.organization||meta(html,'author')||cleanOrgName(sourceName),220);
  const deadline=json.deadline||findDate(text);
  const country=clip(json.country||findCountry(`${title}\n${description}\n${text.slice(0,5000)}`),120);
  const city=clip(json.city||'',120);
  const funding=clip(findFunding(`${title}\n${description}\n${text.slice(0,50000)}`),180);
  const degree_level=clip(findDegree(`${title}\n${description}\n${text.slice(0,50000)}`),180);
  const eligibilityExtract=sectionText(html,['eligib','who can apply','requirements?','target group','applicant']);
  const eligSignals=eligibilitySignals(eligibilityExtract,`${title} ${description}`);
  const category=fallbackCategory||'Update';
  const published_date=json.published_date||normalizeDate(sourcePublishedDate)||new Date().toISOString().slice(0,10);
  const application_link=json.application_link||findApplicationLink(html,url)||'';
  const facts={title,category,organization,country,city,funding,degree_level,deadline,published_date,application_link,official_source:safeUrl(url),eligibilitySignals:eligSignals};
  const copy=buildOriginalCopy(facts);
  const tags=[category,organization,country,degree_level].filter(Boolean).join(', ');
  return {...facts,short_description:copy.short,eligibility:copy.eligibility,full_details:copy.details,tags,featured:0,status:'draft'};
}

export async function enrichOpportunityFromOfficialPage(item,source){
  const url=safeUrl(item.url); if(!url)throw new Error('The official source URL is not safe or valid.');
  const res=await fetch(url,{redirect:'follow',headers:{'user-agent':'OpportunityTrackBot/1.1 (+official opportunity review import)','accept':'text/html,application/xhtml+xml;q=0.9,application/json;q=0.6,*/*;q=0.2'}});
  if(!res.ok)throw new Error(`Official page returned HTTP ${res.status}.`);
  const len=Number(res.headers.get('content-length')||0); if(len>3_000_000)throw new Error('Official page is too large to auto-fill safely.');
  const html=(await res.text()).slice(0,3_000_000);
  return extractOpportunityFromHtml(html,res.url||url,{sourceName:source?.name||'',fallbackTitle:item.title||'',fallbackCategory:item.detected_category||source?.default_category||'Update',sourcePublishedDate:item.source_published_date||'',feedSummary:item.summary||''});
}

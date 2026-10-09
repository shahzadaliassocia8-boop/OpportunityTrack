function esc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
const PALETTES={Scholarship:['#0e4e78','#58a9ce'],Admission:['#423d8f','#8878dc'],Internship:['#12695b','#58bca1'],Fellowship:['#733f78','#c47bb7'],Job:['#294d67','#6f93aa'],Scheme:['#865718','#d7a04a'],Update:['#66503a','#ae8c69']};
function wrap(text,max=28,limit=3){const words=String(text||'Opportunity').trim().split(/\s+/);const lines=[];let line='';for(const w of words){const next=(line+' '+w).trim();if(next.length>max&&line){lines.push(line);line=w;}else line=next;if(lines.length===limit-1)break;}if(line&&lines.length<limit)lines.push(line);if(words.join(' ').length>lines.join(' ').length&&lines.length)lines[lines.length-1]=lines[lines.length-1].replace(/[.…]*$/,'')+'…';return lines;}
export async function onRequestGet(context){
  const slug=String(context.params.slug||'');
  let o=null;if(context.env.DB)o=await context.env.DB.prepare(`SELECT title,category,organization,country FROM opportunities WHERE slug=? LIMIT 1`).bind(slug).first();
  const category=o?.category||'Update', title=o?.title||'Opportunity update', org=o?.organization||'OpportunityTrack', country=o?.country||'';
  const [a,b]=PALETTES[category]||PALETTES.Update;const lines=wrap(title);const ys=[286,348,410];
  const titleSvg=lines.map((x,i)=>`<text x="80" y="${ys[i]}" font-size="46" font-weight="800" fill="#fff" font-family="Arial,Helvetica,sans-serif">${esc(x)}</text>`).join('');
  const initials=esc(category.slice(0,2).toUpperCase());
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="${esc(title)}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient><filter id="s"><feDropShadow dx="0" dy="14" stdDeviation="24" flood-opacity=".18"/></filter></defs>
  <rect width="1200" height="630" rx="34" fill="url(#g)"/>
  <circle cx="1030" cy="120" r="150" fill="#fff" opacity=".08"/><circle cx="1100" cy="520" r="210" fill="#fff" opacity=".07"/><path d="M0 520 C260 430 360 610 620 500 S920 420 1200 500 V630 H0Z" fill="#fff" opacity=".07"/>
  <g filter="url(#s)"><rect x="72" y="68" width="112" height="112" rx="28" fill="#fff" opacity=".96"/><text x="128" y="139" text-anchor="middle" font-size="42" font-weight="900" fill="${a}" font-family="Arial,Helvetica,sans-serif">${initials}</text></g>
  <text x="210" y="112" font-size="27" font-weight="800" fill="#fff" font-family="Arial,Helvetica,sans-serif">OpportunityTrack</text><text x="210" y="148" font-size="20" fill="#fff" opacity=".82" font-family="Arial,Helvetica,sans-serif">${esc(category)} opportunity</text>
  ${titleSvg}
  <rect x="80" y="482" width="760" height="1" fill="#fff" opacity=".25"/><text x="80" y="530" font-size="23" font-weight="700" fill="#fff" opacity=".95" font-family="Arial,Helvetica,sans-serif">${esc(org)}</text><text x="80" y="566" font-size="19" fill="#fff" opacity=".78" font-family="Arial,Helvetica,sans-serif">${esc(country||'Details, eligibility and application guidance')}</text>
  <g transform="translate(910 260)" opacity=".92"><rect x="0" y="0" width="180" height="150" rx="32" fill="#fff" opacity=".16"/><path d="M40 62 90 36l50 26-50 26-50-26Zm20 17v33c20 18 40 18 60 0V79" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/><path d="M140 66v45" stroke="#fff" stroke-width="9" stroke-linecap="round"/></g>
  </svg>`;
  return new Response(svg,{headers:{'content-type':'image/svg+xml; charset=utf-8','cache-control':'public, max-age=3600','x-content-type-options':'nosniff'}});
}
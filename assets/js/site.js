(() => {
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const escapeHtml=(s='')=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
  const GENERIC_TITLES=new Set(['home','homepage','funding options','funding option','scholarship','scholarships','fellowship','fellowships','internship','internships','admission','admissions','job','jobs','scheme','schemes','update','updates','read more','learn more','apply now','view details','click here','finding scholarships','find scholarships','search scholarships','scholarship search','scholarship database','funding database','find funding','search funding','all scholarships','all opportunities','opportunity search']);
  const qualityItem=i=>{
    const t=String(i?.title||'').trim().toLowerCase().replace(/\s+/g,' ');
    return t.length>=5 && !GENERIC_TITLES.has(t) && !/^welcome\b/.test(t);
  };
  const parseDate=v=>{const raw=String(v||'').trim();const m=raw.match(/^(20\d{2})-(\d{2})-(\d{2})$/);const d=m?new Date(Number(m[1]),Number(m[2])-1,Number(m[3]),12,0,0):new Date(raw);return Number.isNaN(d.getTime())?null:d;};
  const formatDate=v=>{const d=parseDate(v);return d?new Intl.DateTimeFormat(undefined,{day:'numeric',month:'short',year:'numeric'}).format(d):String(v||'');};
  const categoryClass=c=>String(c||'').toLowerCase().replace(/[^a-z]+/g,'-');
  const CATEGORY_COVERS={Scholarship:'/assets/img/covers/scholarship.svg',Admission:'/assets/img/covers/admission.svg',Internship:'/assets/img/covers/internship.svg',Fellowship:'/assets/img/covers/fellowship.svg',Job:'/assets/img/covers/job.svg',Scheme:'/assets/img/covers/scheme.svg',Update:'/assets/img/covers/update.svg'};
  const safeHttpsUrl=v=>{try{const u=new URL(String(v||''));return u.protocol==='https:'?u.href:'';}catch{return '';}};
  const normalizedUrl=v=>{const x=safeHttpsUrl(v);if(!x)return '';try{const u=new URL(x);u.hash='';return u.href.replace(/\/$/,'');}catch{return '';}};
  const applyFor=i=>{const a=normalizedUrl(i?.application_link),s=normalizedUrl(i?.official_source);return a&&a!==s?safeHttpsUrl(i.application_link):'';};
  const posterFor=i=>i?.slug?`/poster/${encodeURIComponent(i.slug)}`:(CATEGORY_COVERS[i?.category]||CATEGORY_COVERS.Update);
  const coverFor=i=>safeHttpsUrl(i?.image_url)||posterFor(i);

  // Navigation
  const menuBtn=$('[data-menu]'), nav=$('[data-nav]');
  if(menuBtn&&nav){
    menuBtn.addEventListener('click',()=>{const open=nav.classList.toggle('open');menuBtn.setAttribute('aria-expanded',String(open));});
    document.addEventListener('click',e=>{if(innerWidth<=980&&nav.classList.contains('open')&&!nav.contains(e.target)&&!menuBtn.contains(e.target)){nav.classList.remove('open');menuBtn.setAttribute('aria-expanded','false');}});
  }


  // Gentle reveal animation.
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window){
    const els=$$('.card,.article,.side-card,.opportunity-card,.section-head');els.forEach(el=>el.classList.add('reveal-ready'));
    const io=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('reveal-in');io.unobserve(e.target);}}),{threshold:.06});els.forEach(el=>io.observe(el));
  }

  // Public opportunity feeds
  async function loadFeed(section){
    const category=section.dataset.opportunityFeed||'', featured=section.dataset.featured==='1', limit=Number(section.dataset.limit||12);
    const target=$('[data-opportunity-cards]',section), status=$('[data-feed-status]',section), search=$('[data-feed-search]',section), country=$('[data-feed-country]',section);
    if(!target)return;
    status?.setAttribute('aria-live','polite');

    const isHome=location.pathname==='/'||location.pathname==='/index.html';
    const categoryPage=Boolean(category)&&!isHome&&Boolean($('.page-hero'));
    if(categoryPage)document.body.classList.add('category-page');

    const toolbar=$('.opportunity-toolbar',section);
    let funding=null, sort=null, deadlineMode=null, count=null, stats=null, listingNote=null;
    if(toolbar){
      funding=document.createElement('select'); funding.setAttribute('aria-label','Filter by funding or type'); funding.dataset.feedFunding=''; funding.innerHTML='<option value="">All funding/types</option>';
      sort=document.createElement('select'); sort.setAttribute('aria-label','Sort opportunities'); sort.dataset.feedSort=''; sort.innerHTML='<option value="newest">Newest first</option><option value="deadline">Deadline soon</option><option value="title">A–Z</option>';
      if(categoryPage){
        deadlineMode=document.createElement('select'); deadlineMode.setAttribute('aria-label','Filter by deadline'); deadlineMode.dataset.feedDeadline=''; deadlineMode.innerHTML='<option value="active">Active opportunities</option><option value="7">Closing in 7 days</option><option value="30">Closing in 30 days</option><option value="nodate">Deadline not listed</option><option value="all">All, including expired</option>';
      }
      count=document.createElement('div'); count.className='opportunity-count'; count.setAttribute('aria-live','polite');

      if(categoryPage){
        const plural=category.toLowerCase().endsWith('s')?category.toLowerCase():category.toLowerCase()+'s';
        const makeField=(label,control)=>{const wrap=document.createElement('label');wrap.className='filter-field';const t=document.createElement('span');t.textContent=label;wrap.append(t,control);return wrap;};
        const reset=document.createElement('button');reset.type='button';reset.className='filter-reset';reset.textContent='Reset filters';
        toolbar.classList.add('category-filter-panel');
        toolbar.replaceChildren(
          makeField('Search',search),
          makeField('Country',country),
          makeField('Funding / type',funding),
          makeField('Deadline',deadlineMode),
          makeField('Sort by',sort),
          reset
        );

        const browser=document.createElement('div');browser.className='opportunity-browser';
        const aside=document.createElement('aside');aside.className='opportunity-filter-sidebar';aside.setAttribute('aria-label','Opportunity filters');
        const filterHead=document.createElement('div');filterHead.className='filter-panel-head';filterHead.innerHTML='<span class="filter-icon" aria-hidden="true">⌕</span><div><strong>Filter opportunities</strong><span>Refine the list without leaving this page.</span></div>';
        const resultsWrap=document.createElement('div');resultsWrap.className='opportunity-results-panel';
        const listingHead=document.createElement('div');listingHead.className='listing-head';listingHead.innerHTML=`<div><span class="kicker">Browse ${escapeHtml(plural)}</span><h3>Available ${escapeHtml(plural)}</h3></div><span class="listing-note">Verified listings appear after review.</span>`;
        listingNote=$('.listing-note',listingHead);
        stats=document.createElement('div');stats.className='browse-stats';stats.innerHTML='<div><strong data-stat-active>0</strong><span>Active listings</span></div><div><strong data-stat-soon>0</strong><span>Closing in 30 days</span></div><div><strong data-stat-countries>0</strong><span>Countries</span></div>';

        toolbar.insertAdjacentElement('beforebegin',browser);
        aside.append(filterHead,toolbar,count);
        resultsWrap.append(listingHead,stats,target,status);
        browser.append(aside,resultsWrap);
        target.classList.add('list-mode');

        reset.addEventListener('click',()=>{search.value='';country.value='';funding.value='';deadlineMode.value='active';sort.value='newest';render();search.focus();});
      }else{
        toolbar.append(funding,sort);
        toolbar.insertAdjacentElement('afterend',count);
      }
    }

    let items=[];
    try{
      const params=new URLSearchParams(); if(category)params.set('category',category); if(featured)params.set('featured','1'); params.set('limit',String(Math.max(limit,100)));
      const r=await fetch('/api/opportunities?'+params.toString()); const d=await r.json(); if(!r.ok)throw new Error(d.error||'Could not load opportunities');
      const seen=new Set();
      items=(d.items||[]).filter(qualityItem).filter(i=>{const norm=x=>String(x||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();const k=`${norm(i.title)}|${norm(i.organization)}|${norm(i.category)}`;if(seen.has(k))return false;seen.add(k);return true;});
      if(country){[...new Set(items.map(x=>x.country).filter(Boolean))].sort().forEach(c=>{const o=document.createElement('option');o.value=c;o.textContent=c;country.appendChild(o);});}
      if(funding){[...new Set(items.map(x=>x.funding).filter(Boolean))].sort().slice(0,30).forEach(f=>{const o=document.createElement('option');o.value=f;o.textContent=f;funding.appendChild(o);});}
      if(stats){
        const ds=items.map(i=>daysUntil(i.deadline));
        const active=items.filter((i,idx)=>ds[idx]===null||ds[idx]>=0).length;
        const soon=items.filter((i,idx)=>ds[idx]!==null&&ds[idx]>=0&&ds[idx]<=30).length;
        const countries=new Set(items.map(i=>i.country).filter(Boolean)).size;
        $('[data-stat-active]',stats).textContent=String(active);
        $('[data-stat-soon]',stats).textContent=String(soon);
        $('[data-stat-countries]',stats).textContent=String(countries);
      }
      render();
    }catch(e){if(status){status.textContent='Live opportunity updates are temporarily unavailable. Please try again shortly.';status.className='feed-status error';status.hidden=false;}target.innerHTML='';if(count)count.textContent='';if(listingNote)listingNote.textContent='Could not load listings right now.';}

    function daysUntil(v){
      const d=parseDate(v); if(!d)return null;
      const now=new Date(); now.setHours(0,0,0,0); d.setHours(23,59,59,999);
      return Math.ceil((d-now)/86400000);
    }
    function deadlinePass(i,mode){
      const days=daysUntil(i.deadline);
      if(mode==='all')return true;
      if(mode==='nodate')return days===null;
      if(mode==='7')return days!==null&&days>=0&&days<=7;
      if(mode==='30')return days!==null&&days>=0&&days<=30;
      return days===null||days>=0;
    }

    function render(){
      const q=(search?.value||'').trim().toLowerCase(), c=country?.value||'', f=funding?.value||'', order=sort?.value||'newest', dm=deadlineMode?.value||'all';
      let visible=items.filter(i=>(!q||`${i.title} ${i.organization||''} ${i.country||''} ${i.city||''} ${i.short_description||''} ${i.funding||''} ${i.degree_level||''} ${i.tags||''}`.toLowerCase().includes(q))&&(!c||i.country===c)&&(!f||i.funding===f)&&deadlinePass(i,dm));
      visible.sort((a,b)=>{
        if(order==='title')return String(a.title||'').localeCompare(String(b.title||''));
        if(order==='deadline'){
          const ad=parseDate(a.deadline)?.getTime()||Number.MAX_SAFE_INTEGER, bd=parseDate(b.deadline)?.getTime()||Number.MAX_SAFE_INTEGER;return ad-bd;
        }
        const ad=parseDate(a.published_date||a.updated_at)?.getTime()||0, bd=parseDate(b.published_date||b.updated_at)?.getTime()||0;return bd-ad;
      });
      const total=visible.length; visible=visible.slice(0,limit);
      target.classList.toggle('single',visible.length===1&&!categoryPage);target.classList.toggle('double',visible.length===2&&!categoryPage);
      if(count)count.textContent=total?`${total} ${total===1?'opportunity':'opportunities'} match your filters`:'No matching opportunities';
      if(listingNote)listingNote.textContent=total?`Showing ${Math.min(total,limit)} of ${total} result${total===1?'':'s'}`:'Try changing one of the filters.';
      if(!visible.length){target.innerHTML='';if(status){status.innerHTML=items.length?'<strong>No matches.</strong><span>Try a broader search, another country, or reset the filters.</span>':'<strong>No verified opportunities published yet.</strong><span>New items will appear here after they are reviewed and published.</span>';status.className='feed-status empty-state';status.hidden=false;}return;}
      if(status)status.hidden=true;
      target.innerHTML=visible.map(i=>cardHtml(i,categoryPage)).join('');
      $$('img[data-cover-fallback]',target).forEach(img=>img.addEventListener('error',()=>{const fb=img.dataset.coverFallback;if(fb&&img.src!==new URL(fb,location.origin).href)img.src=fb;},{once:true}));
    }
    search?.addEventListener('input',render);country?.addEventListener('change',render);funding?.addEventListener('change',render);deadlineMode?.addEventListener('change',render);sort?.addEventListener('change',render);
  }

  function deadlineBadge(i){
    const d=parseDate(i?.deadline); if(!d)return {label:'Deadline: check details',cls:'neutral'};
    const now=new Date();now.setHours(0,0,0,0);d.setHours(23,59,59,999);const days=Math.ceil((d-now)/86400000);
    if(days<0)return {label:'Expired',cls:'expired'};
    if(days===0)return {label:'Closes today',cls:'urgent'};
    if(days===1)return {label:'1 day left',cls:'urgent'};
    if(days<=7)return {label:`${days} days left`,cls:'urgent'};
    if(days<=30)return {label:`${days} days left`,cls:'soon'};
    return {label:formatDate(i.deadline),cls:'open'};
  }

  function cardHtml(i,listVariant=false){
    const meta=[i.country,i.city].filter(Boolean).join(', ');
    const published=i.published_date?formatDate(i.published_date):'';
    const deadline=i.deadline?escapeHtml(formatDate(i.deadline)):'Check details';
    const detailsUrl=`/opportunities/${encodeURIComponent(i.slug)}`;
    const apply=applyFor(i);
    const cover=coverFor(i);
    const facts=[
      i.funding?`<div><dt>Funding / type</dt><dd>${escapeHtml(i.funding)}</dd></div>`:'',
      i.degree_level?`<div><dt>Applicant level</dt><dd>${escapeHtml(i.degree_level)}</dd></div>`:'',
      `<div class="deadline-fact"><dt>Deadline</dt><dd>${deadline}</dd></div>`
    ].filter(Boolean).join('');
    const badge=deadlineBadge(i);
    return `<article class="opportunity-card${listVariant?' list-card':''}">
      <a class="op-card-cover" href="${detailsUrl}" aria-label="View details for ${escapeHtml(i.title)}"><img src="${escapeHtml(cover)}" data-cover-fallback="${escapeHtml(posterFor(i))}" alt="${escapeHtml(i.title)} poster" loading="lazy" decoding="async" referrerpolicy="no-referrer">${listVariant?`<span class="deadline-status ${badge.cls}">${escapeHtml(badge.label)}</span>`:''}</a>
      <div class="op-card-body">
        <div class="op-card-top"><div class="opportunity-meta"><span class="meta-pill category ${categoryClass(i.category)}">${escapeHtml(i.category)}</span>${i.featured?'<span class="meta-pill featured">Featured</span>':''}</div>${published?`<span class="published-date">Published ${escapeHtml(published)}</span>`:''}</div>
        <h3><a href="${detailsUrl}">${escapeHtml(i.title)}</a></h3>
        ${(i.organization||meta)?`<div class="op-identity">${i.organization?`<strong>${escapeHtml(i.organization)}</strong>`:''}${i.organization&&meta?'<span>•</span>':''}${meta?`<span>${escapeHtml(meta)}</span>`:''}</div>`:''}
        <p class="op-summary">${escapeHtml(i.short_description||'View the opportunity details, eligibility, deadline and application guidance.')}</p>
        <dl class="op-facts">${facts}</dl>
        <div class="card-footer"><a class="btn card-btn" href="${detailsUrl}">View details</a>${apply?`<a class="btn secondary card-btn apply-btn" href="${escapeHtml(apply)}" target="_blank" rel="noopener noreferrer">Apply now ↗</a>`:''}</div>
      </div>
    </article>`;
  }
  $$('[data-opportunity-feed]').forEach(loadFeed);

  // Turn long category guides into easier-to-scan pages without hiding content.
  $$('.content-layout .article').forEach(article=>{
    const heads=$$('h2',article); if(heads.length<4)return;
    const nav=document.createElement('nav');nav.className='article-jump';nav.setAttribute('aria-label','On this page');
    const links=[];heads.slice(0,8).forEach((h,idx)=>{if(!h.id)h.id='guide-'+(idx+1);links.push(`<a href="#${h.id}">${escapeHtml(h.textContent.trim())}</a>`);});
    nav.innerHTML=`<strong>On this page</strong><div>${links.join('')}</div>`;
    const meta=$('.article-meta',article); if(meta)meta.insertAdjacentElement('afterend',nav); else article.prepend(nav);
  });

  // Search overlay + public opportunities
  const overlay=$('[data-search-overlay]'), openSearch=$$('[data-open-search]'), closeSearch=$('[data-close-search]'), searchInput=$('[data-search-input]'), results=$('[data-search-results]');
  let baseIndex=window.OPPORTUNITYTRACK_SEARCH||[], liveIndex=[];
  fetch('/api/opportunities?limit=100').then(r=>r.ok?r.json():null).then(d=>{if(d?.items)liveIndex=d.items.filter(qualityItem).map(i=>({title:i.title,desc:i.short_description,url:`/opportunities/${encodeURIComponent(i.slug)}`,keywords:`${i.category} ${i.organization||''} ${i.country||''} ${i.funding||''} ${i.degree_level||''} ${i.tags||''}`}));}).catch(()=>{});
  function renderSearch(q=''){if(!results)return;const query=q.trim().toLowerCase();const index=[...liveIndex,...baseIndex];const items=!query?index.slice(0,10):index.filter(item=>(`${item.title} ${item.desc} ${item.keywords||''}`).toLowerCase().includes(query)).slice(0,24);results.innerHTML=items.length?items.map(item=>`<a class="search-result" href="${item.url}"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.desc)}</span></a>`).join(''):'<div class="empty-message">No matching result found. Try a broader search term.</div>';}
  function showSearch(initial=''){if(!overlay)return;overlay.classList.add('open');overlay.setAttribute('aria-hidden','false');if(searchInput)searchInput.value=initial;renderSearch(initial);setTimeout(()=>searchInput?.focus(),50);}
  function hideSearch(){if(!overlay)return;overlay.classList.remove('open');overlay.setAttribute('aria-hidden','true');}
  openSearch.forEach(b=>b.addEventListener('click',()=>showSearch('')));closeSearch?.addEventListener('click',hideSearch);overlay?.addEventListener('click',e=>{if(e.target===overlay)hideSearch();});searchInput?.addEventListener('input',e=>renderSearch(e.target.value));document.addEventListener('keydown',e=>{if(e.key==='Escape')hideSearch();if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();showSearch('');}});

  // Home-page search entry point.
  const heroForm=$('[data-hero-search]'), heroInput=$('[data-hero-search-input]');
  heroForm?.addEventListener('submit',e=>{e.preventDefault();showSearch(heroInput?.value||'');});

  // Lightweight source-monitor heartbeat. It only starts a due background check; it never publishes external content.
  try{if(!sessionStorage.getItem('ot_source_heartbeat')){sessionStorage.setItem('ot_source_heartbeat','1');setTimeout(()=>fetch('/api/automation/heartbeat',{method:'POST',keepalive:true}).catch(()=>{}),1800);}}catch{}

  // Contact form: intentionally opens the visitor's email app; no message database is required.
  const form=$('[data-contact-form]');
  if(form){form.addEventListener('submit',e=>{e.preventDefault();const fd=new FormData(form),name=String(fd.get('name')||'').trim(),email=String(fd.get('email')||'').trim(),topic=String(fd.get('topic')||'General enquiry'),message=String(fd.get('message')||'').trim(),status=$('[data-form-status]');if(!name||!email||!message){if(status)status.textContent='Please complete your name, email and message.';return;}const subject=encodeURIComponent(`OpportunityTrack: ${topic}`),body=encodeURIComponent(`Name: ${name}\nEmail: ${email}\nTopic: ${topic}\n\n${message}`);location.href=`mailto:amazaikhan7@gmail.com?subject=${subject}&body=${body}`;if(status)status.textContent='Your email application should open. If it does not, email amazaikhan7@gmail.com directly.';});}
})();

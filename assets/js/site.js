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
  const CATEGORY_PHOTOS={
    Scholarship:['/assets/img/photos/scholarship-1.jpg','/assets/img/photos/scholarship-2.jpg','/assets/img/photos/scholarship-3.jpg','/assets/img/photos/scholarship-4.jpg','/assets/img/photos/scholarship-5.jpg','/assets/img/photos/scholarship-6.jpg'],
    Admission:['/assets/img/photos/admission-1.jpg','/assets/img/photos/admission-2.jpg'],
    Internship:['/assets/img/photos/internship-1.jpg','/assets/img/photos/internship-2.jpg'],
    Fellowship:['/assets/img/photos/fellowship-1.jpg','/assets/img/photos/fellowship-2.jpg'],
    Job:['/assets/img/photos/job-1.jpg','/assets/img/photos/job-2.jpg'],
    Scheme:['/assets/img/photos/scheme-1.jpg'],
    Update:['/assets/img/photos/update-1.jpg']
  };
  const safeHttpsUrl=v=>{try{const u=new URL(String(v||''));return u.protocol==='https:'?u.href:'';}catch{return '';}};
  const normalizedUrl=v=>{const x=safeHttpsUrl(v);if(!x)return '';try{const u=new URL(x);u.hash='';return u.href.replace(/\/$/,'');}catch{return '';}};
  const applyFor=i=>{const a=normalizedUrl(i?.application_link),s=normalizedUrl(i?.official_source);return a&&a!==s?safeHttpsUrl(i.application_link):'';};
  const hashString=v=>String(v||'').split('').reduce((n,ch)=>((n*31)+ch.charCodeAt(0))>>>0,7);
  const photoFallbackFor=i=>{const arr=CATEGORY_PHOTOS[i?.category]||CATEGORY_PHOTOS.Update;return arr[hashString(i?.slug||i?.title||i?.organization||i?.category)%arr.length];};
  const posterFor=i=>i?.slug?`/poster/${encodeURIComponent(i.slug)}`:(CATEGORY_COVERS[i?.category]||CATEGORY_COVERS.Update);
  const coverFor=i=>safeHttpsUrl(i?.image_url)||photoFallbackFor(i);

  // Navigation
  const menuBtn=$('[data-menu]'), nav=$('[data-nav]');
  if(menuBtn&&nav){
    menuBtn.addEventListener('click',()=>{const open=nav.classList.toggle('open');menuBtn.setAttribute('aria-expanded',String(open));});
    document.addEventListener('click',e=>{if(innerWidth<=980&&nav.classList.contains('open')&&!nav.contains(e.target)&&!menuBtn.contains(e.target)){nav.classList.remove('open');menuBtn.setAttribute('aria-expanded','false');}});
  }

  // Admin Login is rendered directly in the public footer on every page.


  // Gentle reveal animation.
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window){
    const els=$$('.card,.article,.side-card,.opportunity-card,.section-head');els.forEach(el=>el.classList.add('reveal-ready'));
    const io=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('reveal-in');io.unobserve(e.target);}}),{threshold:.06});els.forEach(el=>io.observe(el));
  }


  async function fetchAllPublished(params=new URLSearchParams()){
    const all=[];
    const pageSize=100;
    let offset=0;
    for(let page=0;page<20;page++){
      const p=new URLSearchParams(params);
      p.set('limit',String(pageSize));
      p.set('offset',String(offset));
      const r=await fetch('/api/opportunities?'+p.toString());
      const d=await r.json();
      if(!r.ok)throw new Error(d.error||'Could not load opportunities');
      const batch=d.items||[];
      all.push(...batch);
      if(batch.length<pageSize)break;
      offset+=pageSize;
    }
    return all;
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
      const params=new URLSearchParams(); if(category)params.set('category',category); if(featured)params.set('featured','1');
      const rawItems=isHome?await fetchAllPublished(params):await (async()=>{params.set('limit',String(Math.max(limit,100)));const r=await fetch('/api/opportunities?'+params.toString());const d=await r.json();if(!r.ok)throw new Error(d.error||'Could not load opportunities');return d.items||[];})();
      const seen=new Set();
      items=rawItems.filter(qualityItem).filter(i=>{const norm=x=>String(x||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();const k=`${norm(i.title)}|${norm(i.organization)}|${norm(i.category)}`;if(seen.has(k))return false;seen.add(k);return true;});
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
      const total=visible.length; visible=isHome?visible:visible.slice(0,limit);
      target.classList.toggle('single',visible.length===1&&!categoryPage);target.classList.toggle('double',visible.length===2&&!categoryPage);
      if(count)count.textContent=total?`${total} ${total===1?'opportunity':'opportunities'} match your filters`:'No matching opportunities';
      if(listingNote)listingNote.textContent=total?`Showing ${Math.min(total,limit)} of ${total} result${total===1?'':'s'}`:'Try changing one of the filters.';
      if(!visible.length){target.innerHTML='';if(status){status.innerHTML=items.length?'<strong>No matches.</strong><span>Try a broader search, another country, or reset the filters.</span>':'<strong>No verified opportunities published yet.</strong><span>New items will appear here after they are reviewed and published.</span>';status.className='feed-status empty-state';status.hidden=false;}return;}
      if(status)status.hidden=true;
      target.innerHTML=visible.map(i=>cardHtml(i,categoryPage)).join('');
      if(isHome) setupOpportunityCarousel(section,target);
      $$('img[data-cover-photo]',target).forEach(img=>img.addEventListener('error',()=>{
        const photo=img.dataset.coverPhoto||'', poster=img.dataset.coverPoster||'';
        if(photo && img.src!==new URL(photo,location.origin).href){img.src=photo;return;}
        if(poster && img.src!==new URL(poster,location.origin).href){img.src=poster;}
      }));
    }
    search?.addEventListener('input',render);country?.addEventListener('change',render);funding?.addEventListener('change',render);deadlineMode?.addEventListener('change',render);sort?.addEventListener('change',render);
  }

  function setupOpportunityCarousel(section,target){
    section.classList.add('home-opportunity-carousel');
    if(section.dataset.carouselReady==='1')return;
    section.dataset.carouselReady='1';
    const controls=document.createElement('div');
    controls.className='op-carousel-controls';
    controls.innerHTML='<button type="button" class="op-carousel-btn prev" aria-label="Previous opportunities">←</button><button type="button" class="op-carousel-btn next" aria-label="Next opportunities">→</button>';
    const head=$('.section-head',section);
    head?.appendChild(controls);
    const prev=$('.prev',controls),next=$('.next',controls);
    const step=()=>Math.max(280,(target.querySelector('.opportunity-card')?.getBoundingClientRect().width||340)+18);
    const move=dir=>target.scrollBy({left:dir*step(),behavior:'smooth'});
    prev?.addEventListener('click',()=>move(-1));
    next?.addEventListener('click',()=>move(1));
    let timer=null,paused=false;
    const start=()=>{if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;clearInterval(timer);timer=setInterval(()=>{if(paused)return;const nearEnd=target.scrollLeft+target.clientWidth>=target.scrollWidth-20;if(nearEnd)target.scrollTo({left:0,behavior:'smooth'});else move(1);},4200);};
    target.addEventListener('pointerenter',()=>paused=true);
    target.addEventListener('pointerleave',()=>paused=false);
    target.addEventListener('touchstart',()=>paused=true,{passive:true});
    target.addEventListener('touchend',()=>{setTimeout(()=>paused=false,1200)},{passive:true});
    start();
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
    const cover=coverFor(i), photo=photoFallbackFor(i), poster=posterFor(i);
    const facts=[
      i.funding?`<div><dt>Funding / type</dt><dd>${escapeHtml(i.funding)}</dd></div>`:'',
      i.degree_level?`<div><dt>Applicant level</dt><dd>${escapeHtml(i.degree_level)}</dd></div>`:'',
      `<div class="deadline-fact"><dt>Deadline</dt><dd>${deadline}</dd></div>`
    ].filter(Boolean).join('');
    const badge=deadlineBadge(i);
    return `<article class="opportunity-card${listVariant?' list-card':''}">
      <a class="op-card-cover" href="${detailsUrl}" aria-label="View details for ${escapeHtml(i.title)}"><img src="${escapeHtml(cover)}" data-cover-photo="${escapeHtml(photo)}" data-cover-poster="${escapeHtml(poster)}" alt="${escapeHtml(i.title)} cover image" loading="lazy" decoding="async" referrerpolicy="no-referrer">${listVariant?`<span class="deadline-status ${badge.cls}">${escapeHtml(badge.label)}</span>`:''}</a>
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

  // Search overlay: prioritize published opportunities only.
  const overlay=$('[data-search-overlay]'), openSearch=$$('[data-open-search]'), closeSearch=$('[data-close-search]'), searchInput=$('[data-search-input]'), results=$('[data-search-results]');
  let liveIndex=[], searchLoaded=false;
  fetchAllPublished(new URLSearchParams()).then(all=>{
    liveIndex=all.filter(qualityItem).map(i=>({
      title:i.title,desc:i.short_description,url:`/opportunities/${encodeURIComponent(i.slug)}`,
      category:i.category||'',organization:i.organization||'',country:i.country||'',city:i.city||'',funding:i.funding||'',level:i.degree_level||'',tags:i.tags||''
    }));
    searchLoaded=true;
    if(overlay?.classList.contains('open'))renderSearch(searchInput?.value||'');
  }).catch(()=>{searchLoaded=true;});
  const tokenize=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().split(/\s+/).filter(Boolean);
  function opportunityScore(item,query){
    const q=String(query||'').trim().toLowerCase();if(!q)return 1;
    const tokens=tokenize(q);if(!tokens.length)return 0;
    const title=String(item.title||'').toLowerCase(),org=String(item.organization||'').toLowerCase(),cat=String(item.category||'').toLowerCase();
    const country=String(item.country||'').toLowerCase(),funding=String(item.funding||'').toLowerCase(),level=String(item.level||'').toLowerCase();
    const body=`${item.desc||''} ${item.city||''} ${item.tags||''}`.toLowerCase();
    let score=0,matched=0;
    for(const t of tokens){let hit=0;if(title.includes(t))hit=Math.max(hit,9);if(org.includes(t))hit=Math.max(hit,7);if(cat.includes(t))hit=Math.max(hit,6);if(country.includes(t))hit=Math.max(hit,6);if(funding.includes(t))hit=Math.max(hit,5);if(level.includes(t))hit=Math.max(hit,5);if(body.includes(t))hit=Math.max(hit,2);if(hit){matched++;score+=hit;}}
    if(title.includes(q))score+=12;if(org.includes(q))score+=8;if(country.includes(q)||cat.includes(q))score+=6;
    return matched===tokens.length?score:0;
  }
  function renderSearch(q=''){
    if(!results)return;
    const query=String(q||'').trim();
    if(!searchLoaded){results.innerHTML='<div class="search-empty-professional"><div class="search-empty-icon" aria-hidden="true">⌕</div><strong>Searching published opportunities…</strong><p>OpportunityTrack is loading the latest verified listings. Your results will appear here in a moment.</p></div>';return;}
    if(!query){
      const latest=liveIndex.slice(0,8);
      results.innerHTML=latest.length?`<div class="search-result-heading"><strong>Recently published opportunities</strong><span>Type a scholarship, organization, country, funding type or job title to refine these results.</span></div>${latest.map(item=>`<a class="search-result" href="${item.url}"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml([item.category,item.organization,item.country].filter(Boolean).join(' · '))}</span><small>${escapeHtml(item.desc||'Open the opportunity for details and application guidance.')}</small></a>`).join('')}`:'<div class="search-empty-professional"><div class="search-empty-icon" aria-hidden="true">⌕</div><strong>Opportunity search is ready</strong><p>Start typing a scholarship, internship, fellowship, job, organization or country.</p></div>';
      return;
    }
    const items=liveIndex.map(item=>({item,score:opportunityScore(item,query)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,24).map(x=>x.item);
    results.innerHTML=items.length?`<div class="search-result-heading"><strong>${items.length} matching ${items.length===1?'opportunity':'opportunities'}</strong><span>Results are ranked by title, organization, category, country and opportunity details.</span></div>${items.map(item=>`<a class="search-result" href="${item.url}"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml([item.category,item.organization,item.country].filter(Boolean).join(' · '))}</span><small>${escapeHtml(item.desc||'Open the opportunity for full eligibility and application details.')}</small></a>`).join('')}`:`<div class="search-empty-professional"><div class="search-empty-icon" aria-hidden="true">⌕</div><strong>No matching opportunity found</strong><p>We could not find a published opportunity for “${escapeHtml(query)}”. Try an organization name, country, scholarship, internship, fellowship, job title or a broader keyword.</p><div class="search-empty-actions"><a href="/scholarships">Browse scholarships</a><a href="/internships">Browse internships</a><a href="/jobs">Browse jobs</a></div></div>`;
  }
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




// Mobile hero category carousel: keeps the hero compact and rotates the four quick links automatically.
document.addEventListener('DOMContentLoaded',()=>{
  const slider=document.querySelector('.hero-panel-grid');
  if(!slider) return;
  const mq=window.matchMedia('(max-width: 760px)');
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  let timer=null, paused=false, index=0;

  const dotsWrap=document.createElement('div');
  dotsWrap.className='hero-slider-dots';
  const cards=[...slider.children];
  cards.forEach((_,i)=>{
    const b=document.createElement('button');
    b.type='button';
    b.className='hero-slider-dot'+(i===0?' active':'');
    b.setAttribute('aria-label',`Show opportunity category ${i+1}`);
    b.addEventListener('click',()=>go(i,true));
    dotsWrap.appendChild(b);
  });
  slider.insertAdjacentElement('afterend',dotsWrap);
  const dots=[...dotsWrap.children];

  function updateDots(){ dots.forEach((d,i)=>d.classList.toggle('active',i===index)); }
  function go(i,user=false){
    if(!mq.matches || !cards.length) return;
    index=(i+cards.length)%cards.length;
    slider.scrollTo({left:cards[index].offsetLeft-slider.offsetLeft,behavior:user||!reduced.matches?'smooth':'auto'});
    updateDots();
  }
  function nearestIndex(){
    if(!cards.length) return 0;
    let best=0,dist=Infinity;
    cards.forEach((c,i)=>{const d=Math.abs(c.offsetLeft-slider.offsetLeft-slider.scrollLeft);if(d<dist){dist=d;best=i;}});
    return best;
  }
  function start(){
    stop();
    dotsWrap.hidden=!mq.matches;
    if(!mq.matches || reduced.matches) return;
    timer=setInterval(()=>{if(!paused)go(index+1);},3000);
  }
  function stop(){if(timer){clearInterval(timer);timer=null;}}
  let raf=0;
  slider.addEventListener('scroll',()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{index=nearestIndex();updateDots();});},{passive:true});
  slider.addEventListener('pointerdown',()=>paused=true);
  slider.addEventListener('pointerup',()=>{setTimeout(()=>paused=false,1200);});
  slider.addEventListener('touchstart',()=>paused=true,{passive:true});
  slider.addEventListener('touchend',()=>{setTimeout(()=>paused=false,1200);},{passive:true});
  if(mq.addEventListener)mq.addEventListener('change',start);else mq.addListener(start);
  start();
});

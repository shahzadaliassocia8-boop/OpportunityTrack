(() => {
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const escapeHtml=(s='')=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));

  // Navigation
  const menuBtn=$('[data-menu]'), nav=$('[data-nav]');
  if(menuBtn&&nav){menuBtn.addEventListener('click',()=>{const open=nav.classList.toggle('open');menuBtn.setAttribute('aria-expanded',String(open));});}

  // Floating Admin Panel button on public pages.
  if(!document.body.classList.contains('admin-page') && !location.pathname.includes('admin')){
    const a=document.createElement('a');a.className='admin-float';a.href='/admin-login.html';a.textContent='Admin Panel';a.setAttribute('aria-label','Open OpportunityTrack Admin Panel');document.body.appendChild(a);
  }

  // Gentle reveal animation.
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window){
    const els=$$('.card,.article,.side-card,.opportunity-card');els.forEach(el=>el.classList.add('reveal-ready'));
    const io=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('reveal-in');io.unobserve(e.target);}}),{threshold:.08});els.forEach(el=>io.observe(el));
  }

  // Public opportunity feeds
  async function loadFeed(section){
    const category=section.dataset.opportunityFeed||'', featured=section.dataset.featured==='1', limit=Number(section.dataset.limit||12);
    const target=$('[data-opportunity-cards]',section), status=$('[data-feed-status]',section), search=$('[data-feed-search]',section), country=$('[data-feed-country]',section);
    if(!target)return;
    let items=[];
    try{
      const params=new URLSearchParams(); if(category)params.set('category',category); if(featured)params.set('featured','1'); params.set('limit',String(Math.max(limit,50)));
      const r=await fetch('/api/opportunities?'+params.toString()); const d=await r.json(); if(!r.ok)throw new Error(d.error||'Could not load opportunities'); items=d.items||[];
      if(country){[...new Set(items.map(x=>x.country).filter(Boolean))].sort().forEach(c=>{const o=document.createElement('option');o.value=c;o.textContent=c;country.appendChild(o);});}
      render();
    }catch(e){status.textContent='Live opportunity updates are not available until the Admin database is connected.';status.className='feed-status error';target.innerHTML='';}
    function render(){const q=(search?.value||'').trim().toLowerCase(), c=country?.value||'';const visible=items.filter(i=>(!q||`${i.title} ${i.organization||''} ${i.country||''} ${i.short_description||''} ${i.tags||''}`.toLowerCase().includes(q))&&(!c||i.country===c)).slice(0,limit);if(!visible.length){target.innerHTML='';status.textContent=items.length?'No opportunities match these filters.':'No published opportunities have been added here yet.';status.className='feed-status';status.hidden=false;return;}status.hidden=true;target.innerHTML=visible.map(cardHtml).join('');}
    search?.addEventListener('input',render);country?.addEventListener('change',render);
  }
  function cardHtml(i){
    const meta=[i.country,i.organization].filter(Boolean).slice(0,2);const deadline=i.deadline?`Deadline: ${escapeHtml(i.deadline)}`:'Check official deadline';
    return `<article class="opportunity-card"><div class="opportunity-meta"><span class="meta-pill">${escapeHtml(i.category)}</span>${i.featured?'<span class="meta-pill featured">Featured</span>':''}</div><h3><a href="/opportunities/${encodeURIComponent(i.slug)}">${escapeHtml(i.title)}</a></h3><p>${escapeHtml(i.short_description||'')}</p><div class="opportunity-meta">${meta.map(x=>`<span class="meta-pill">${escapeHtml(x)}</span>`).join('')}</div><div class="card-footer"><span>${deadline}</span><a class="read-link" href="/opportunities/${encodeURIComponent(i.slug)}">View details →</a></div></article>`;
  }
  $$('[data-opportunity-feed]').forEach(loadFeed);

  // Search overlay + public opportunities
  const overlay=$('[data-search-overlay]'), openSearch=$$('[data-open-search]'), closeSearch=$('[data-close-search]'), searchInput=$('[data-search-input]'), results=$('[data-search-results]');
  let baseIndex=window.OPPORTUNITYTRACK_SEARCH||[], liveIndex=[];
  fetch('/api/opportunities?limit=100').then(r=>r.ok?r.json():null).then(d=>{if(d?.items)liveIndex=d.items.map(i=>({title:i.title,desc:i.short_description,url:`/opportunities/${encodeURIComponent(i.slug)}`,keywords:`${i.category} ${i.organization||''} ${i.country||''} ${i.tags||''}`}));}).catch(()=>{});
  function renderSearch(q=''){if(!results)return;const query=q.trim().toLowerCase();const index=[...liveIndex,...baseIndex];const items=!query?index.slice(0,10):index.filter(item=>(`${item.title} ${item.desc} ${item.keywords||''}`).toLowerCase().includes(query)).slice(0,24);results.innerHTML=items.length?items.map(item=>`<a class="search-result" href="${item.url}"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.desc)}</span></a>`).join(''):'<div class="empty-message">No matching result found. Try a broader search term.</div>';}
  function showSearch(){if(!overlay)return;overlay.classList.add('open');overlay.setAttribute('aria-hidden','false');renderSearch('');setTimeout(()=>searchInput?.focus(),50);} function hideSearch(){if(!overlay)return;overlay.classList.remove('open');overlay.setAttribute('aria-hidden','true');}
  openSearch.forEach(b=>b.addEventListener('click',showSearch));closeSearch?.addEventListener('click',hideSearch);overlay?.addEventListener('click',e=>{if(e.target===overlay)hideSearch();});searchInput?.addEventListener('input',e=>renderSearch(e.target.value));document.addEventListener('keydown',e=>{if(e.key==='Escape')hideSearch();if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();showSearch();}});

  // Lightweight source-monitor heartbeat. It only starts a due background check; it never publishes external content.
  // sessionStorage avoids repeating the request on every page during the same visit.
  try{
    if(!sessionStorage.getItem('ot_source_heartbeat')){
      sessionStorage.setItem('ot_source_heartbeat','1');
      setTimeout(()=>fetch('/api/automation/heartbeat',{method:'POST',keepalive:true}).catch(()=>{}),1800);
    }
  }catch{}

  // Contact form: intentionally opens the visitor's email app; no message database is required.
  const form=$('[data-contact-form]');
  if(form){form.addEventListener('submit',e=>{e.preventDefault();const fd=new FormData(form),name=String(fd.get('name')||'').trim(),email=String(fd.get('email')||'').trim(),topic=String(fd.get('topic')||'General enquiry'),message=String(fd.get('message')||'').trim(),status=$('[data-form-status]');if(!name||!email||!message){if(status)status.textContent='Please complete your name, email and message.';return;}const subject=encodeURIComponent(`OpportunityTrack: ${topic}`),body=encodeURIComponent(`Name: ${name}\nEmail: ${email}\nTopic: ${topic}\n\n${message}`);location.href=`mailto:amazaikhan7@gmail.com?subject=${subject}&body=${body}`;if(status)status.textContent='Your email application should open. If it does not, email amazaikhan7@gmail.com directly.';});}
})();

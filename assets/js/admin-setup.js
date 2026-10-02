(() => {
  const form=document.querySelector('[data-setup-form]'),msg=document.querySelector('[data-message]');
  const show=(t,ok=false)=>{msg.textContent=t;msg.className='message show '+(ok?'ok':'err');};
  (async()=>{try{const r=await fetch('/api/auth/setup-status'),d=await r.json();if(r.ok&&!d.needsSetup)location.replace('admin-login.html');else if(!r.ok)show(d.error||'Database is not configured.');}catch{show('Admin service is not configured.');}})();
  form?.addEventListener('submit',async e=>{
    e.preventDefault();
    show('Creating Super Admin…',true);
    try{
      const fd=new FormData(form);const body=Object.fromEntries(fd.entries());
      const r=await fetch('/api/auth/setup',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
      const ct=r.headers.get('content-type')||'';
      const d=ct.includes('application/json')?await r.json():{};
      if(!r.ok){show(d.error||`Setup failed (HTTP ${r.status}).`);return;}
      show('Super Admin created. Opening dashboard…',true);
      setTimeout(()=>location.replace('admin.html'),500);
    }catch(err){
      show('Setup request failed. Please try again after deployment finishes.');
    }
  });
})();

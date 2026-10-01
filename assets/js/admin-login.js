(() => {
  let mode='admin';
  const form=document.querySelector('[data-login-form]');
  const msg=document.querySelector('[data-message]');
  const title=document.querySelector('[data-login-title]');
  const sub=document.querySelector('[data-login-sub]');
  const toggle=document.querySelector('[data-mode-toggle]');
  const recovery=document.querySelector('[data-recovery-link]');
  function show(text,ok=false){msg.textContent=text;msg.className='message show '+(ok?'ok':'err');}
  async function api(url,opts={}){const r=await fetch(url,{...opts,headers:{'content-type':'application/json',...(opts.headers||{})}});let d={};try{d=await r.json();}catch{}return {r,d};}
  (async()=>{
    try{
      const s=await fetch('/api/auth/setup-status').then(r=>r.json());
      if(s.needsSetup){location.replace('admin-setup.html');return;}
      const me=await fetch('/api/auth/me'); if(me.ok){location.replace('admin.html');}
    }catch{show('Admin service is not configured yet. Complete the Cloudflare D1 setup first.');}
  })();
  toggle?.addEventListener('click',()=>{mode=mode==='admin'?'super_admin':'admin';const superMode=mode==='super_admin';title.textContent=superMode?'Super Admin Login':'Admin Login';sub.textContent=superMode?'Sign in with the main Super Admin account.':'Sign in with your Admin username and password.';toggle.textContent=superMode?'Back to Admin Login':'Super Admin Login';recovery.hidden=!superMode;document.querySelector('#username').focus();});
  form?.addEventListener('submit',async e=>{e.preventDefault();msg.className='message';const fd=new FormData(form);const body={username:fd.get('username'),password:fd.get('password'),mode};const {r,d}=await api('/api/auth/login',{method:'POST',body:JSON.stringify(body)});if(!r.ok){show(d.error||'Login failed.');return;}location.replace('admin.html');});
})();

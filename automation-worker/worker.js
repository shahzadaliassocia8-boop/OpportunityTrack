export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/health') return Response.json({ok:true,site:env.SITE_URL||null});
    if (url.pathname === '/run' && request.method === 'POST') return run(env);
    return new Response('OpportunityTrack source-check scheduler', {status:200});
  },
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(run(env));
  }
};

async function run(env){
  const site=String(env.SITE_URL||'').replace(/\/$/,'');
  if(!/^https:\/\//i.test(site)) return Response.json({ok:false,error:'Set SITE_URL to your live OpportunityTrack https:// domain.'},{status:500});
  const r=await fetch(site+'/api/automation/heartbeat',{method:'POST',headers:{'user-agent':'OpportunityTrack-Cron/1.0'}});
  const text=await r.text();
  return new Response(text,{status:r.status,headers:{'content-type':r.headers.get('content-type')||'application/json'}});
}

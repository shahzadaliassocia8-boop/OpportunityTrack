const PHOTO_POOLS={
  Scholarship:['scholarship-1.jpg','scholarship-2.jpg','scholarship-3.jpg','scholarship-4.jpg','scholarship-5.jpg','scholarship-6.jpg'],
  Admission:['admission-1.jpg','admission-2.jpg','scholarship-1.jpg'],
  Internship:['internship-1.jpg','internship-2.jpg','job-1.jpg'],
  Fellowship:['fellowship-1.jpg','fellowship-2.jpg','scholarship-4.jpg'],
  Job:['job-1.jpg','job-2.jpg','internship-2.jpg'],
  Scheme:['scheme-1.jpg','scholarship-2.jpg','scholarship-5.jpg'],
  Update:['update-1.jpg','scholarship-1.jpg','scholarship-3.jpg']
};
function hash(s=''){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
export async function onRequestGet(context){
  const slug=String(context.params.slug||'');
  let category='Update';
  if(context.env.DB){
    try{const o=await context.env.DB.prepare('SELECT category FROM opportunities WHERE slug=? LIMIT 1').bind(slug).first();if(o?.category)category=o.category;}catch{}
  }
  const pool=PHOTO_POOLS[category]||PHOTO_POOLS.Update;
  const file=pool[hash(slug||category)%pool.length];
  const url=new URL(`/assets/img/photos/${file}`,context.request.url);
  return Response.redirect(url.toString(),302);
}

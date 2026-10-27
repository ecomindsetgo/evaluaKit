import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const URL=Deno.env.get('SUPABASE_URL')!, SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND=Deno.env.get('RESEND_API_KEY')||'', FROM=Deno.env.get('RESEND_FROM')||'';
const admin=createClient(URL,SERVICE,{auth:{autoRefreshToken:false,persistSession:false}});
const cors={'Access-Control-Allow-Origin':Deno.env.get('APP_ORIGIN')||'https://example.invalid','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
const response=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
const fail=(message:string,status=400)=>response({error:message},status);
const limits:Record<string,[number,number]>={caars:[66,3],hamilton:[14,4],'cet-de':[63,4]};
async function sha256(input:string){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(input));return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('')}
function validToken(t:unknown){return typeof t==='string'&&/^[a-f0-9]{64}$/.test(t)}
async function owner(req:Request){const bearer=req.headers.get('authorization')||'';if(!bearer.startsWith('Bearer '))return null;const token=bearer.slice(7);const {data,error}=await admin.auth.getUser(token);return error?null:data.user}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{headers:cors});
 if(req.method!=='POST')return fail('Método no permitido',405);
 // Avoid parsing unbounded public requests using the service-role runtime.
 const declaredLength=Number(req.headers.get('content-length')||0);
 if(declaredLength>32768)return fail('Solicitud demasiado grande',413);
 try{
  const raw=await req.text();
  if(new TextEncoder().encode(raw).length>32768)return fail('Solicitud demasiado grande',413);
  let input:Record<string,any>;
  try{input=JSON.parse(raw)}catch{return fail('JSON inválido',400)}
  if(!input||typeof input!=='object'||Array.isArray(input))return fail('Solicitud inválida',400);
  const action=input.action;
  if(action==='create_link'){
   const user=await owner(req);if(!user)return fail('Sesión no autorizada',401);
   if(!limits[input.test_id])return fail('Evaluación no disponible');
   // 32 cryptographically random bytes, never stored in plaintext.
   const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
   const {error}=await admin.rpc('ek_reserve_credit',{p_owner:user.id,p_test:input.test_id,p_hash:await sha256(token)});
   if(error)return fail(error.message.includes('Sin aplicaciones')?error.message:'No se pudo reservar la aplicación: '+error.message,409);return response({token});
  }
  if(action==='wallet'){
   const user=await owner(req);if(!user)return fail('Sesión no autorizada',401);
   // Al consultar saldo, liberar reservas vencidas (también conviene pg_cron).
   const {error:releaseError}=await admin.rpc('ek_release_expired_credits');if(releaseError)console.error('release',releaseError);
   const {error:expireError}=await admin.rpc('ek_expire_credits',{p_owner:user.id});if(expireError)console.error('expire',expireError);
   const {data,error}=await admin.from('ek_wallets').select('available,reserved').eq('owner_id',user.id).maybeSingle();if(error)throw error;
   if(!data)return fail('Tu cuenta aún no tiene un paquete de aplicaciones asignado. Solicita la activación al administrador.',409);
   return response({available:data.available,reserved:data.reserved});
  }
  if(action==='cancel_link'){
   const user=await owner(req);if(!user)return fail('Sesión no autorizada',401);
   if(!validToken(input.token))return fail('Enlace inválido');
   const hash=await sha256(input.token);
   const {data:link}=await admin.from('ek_links').select('owner_id').eq('token_hash',hash).maybeSingle();
   if(!link||link.owner_id!==user.id)return fail('Enlace no encontrado',404);
   const {data,error}=await admin.rpc('ek_release_credit',{p_hash:hash});if(error)throw error;
   return response({released:data});
  }
  if(action==='get_link'){
   if(!validToken(input.token))return fail('Enlace inválido');
   const {data,error}=await admin.from('ek_links').select('test_id,owner_id,expires_at,consumed_at,credit_state').eq('token_hash',await sha256(input.token)).maybeSingle();
   if(error)throw error;
   if(!data||data.credit_state!=='reserved'||data.consumed_at||new Date(data.expires_at).getTime()<Date.now())return fail('El enlace expiró o ya fue utilizado',410);
   const {data:profile}=await admin.from('ek_profiles').select('accent').eq('id',data.owner_id).maybeSingle();
   return response({test_id:data.test_id,accent:profile?.accent||'#287b70'});
  }
  if(action==='submit'){
   if(!validToken(input.token))return fail('Enlace inválido');
   const p=input.patient||{},name=String(p.name||'').trim(),age=p.age,sex=p.sex,date=p.date;
   if(name.length<3||name.length>160||!Number.isInteger(age)||age<1||age>120||!['Femenino','Masculino','Otro / Prefiero no indicar'].includes(sex)||typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)return fail('Datos del paciente inválidos');
   // Read test type before consuming token; validate all answers server-side.
   const hash=await sha256(input.token);const {data:link}=await admin.from('ek_links').select('test_id').eq('token_hash',hash).maybeSingle();
   if(!link||!limits[link.test_id])return fail('Enlace inválido',410);
   const [count,max]=limits[link.test_id];const answers=input.answers;
   if(!Array.isArray(answers)||answers.length!==count||!answers.every((n:unknown)=>Number.isInteger(n)&&(n as number)>=0&&(n as number)<=max))return fail('Respuestas incompletas o inválidas');
   // Una única transacción inserta el resultado, consume el enlace y confirma el crédito.
   const total=answers.reduce((a:number,b:number)=>a+b,0);
   const {data:submissionId,error:submitError}=await admin.rpc('ek_submit_credit',{p_hash:hash,p_name:name,p_age:age,p_sex:sex,p_date:date,p_answers:answers,p_total:total,p_max:count*max});
   if(submitError){console.error('submit credit failed',submitError);return fail('No se pudo guardar la evaluación. El enlace puede haber expirado o sido utilizado.',409)}
   const {data:usedLink}=await admin.from('ek_links').select('owner_id').eq('token_hash',hash).single();
   const ownerId=usedLink?.owner_id;
   // Notification contains NO patient identity, test type or clinical responses.
   const {data:u}=ownerId?await admin.auth.admin.getUserById(ownerId):{data:{user:null}};
   if(RESEND&&FROM&&u.user?.email){try{const mail=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+RESEND,'Content-Type':'application/json'},body:JSON.stringify({from:FROM,to:[u.user.email],subject:'EvaluaKit: nueva evaluación recibida',text:'Se ha recibido una evaluación. Ingresa a tu panel profesional para revisar las respuestas y el preinforme.'})});if(!mail.ok)console.error('Resend failed',mail.status,await mail.text())}catch(e){console.error('Resend network',e)}}
   return response({ok:true});
  }
  return fail('Acción no reconocida',404);
 }catch(e){console.error(e);return fail('Error interno. Revisa los registros del servidor.',500)}
});

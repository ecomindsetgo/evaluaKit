const cfg=window.EK_BACKEND;
if(!cfg||!cfg.url.startsWith('https://')||cfg.anonKey.includes('PON_AQUI')){
  document.body.innerHTML='<main style="max-width:680px;margin:80px auto;font-family:sans-serif"><h1>Configuración pendiente</h1><p>Completa backend-config.js con URL y clave pública de Supabase, ejecuta la migración SQL y despliega la función. Lee INSTALACION.md.</p></main>';throw Error('Backend no configurado');
}
const sb=window.supabase.createClient(cfg.url,cfg.anonKey,{auth:{persistSession:true,autoRefreshToken:true}});
async function session(){
  // Supabase persists auth in localStorage; navigation between pages must not sign out.
  const {data:{session:active},error:sessionError}=await sb.auth.getSession();
  if(sessionError)throw sessionError;
  if(!active){
    const returnTo=encodeURIComponent(location.pathname.split('/').pop()+location.search);
    location.replace('index.html?returnTo='+returnTo);
    throw Error('Tu sesión no está activa. Ingresa nuevamente para consultar el informe.');
  }
  const {data:{user},error}=await sb.auth.getUser();
  if(error||!user)throw Error('No fue posible validar la sesión. Actualiza la página o vuelve a ingresar.');
  return user;
}
async function api(action,payload={},authenticated=false){const headers={'Content-Type':'application/json','apikey':cfg.anonKey};if(authenticated){const {data}=await sb.auth.getSession();if(!data.session)throw Error('Sesión expirada');headers.Authorization='Bearer '+data.session.access_token}else headers.Authorization='Bearer '+cfg.anonKey;
 const r=await fetch(cfg.url+'/functions/v1/'+cfg.functionName,{method:'POST',headers,body:JSON.stringify({action,...payload})});let data;try{data=await r.json()}catch{throw Error('Respuesta inesperada del servidor')};if(!r.ok)throw Error(data.error||'Error de servidor');return data}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
// Mensajes accesibles y visibles sin desplazarse hasta el final de la página.
// type: success | info | warning | error | loading. Sin tipo, se considera error.
let ekToastTimer;
function msg(message,type='error'){
  const legacy=document.getElementById('msg');
  if(legacy){legacy.textContent='';legacy.hidden=true;}
  let region=document.getElementById('ek-toast-region');
  if(!region){region=document.createElement('div');region.id='ek-toast-region';region.className='ek-toast-region';region.setAttribute('aria-label','Notificaciones');document.body.append(region)}
  region.replaceChildren();clearTimeout(ekToastTimer);
  if(!message)return;
  const kind=['success','info','warning','error','loading'].includes(type)?type:'error';
  const toast=document.createElement('div');toast.className='ek-toast ek-toast--'+kind;
  toast.setAttribute('role',kind==='error'||kind==='warning'?'alert':'status');
  toast.setAttribute('aria-live',kind==='error'||kind==='warning'?'assertive':'polite');
  const icon=document.createElement('span');icon.className='ek-toast-icon';icon.setAttribute('aria-hidden','true');icon.textContent=({success:'✓',info:'i',warning:'!',error:'!',loading:'…'})[kind];
  const body=document.createElement('div');body.className='ek-toast-body';
  const title=document.createElement('strong');title.textContent=({success:'Operación realizada',info:'Información',warning:'Atención',error:'No se pudo completar',loading:'Procesando'})[kind];
  const detail=document.createElement('span');detail.textContent=String(message);body.append(title,detail);
  const close=document.createElement('button');close.type='button';close.className='ek-toast-close';close.setAttribute('aria-label','Cerrar notificación');close.textContent='×';close.onclick=()=>{clearTimeout(ekToastTimer);toast.remove()};
  toast.append(icon,body,close);region.append(toast);
  if(kind!=='error'&&kind!=='loading')ekToastTimer=setTimeout(()=>toast.remove(),kind==='success'?4500:kind==='info'?5500:6500);
}

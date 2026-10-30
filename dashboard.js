const $=id=>document.getElementById(id);let me;
async function init(){if(window.ekRecovering)return;$('adminLink').classList.add('hide');const {data:{session:active}}=await sb.auth.getSession();const {data,error}=active?await sb.auth.getUser():{data:{user:null},error:null};if(error)throw error;me=data.user;if(!me){$('loadingSession').classList.add('hide');$('auth').classList.remove('hide');$('workspace').classList.add('hide');$('logout').classList.add('hide');return} $('loadingSession').classList.add('hide');$('auth').classList.add('hide');$('workspace').classList.remove('hide');$('logout').classList.remove('hide');await checkAdminAccess();await Promise.allSettled([loadInbox(),loadBrand(),loadWallet()]).then(results=>{for(const r of results)if(r.status==='rejected')msg('No se pudieron cargar todos los datos: '+r.reason.message)});const redirect=new URLSearchParams(location.search).get('returnTo');if(redirect&&/^(informe\.html\?id=[0-9a-f-]+)$/i.test(redirect)){location.replace(redirect)}}
$('login').onclick=async()=>{try{const {error}=await sb.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});if(error)throw error;await init()}catch(e){$('authmsg').textContent=e.message}};
$('logout').onclick=async()=>{$('adminLink').classList.add('hide');await sb.auth.signOut();location.reload()};
async function checkAdminAccess(){
 $('adminLink').classList.add('hide');
 if(!me)return;
 try{
  const {data,error}=await sb.rpc('ek_is_admin');
  if(error){console.warn('No se pudo comprobar rol administrativo:',error.message);return}
  if(data===true)$('adminLink').classList.remove('hide');
 }catch(e){console.warn('Comprobación administrativa no disponible:',e.message)}
}

Object.entries(TESTS).forEach(([id,t])=>{const c=document.createElement('article');c.className='testcard';c.innerHTML='<span class="eyebrow">DEMOSTRACIÓN · NO CLÍNICA</span><h3>'+esc(t.name)+'</h3><p class="muted">'+esc(t.subtitle)+'</p><div class="actions"><button>Crear enlace</button></div><div class="small muted linkout"></div>';c.querySelector('button').dataset.createLink='yes';c.querySelector('button').onclick=async()=>{try{msg('Estamos preparando el enlace para tu paciente.','loading');const r=await api('create_link',{test_id:id},true);const url=new URL('evaluacion.html?token='+encodeURIComponent(r.token),location.href).href;const box=c.querySelector('.linkout');box.textContent='';const inp=document.createElement('input');inp.value=url;inp.readOnly=true;box.append(inp);const b=document.createElement('button');b.textContent='Copiar enlace';b.className='secondary';b.onclick=async()=>{await navigator.clipboard.writeText(url);msg('Enlace copiado. Compártelo solo con una persona ficticia para pruebas.','success')};box.append(b);const cancel=document.createElement('button');cancel.textContent='Cancelar enlace y liberar aplicación';cancel.className='secondary';cancel.onclick=async()=>{try{await api('cancel_link',{token:r.token},true);box.replaceChildren();await loadWallet();msg('Enlace cancelado. Comprueba el saldo actualizado.','success')}catch(e){msg(e.message)}};box.append(cancel);await loadWallet();msg('Enlace de demostración creado. Usa solo datos ficticios; caduca en 7 días.','success')}catch(e){msg(e.message)}};$('catalog').append(c)});
async function loadWallet(){const r=await api('wallet',{},true);$('creditAvailable').textContent=r.available;$('creditReserved').textContent=r.reserved;renderWalletVisual(r);document.querySelectorAll('#catalog button').forEach(b=>{if(b.dataset.createLink==='yes')b.disabled=r.available<=0});}
function renderWalletVisual(r){const available=Math.max(0,Number(r.available)||0),reserved=Math.max(0,Number(r.reserved)||0);const spent=Math.max(0,Number(r.consumed??r.used??0)||0);const knownTotal=Number(r.total??r.purchased??r.credited);const total=Number.isFinite(knownTotal)&&knownTotal>0?Math.max(knownTotal,available+reserved+spent):available+reserved+spent;const used=Math.max(spent,total-available-reserved);$('creditUsed').textContent=allSubmissions.length;$('creditProgressText').textContent=total>0?`${available+reserved} aplicaciones sin consumir`:'Sin aplicaciones';$('creditBarAvailable').style.width=(total?available/total*100:0)+'%';$('creditBarReserved').style.width=(total?reserved/total*100:0)+'%';$('creditProgress').setAttribute('aria-valuenow',String(total?(available+reserved)/total*100:0));}
$('creditRefresh').onclick=()=>loadWallet().then(()=>msg('Saldo actualizado correctamente.','success')).catch(e=>msg(e.message));
let allSubmissions=[],currentPage=0;const PAGE_SIZE=8;
function renderInbox(){const term=($('searchInbox')?.value||'').trim().toLocaleLowerCase('es');const status=$('filterStatus')?.value||'all';const rows=allSubmissions.filter(r=>(status==='all'||r.status===status)&&String(r.patient_name).toLocaleLowerCase('es').includes(term));const totalPages=Math.max(1,Math.ceil(rows.length/PAGE_SIZE));currentPage=Math.min(currentPage,totalPages-1);const box=$('inbox');box.replaceChildren();if(!rows.length){const empty=document.createElement('div');empty.className='empty-state';empty.textContent='No se encontraron evaluaciones con estos filtros.';box.append(empty)}for(const r of rows.slice(currentPage*PAGE_SIZE,(currentPage+1)*PAGE_SIZE)){const c=document.createElement('article');c.className='inboxitem';const badge=r.status==='final'?'<span class="status-pill done">Finalizado</span>':'<span class="status-pill pending">Por revisar</span>';c.innerHTML='<div class="inbox-heading"><strong>'+esc(r.patient_name)+'</strong>'+badge+'</div><p class="muted small">'+esc(TESTS[r.test_id]?.name||r.test_id)+' · '+esc(r.evaluation_date)+'</p><a class="btn secondary" href="informe.html?id='+encodeURIComponent(r.id)+'">'+(r.status==='final'?'Consultar informe':'Revisar preinforme')+'</a>';box.append(c)}$('pageInfo').textContent=rows.length?'Página '+(currentPage+1)+' de '+totalPages+' · '+rows.length+' resultados':'Sin resultados';$('prevPage').disabled=currentPage===0;$('nextPage').disabled=currentPage>=totalPages-1;$('metricTotal').textContent=allSubmissions.length;if($('creditUsed'))$('creditUsed').textContent=allSubmissions.length;$('metricDraft').textContent=allSubmissions.filter(x=>x.status!=='final').length;$('metricFinal').textContent=allSubmissions.filter(x=>x.status==='final').length;}
async function loadInbox(){const {data,error}=await sb.from('ek_submissions').select('id,test_id,patient_name,patient_age,patient_sex,evaluation_date,created_at,status').order('created_at',{ascending:false}).limit(500);if(error)throw error;allSubmissions=data||[];renderInbox()}
$('searchInbox').addEventListener('input',()=>{currentPage=0;renderInbox()});$('filterStatus').addEventListener('change',()=>{currentPage=0;renderInbox()});$('prevPage').onclick=()=>{currentPage--;renderInbox()};$('nextPage').onclick=()=>{currentPage++;renderInbox()};
$('refresh').onclick=()=>loadInbox().then(()=>msg('Bandeja actualizada.','success')).catch(e=>msg(e.message));
async function loadBrand(){const {data,error}=await sb.from('ek_profiles').select('*').eq('id',me.id).maybeSingle();if(error)throw Error('No se pudo cargar la identidad: '+error.message);if(data){$('clinic').value=data.clinic||'';$('professional').value=data.professional||'';$('accent').value=data.accent||'#287b70';window.EK_THEME?.apply(data.accent);if(data.logo)showLogoPreview(data.logo,'Logotipo actual')}else{window.EK_THEME?.apply('#287b70')}updateBrandPreview()}
$('saveBrand').onclick=async()=>{try{if(!me)throw Error('Sesión no disponible. Ingresa nuevamente.');$('saveBrand').disabled=true;msg('Guardando la identidad de tu consultorio…','loading');let logo;const f=$('logo').files[0];if(f){if(f.size>150000||!['image/png','image/jpeg'].includes(f.type))throw Error('Logo JPG o PNG, máximo 150 KB');logo=await new Promise((res,rej)=>{const reader=new FileReader();reader.onload=()=>res(reader.result);reader.onerror=rej;reader.readAsDataURL(f)})}const values={id:me.id,clinic:$('clinic').value.trim(),professional:$('professional').value.trim(),accent:$('accent').value};if(logo)values.logo=logo;const {error}=await sb.from('ek_profiles').upsert(values);if(error)throw Error('No se pudo guardar la identidad: '+error.message);await loadBrand();msg('Identidad guardada. El nuevo color se aplicará al panel y a tus informes.','success')}catch(e){msg(e.message)}finally{$('saveBrand').disabled=false}};
function showLogoPreview(src,name){const el=$('logoPreview');el.replaceChildren();const img=document.createElement('img');img.src=src;img.alt='Vista previa del logotipo';el.append(img);const pl=$('previewLogo');pl.replaceChildren();const pi=document.createElement('img');pi.src=src;pi.alt='';pl.append(pi);$('logoName').textContent=name||'Logotipo seleccionado';}
function updateBrandPreview(){const c=$('accent').value;$('accentHex').textContent=c.toUpperCase();document.querySelectorAll('.color-swatch').forEach(b=>{const active=b.dataset.color.toLowerCase()===c.toLowerCase();b.classList.toggle('is-selected',active);b.setAttribute('aria-pressed',String(active))});$('previewClinic').textContent=$('clinic').value.trim()||'Tu consultorio';$('previewProfessional').textContent=$('professional').value.trim()||'Profesional responsable';}
$('accent').addEventListener('input',e=>{window.EK_THEME?.apply(e.target.value);updateBrandPreview()});
document.querySelectorAll('.color-swatch').forEach(b=>b.addEventListener('click',()=>{$('accent').value=b.dataset.color;window.EK_THEME?.apply(b.dataset.color);updateBrandPreview()}));
['clinic','professional'].forEach(id=>$(id).addEventListener('input',updateBrandPreview));
$('logo').addEventListener('change',()=>{const f=$('logo').files?.[0];if(!f)return;if(f.size>150000||!['image/png','image/jpeg'].includes(f.type)){$('logoStatus').textContent='';msg('Selecciona un PNG o JPG de máximo 150 KB.','warning');$('logo').value='';return}$('logoStatus').textContent='';msg('Imagen seleccionada. Pulsa Guardar identidad para aplicar el cambio.','info');const reader=new FileReader();reader.onload=()=>showLogoPreview(reader.result,f.name);reader.readAsDataURL(f)});


// El flujo de recuperación se inicia desde el enlace de Supabase.
const recoveryParams = new URLSearchParams(location.hash.slice(1));
const recoveryQuery = new URLSearchParams(location.search);
window.ekInviting = window.EK_AUTH_FLOW_TYPE === 'invite' || recoveryParams.get('type') === 'invite' || recoveryQuery.get('type') === 'invite';
window.ekRecovering = window.ekInviting || window.EK_AUTH_FLOW_TYPE === 'recovery' || recoveryParams.get('type') === 'recovery' || recoveryQuery.get('type') === 'recovery';
function showReset(){window.ekRecovering=true;$('loadingSession').classList.add('hide');$('workspace').classList.add('hide');$('auth').classList.remove('hide');$('newPasswordForm').classList.remove('hide');$('recoveryForm').classList.add('hide');$('forgotPassword').classList.add('hide');$('login').disabled=true;if(window.ekInviting){const h=$('newPasswordForm').querySelector('h3');if(h)h.textContent='Establecer contraseña y activar acceso';}}
async function startAuthFlow(){
 sb.auth.onAuthStateChange((event)=>{if(event==='PASSWORD_RECOVERY')showReset()});
 if(window.ekRecovering){showReset();if(recoveryQuery.has('token_hash')){const result=await sb.auth.verifyOtp({token_hash:recoveryQuery.get('token_hash'),type:window.ekInviting?'invite':'recovery'});if(result.error){$('newPasswordMsg').textContent='El enlace ha caducado o no es válido: '+result.error.message;return}}const {data,error}=await sb.auth.getSession();if(error||!data.session){$('newPasswordMsg').textContent=window.ekInviting?'La invitación ha caducado o no es válida. Solicita una nueva al administrador.':'El enlace no es válido o ha caducado. Solicita uno nuevo.';if(!window.ekInviting){$('forgotPassword').classList.remove('hide');$('recoveryForm').classList.remove('hide');}}return}
 await init();
}
$('forgotPassword').onclick=()=>{$('recoveryEmail').value=$('email').value.trim();$('recoveryForm').classList.remove('hide');$('recoveryEmail').focus()};
$('cancelRecovery').onclick=()=>{$('recoveryForm').classList.add('hide');$('recoveryMsg').textContent=''};
$('sendRecovery').onclick=async()=>{
 const email=$('recoveryEmail').value.trim();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){$('recoveryMsg').textContent='Introduce un correo válido.';return}
 $('sendRecovery').disabled=true;
 try{
  const redirectTo=new URL('index.html',location.href).href;
  const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo});
  if(error)throw error;
  $('recoveryMsg').textContent='Si existe una cuenta con ese correo, recibirás un enlace para cambiar la contraseña. Revisa también Spam.';
 }catch(e){$('recoveryMsg').textContent='No se pudo enviar el enlace: '+e.message}
 finally{$('sendRecovery').disabled=false}
};
$('saveNewPassword').onclick=async()=>{
 const password=$('newPassword').value,confirm=$('confirmPassword').value;
 if(password.length<8){$('newPasswordMsg').textContent='La contraseña debe tener al menos 8 caracteres.';return}
 if(password!==confirm){$('newPasswordMsg').textContent='Las contraseñas no coinciden.';return}
 $('saveNewPassword').disabled=true;
 try{
  const {error}=await sb.auth.updateUser({password});if(error)throw error;
  $('newPasswordMsg').textContent='Contraseña actualizada. Ya puedes ingresar.';
  history.replaceState(null,'',location.pathname);
  window.ekRecovering=false;
  $('newPasswordForm').classList.add('hide');$('forgotPassword').classList.remove('hide');$('login').disabled=false;window.ekInviting=false;
  await sb.auth.signOut();
  await init();
  msg('Contraseña actualizada. Inicia sesión con tu nueva contraseña.','success');
 }catch(e){$('newPasswordMsg').textContent='No se pudo actualizar: '+e.message}
 finally{$('saveNewPassword').disabled=false}
};

startAuthFlow().catch(e=>{$('loadingSession').classList.add('hide');msg('No se pudo comprobar tu sesión: '+e.message+'. Actualiza para reintentar.');});

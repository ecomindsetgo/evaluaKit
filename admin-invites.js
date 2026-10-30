/* EvaluaKit Studio · Altas administradas por invitación. */
(() => {
 'use strict';
 const $ = id => document.getElementById(id);
 const form = $('inviteForm');
 if (!form || typeof sb === 'undefined' || !window.EK_BACKEND) return;
 const clean = value => String(value || '').trim().replace(/\s+/g, ' ');
 form.addEventListener('submit', async event => {
  event.preventDefault();
  const button = $('inviteSubmit'), status = $('inviteStatus');
  const first_name = clean($('inviteFirst').value), last_name = clean($('inviteLast').value);
  const email = clean($('inviteEmail').value).toLowerCase(), phone = clean($('invitePhone').value);
  const license_number = clean($('inviteLicense').value);
  if(first_name.length<2 || last_name.length<2 || first_name.length>80 || last_name.length>100){status.textContent='Completa correctamente nombres y apellidos.';return;}
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){status.textContent='Indica un correo válido.';return;}
  if(!/^[+\d\s().-]+$/.test(phone)||phone.replace(/\D/g,'').length<7||phone.replace(/\D/g,'').length>15){status.textContent='Indica un celular o teléfono válido.';return;}
  if(!confirm(`¿Enviar invitación de EvaluaKit a ${first_name} ${last_name} (${email})?`))return;
  button.disabled=true;
  status.textContent='Enviando invitación segura…';
  try{
    const {data:{session},error:sessionError}=await sb.auth.getSession();
    if(sessionError||!session)throw Error('Tu sesión venció. Vuelve a ingresar.');
    const result=await fetch(window.EK_BACKEND.url+'/functions/v1/evaluakit-admin',{
      method:'POST',headers:{'Content-Type':'application/json','apikey':window.EK_BACKEND.anonKey,'Authorization':'Bearer '+session.access_token},
      body:JSON.stringify({action:'invite_professional',first_name,last_name,email,phone,license_number})
    });
    let data;
    try{data=await result.json()}catch{throw Error('Respuesta inesperada del servidor. Comprueba el despliegue de evaluakit-admin.');}
    if(!result.ok)throw Error(data.error||'No se pudo enviar la invitación.');
    status.textContent='Invitación enviada a '+email+'. Ahora selecciona al nuevo profesional en «Acreditar aplicaciones» para asignar el paquete inicial.';
    form.reset();
    // El módulo de clientes ya existente actualiza la lista al recargar.
    if(typeof load==='function')await load();
    if(typeof msg==='function')msg('Invitación enviada. Asigna ahora los créditos iniciales.','success');
  }catch(error){status.textContent='No se pudo invitar: '+error.message;}
  finally{button.disabled=false;}
 });
})();

const el=id=>document.getElementById(id);let clients=[];let accountStatuses=new Map();const date=x=>x?new Date(x).toLocaleDateString('es-PE'):'—';
async function load(){el('reload').disabled=true;try{await session();const {data,error}=await sb.rpc('ek_admin_customers');if(error)throw error;clients=data||[];const statusResult=await sb.rpc('ek_admin_account_statuses');if(statusResult.error)throw statusResult.error;accountStatuses=new Map((statusResult.data||[]).map(x=>[x.owner_id,x]));el('denied').classList.add('hide');el('adminArea').classList.remove('hide');el('users').textContent=clients.length;el('active').textContent=clients.filter(c=>Number(c.total_credited)>0).length;el('credits').textContent=clients.reduce((a,c)=>a+Number(c.available||0),0);const old=el('owner').value;const oldAccount=el('accountOwner').value;el('owner').replaceChildren();el('accountOwner').replaceChildren();for(const c of clients){const opt=document.createElement('option');opt.value=c.user_id;opt.textContent=c.email||c.user_id;el('owner').append(opt);const second=opt.cloneNode(true);el('accountOwner').append(second)}if(clients.some(c=>c.user_id===old))el('owner').value=old;if(clients.some(c=>c.user_id===oldAccount))el('accountOwner').value=oldAccount;render();await history();await loadAudit();await loadCommercial()}catch(e){el('adminArea').classList.add('hide');el('denied').classList.remove('hide');el('denied').textContent='Acceso denegado o configuración incompleta: '+e.message+'. Comprueba la migración v12 y tu usuario en ek_admins.'}finally{el('reload').disabled=false}}
function render(){const q=el('filter').value.toLowerCase().trim();el('customers').replaceChildren();const list=clients.filter(c=>(c.email||'').toLowerCase().includes(q));el('empty').textContent=list.length?'':'No se encontraron usuarios.';for(const c of list){const tr=document.createElement('tr');for(const v of [c.email||'Sin correo',date(c.registered_at),c.available,c.reserved,c.consumed]){const td=document.createElement('td');td.textContent=String(v??0);tr.append(td)}const state=document.createElement('td');state.textContent=accountStatuses.get(c.user_id)?.suspended?'Suspendido':'Habilitado';tr.append(state);const td=document.createElement('td'),b=document.createElement('button');b.className='secondary';b.textContent='Gestionar';b.onclick=()=>{el('owner').value=c.user_id;el('accountOwner').value=c.user_id;history();el('creditForm').scrollIntoView({behavior:'smooth',block:'center'})};td.append(b);tr.append(td);el('customers').append(tr)}}
async function history(){const id=el('owner').value,c=clients.find(x=>x.user_id===id);el('selected').textContent=c?.email||'Selecciona un cliente';el('movements').textContent='Cargando…';if(!id){el('movements').textContent='Sin clientes';return}const {data,error}=await sb.rpc('ek_admin_movements',{p_owner:id});if(error){el('movements').textContent=error.message;return}el('movements').replaceChildren();if(!data?.length){el('movements').textContent='Sin movimientos todavía';return}for(const x of data){const item=document.createElement('div');item.className='admin-event';const top=document.createElement('div'),name=document.createElement('strong'),qty=document.createElement('b'),desc=document.createElement('small');name.textContent=({purchase:'Recarga',reserve:'Reserva',consume:'Aplicación completada',release:'Reserva liberada',adjustment:'Ajuste'})[x.event_type]||x.event_type;qty.textContent=(x.delta>0?'+':'')+x.delta;desc.textContent=date(x.created_at)+' · '+x.note;top.append(name,qty);item.append(top,desc);el('movements').append(item)}}
el('reload').onclick=load;el('filter').oninput=render;el('owner').onchange=async()=>{await history();await loadLots()};
el('creditForm').onsubmit=async e=>{
 e.preventDefault();const id=el('owner').value,amount=Number(el('amount').value),note=el('note').value.trim(),reference=el('paymentRef').value.trim(),expiry=el('expiry').value,c=clients.find(x=>x.user_id===id);
 if(!c||note.length<3||reference.length<5||!Number.isInteger(amount)||amount<1||amount>1000){msg('Completa correctamente los datos de la venta.','warning');return}
 let expiresAt=null;
 if(expiry){expiresAt=new Date(expiry+'T23:59:59-05:00').toISOString();if(Date.parse(expiresAt)<=Date.now()){msg('La fecha de vencimiento debe ser futura.','warning');return}}
 if(!confirm('¿Confirmas que recibiste el pago '+reference+' y acreditas '+amount+' aplicaciones a '+c.email+(expiry?' con vencimiento '+expiry:' sin vencimiento')+'?'))return;
 el('credit').disabled=true;
 try{const {error}=await sb.rpc('ek_admin_credit_package',{p_owner:id,p_amount:amount,p_note:note,p_reference:reference,p_expires_at:expiresAt});if(error)throw error;msg('Recarga acreditada. Referencia: '+reference,'success');el('note').value='';el('paymentRef').value='';await load()}
 catch(err){msg('No se pudo acreditar: '+err.message,'error')}
 finally{el('credit').disabled=false}
};
load();
async function changeAccount(suspended){const id=el('accountOwner').value,reason=el('accountReason').value.trim(),c=clients.find(x=>x.user_id===id);if(!c||reason.length<5){msg('Selecciona un comprador e indica un motivo de al menos 5 caracteres.','warning');return}if(!confirm((suspended?'¿Suspender':'¿Reactivar')+' la cuenta '+c.email+'?'))return;el('suspendAccount').disabled=true;el('reactivateAccount').disabled=true;try{const {error}=await sb.rpc('ek_admin_set_account',{p_owner:id,p_suspended:suspended,p_reason:reason});if(error)throw error;msg('Estado del comprador actualizado.','success');el('accountReason').value='';await load()}catch(e){msg('No se pudo actualizar la cuenta: '+e.message,'error')}finally{el('suspendAccount').disabled=false;el('reactivateAccount').disabled=false}}
el('suspendAccount').onclick=()=>changeAccount(true);el('reactivateAccount').onclick=()=>changeAccount(false);

async function loadAudit(){
 const body=el('auditRows');body.replaceChildren();el('auditEmpty').textContent='Consultando movimientos…';
 const {data,error}=await sb.rpc('ek_admin_audit_history',{p_limit:100});
 if(error){el('auditEmpty').textContent='No se pudo consultar el historial: '+error.message;return}
 el('auditEmpty').textContent=data?.length?'Últimas '+data.length+' operaciones registradas.':'No hay suspensiones o reactivaciones registradas.';
 for(const record of data||[]){
  const tr=document.createElement('tr');
  for(const value of [record.created_at?new Date(record.created_at).toLocaleString('es-PE'):'—',record.actor_email||'—',record.customer_email||'—',record.action==='suspend'?'Suspensión':record.action==='reactivate'?'Reactivación':record.action,record.reason||'—']){
   const td=document.createElement('td');td.textContent=value;tr.append(td)
  }
  body.append(tr);
 }
}
el('reloadAudit').onclick=loadAudit;

async function loadLots(){
 const node=el('lotRows'),owner=el('owner').value;node.replaceChildren();if(!owner)return;
 const {data,error}=await sb.rpc('ek_admin_credit_lots',{p_owner:owner});
 if(error){node.textContent=error.message;return}
 if(!data?.length){node.textContent='Sin paquetes registrados.';return}
 for(const x of data){const div=document.createElement('div');div.className='admin-event';
  const heading=document.createElement('strong');heading.textContent=(x.payment_reference||'Saldo anterior')+' · '+x.remaining+' / '+x.initial_amount+' disponibles';
  const sub=document.createElement('small');sub.textContent=x.expires_at?'Vence: '+new Date(x.expires_at).toLocaleString('es-PE'):'Sin vencimiento';div.append(heading,sub);node.append(div)}
}
async function loadCommercial(){
 const body=el('commercialRows');body.replaceChildren();el('commercialEmpty').textContent='Consultando…';
 const {data,error}=await sb.rpc('ek_admin_commercial_history',{p_limit:100});
 if(error){el('commercialEmpty').textContent='No se pudo consultar: '+error.message;return}
 el('commercialEmpty').textContent=data?.length?'Últimas '+data.length+' operaciones.':'Todavía no hay movimientos comerciales.';
 for(const x of data||[]){const tr=document.createElement('tr');for(const v of [x.created_at?new Date(x.created_at).toLocaleString('es-PE'):'—',x.actor_email||'Sistema',x.customer_email||'—',x.action==='credit'?'Recarga':'Vencimiento',x.amount,x.payment_reference||'—',x.expires_at?new Date(x.expires_at).toLocaleDateString('es-PE'):'Sin vencimiento']){const td=document.createElement('td');td.textContent=String(v);tr.append(td)}body.append(tr)}
 await loadLots();
}
el('reloadCommercial').onclick=loadCommercial;

/* EvaluaKit Studio · Registro profesional y saludo personalizado
   Instalar después de dashboard.js. No requiere nuevas tablas SQL. */
(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const auth = byId('auth');
  const registerBtn = byId('register');
  const workspace = byId('workspace');
  const hero = workspace?.querySelector('.hero');
  const authClient = typeof sb !== 'undefined' ? sb : null;
  if (!auth || !registerBtn || !hero || !authClient) return;

  const css = document.createElement('style');
  css.textContent = `
    .ek-user-form { margin-top: 16px; padding: 18px; border: 1px solid var(--border, #d9e4e0); border-radius: 14px; background: var(--surface, rgba(128,128,128,.04)); }
    .ek-user-form h3 { margin: 0 0 6px; }
    .ek-user-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 12px; margin: 14px 0; }
    .ek-user-grid label { display:block; font-size: .9rem; font-weight: 600; margin-bottom: 5px; }
    .ek-user-grid input { width:100%; min-width:0; box-sizing:border-box; }
    .ek-user-actions { display:flex; gap:10px; flex-wrap:wrap; margin-top:14px; }
    .ek-user-note { font-size:.86rem; opacity:.8; margin: 8px 0; }
    .ek-user-status { min-height:1.2em; margin: 10px 0 0; }
    .ek-user-edit { margin-top: 14px; }
    .ek-user-greeting { margin-top: 0; }
    @media (max-width: 560px) { .ek-user-grid { grid-template-columns:1fr; } .ek-user-form { padding:14px; } }
  `;
  document.head.append(css);

  const fields = (prefix) => `
    <div class="ek-user-grid">
      <div><label for="${prefix}First">Nombres *</label><input id="${prefix}First" autocomplete="given-name" maxlength="80" required></div>
      <div><label for="${prefix}Last">Apellidos *</label><input id="${prefix}Last" autocomplete="family-name" maxlength="100" required></div>
      <div><label for="${prefix}Phone">Teléfono o celular *</label><input id="${prefix}Phone" type="tel" autocomplete="tel" inputmode="tel" maxlength="22" placeholder="Ej. +51 999 999 999" required></div>
      <div><label for="${prefix}License">N.º de colegiatura (opcional)</label><input id="${prefix}License" maxlength="40" placeholder="Ej. C.Ps.P. 12345"></div>
    </div>`;
  const registration = document.createElement('form');
  registration.id = 'ekRegistrationForm';
  registration.className = 'ek-user-form hide';
  registration.noValidate = true;
  registration.innerHTML = `
    <h3>Crear cuenta profesional</h3>
    <p class="ek-user-note">Completa tus datos y utiliza el correo y contraseña indicados arriba. Los campos con * son obligatorios.</p>
    ${fields('ekReg')}
    <div class="ek-user-actions"><button id="ekRegSubmit" type="submit">Crear mi cuenta</button><button id="ekRegCancel" type="button" class="secondary">Cancelar</button></div>
    <p class="ek-user-status" id="ekRegStatus" role="status" aria-live="polite"></p>`;
  registerBtn.closest('.actions')?.insertAdjacentElement('afterend', registration);

  const profile = document.createElement('form');
  profile.id = 'ekProfileForm';
  profile.className = 'ek-user-form hide';
  profile.noValidate = true;
  profile.innerHTML = `
    <h3>Mis datos personales</h3>
    <p class="ek-user-note">Puedes actualizar tus datos en cualquier momento. Estos datos no sustituyen la identidad del consultorio que se usa en los informes.</p>
    ${fields('ekEdit')}
    <div class="ek-user-actions"><button type="submit" id="ekEditSubmit">Guardar mis datos</button><button type="button" id="ekEditCancel" class="secondary">Cancelar</button></div>
    <p class="ek-user-status" id="ekEditStatus" role="status" aria-live="polite"></p>`;
  hero.insertAdjacentElement('afterend', profile);
  const heading = hero.querySelector('h2');
  const editBtn = document.createElement('button');
  editBtn.id = 'ekOpenProfile';
  editBtn.type = 'button';
  editBtn.className = 'secondary ek-user-edit';
  editBtn.textContent = 'Mi perfil';
  (heading?.parentElement || hero).appendChild(editBtn);

  const clean = s => String(s || '').trim().replace(/\s+/g, ' ');
  function readFields(prefix) {
    const first_name = clean(byId(prefix + 'First').value);
    const last_name = clean(byId(prefix + 'Last').value);
    const phone = clean(byId(prefix + 'Phone').value);
    const license_number = clean(byId(prefix + 'License').value);
    if (first_name.length < 2 || first_name.length > 80) throw Error('Escribe tus nombres (entre 2 y 80 caracteres).');
    if (last_name.length < 2 || last_name.length > 100) throw Error('Escribe tus apellidos (entre 2 y 100 caracteres).');
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15 || !/^[+\d\s().-]+$/.test(phone)) throw Error('Ingresa un teléfono válido, con 7 a 15 dígitos.');
    if (license_number.length > 40) throw Error('El número de colegiatura es demasiado largo.');
    return { first_name, last_name, phone, license_number };
  }
  function fillFields(prefix, m) {
    byId(prefix + 'First').value = m.first_name || '';
    byId(prefix + 'Last').value = m.last_name || '';
    byId(prefix + 'Phone').value = m.phone || '';
    byId(prefix + 'License').value = m.license_number || '';
  }
  function closeRegister() {
    registration.classList.add('hide');
    byId('ekRegStatus').textContent = '';
  }
  registerBtn.onclick = () => {
    const showing = registration.classList.contains('hide');
    registration.classList.toggle('hide', !showing);
    byId('ekRegStatus').textContent = '';
    if (showing) byId('ekRegFirst').focus();
  };
  byId('ekRegCancel').onclick = closeRegister;

  registration.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const status = byId('ekRegStatus');
    const submit = byId('ekRegSubmit');
    try {
      const metadata = readFields('ekReg');
      const email = clean(byId('email').value);
      const password = byId('password').value;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Error('Ingresa un correo electrónico válido.');
      if (password.length < 8) throw Error('La contraseña debe tener al menos 8 caracteres.');
      submit.disabled = true;
      status.textContent = 'Creando tu cuenta…';
      const { data, error } = await authClient.auth.signUp({
        email, password,
        options: {
          emailRedirectTo: new URL('index.html', location.href).href,
          data: metadata
        }
      });
      if (error) throw error;
      status.textContent = data.session
        ? 'Cuenta creada. Ya puedes ingresar a tu panel.'
        : 'Revisa tu correo y confirma tu cuenta para ingresar.';
      byId('authmsg').textContent = status.textContent;
      if (data.session && typeof init === 'function') await init();
    } catch (e) {
      status.textContent = e?.message || 'No se pudo crear la cuenta.';
    } finally {
      submit.disabled = false;
    }
  });

  let shownUserId = null;
  async function refreshGreeting() {
    if (workspace.classList.contains('hide')) return;
    const { data, error } = await authClient.auth.getUser();
    if (error || !data?.user) return;
    const u = data.user;
    const m = u.user_metadata || {};
    let first = clean(m.first_name).split(' ')[0];
    if (!first) {
      // Usuarios anteriores: se muestra un saludo neutro si aún no llenaron su perfil.
      first = '';
    }
    if (heading) {
      heading.textContent = first ? `¡Hola, ${first}! Este es tu espacio de evaluación.` : '¡Hola! Este es tu espacio de evaluación.';
      heading.classList.add('ek-user-greeting');
    }
    if (shownUserId !== u.id) {
      shownUserId = u.id;
      fillFields('ekEdit', m);
    }
  }
  editBtn.onclick = async () => {
    const showing = profile.classList.contains('hide');
    if (showing) {
      const { data, error } = await authClient.auth.getUser();
      if (error || !data?.user) return;
      fillFields('ekEdit', data.user.user_metadata || {});
    }
    profile.classList.toggle('hide', !showing);
    byId('ekEditStatus').textContent = '';
    if (showing) byId('ekEditFirst').focus();
  };
  byId('ekEditCancel').onclick = () => profile.classList.add('hide');
  profile.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const status = byId('ekEditStatus');
    const submit = byId('ekEditSubmit');
    try {
      const metadata = readFields('ekEdit');
      submit.disabled = true;
      status.textContent = 'Guardando tus datos…';
      const { error } = await authClient.auth.updateUser({ data: metadata });
      if (error) throw error;
      status.textContent = 'Datos actualizados correctamente.';
      profile.classList.add('hide');
      await refreshGreeting();
    } catch (e) {
      status.textContent = e?.message || 'No se pudieron guardar los datos.';
    } finally {
      submit.disabled = false;
    }
  });

  // Detecta cuándo el inicio de sesión existente muestra el panel.
  const observer = new MutationObserver(() => {
    if (!workspace.classList.contains('hide')) refreshGreeting().catch(console.warn);
    else {
      shownUserId = null;
      profile.classList.add('hide');
    }
  });
  observer.observe(workspace, { attributes: true, attributeFilter: ['class'] });
  authClient.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
      setTimeout(() => refreshGreeting().catch(console.warn), 0);
    }
  });
  refreshGreeting().catch(console.warn);
})();

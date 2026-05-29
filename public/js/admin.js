/* ══════════════════════════════════════════
   ADMIN PANEL JS — Jose Miguel Portfolio
══════════════════════════════════════════ */

// ── JWT TOKEN (localStorage — funciona en Vercel serverless) ──────
const TOKEN_KEY = 'jmf_admin_token';
const getToken  = () => localStorage.getItem(TOKEN_KEY);
const setToken  = t  => localStorage.setItem(TOKEN_KEY, t);
const clearToken = () => localStorage.removeItem(TOKEN_KEY);

// ── API HELPER (incluye JWT en cada request) ──────────────────────
const api = {
  _headers(extra = {}) {
    const h = { 'Content-Type': 'application/json', ...extra };
    const t = getToken();
    if (t) h['Authorization'] = `Bearer ${t}`;
    return h;
  },
  async get(url) {
    try { const r = await fetch(url, { headers: this._headers() }); return r.json(); }
    catch(e) { return { success: false, error: e.message }; }
  },
  async post(url, body) {
    try { const r = await fetch(url, { method: 'POST', headers: this._headers(), body: JSON.stringify(body) }); return r.json(); }
    catch(e) { return { success: false, error: e.message }; }
  },
  async put(url, body) {
    try { const r = await fetch(url, { method: 'PUT', headers: this._headers(), body: JSON.stringify(body) }); return r.json(); }
    catch(e) { return { success: false, error: e.message }; }
  },
  async delete(url) {
    try { const r = await fetch(url, { method: 'DELETE', headers: this._headers() }); return r.json(); }
    catch(e) { return { success: false, error: e.message }; }
  },
  async patch(url, body = {}) {
    try { const r = await fetch(url, { method: 'PATCH', headers: this._headers(), body: JSON.stringify(body) }); return r.json(); }
    catch(e) { return { success: false, error: e.message }; }
  },
  async postForm(url, formData) {
    // FormData no lleva Content-Type (lo pone el browser solo con boundary)
    const h = {};
    const t = getToken();
    if (t) h['Authorization'] = `Bearer ${t}`;
    try { const r = await fetch(url, { method: 'POST', headers: h, body: formData }); return r.json(); }
    catch(e) { return { success: false, error: e.message }; }
  },
  async putForm(url, formData) {
    const h = {};
    const t = getToken();
    if (t) h['Authorization'] = `Bearer ${t}`;
    try { const r = await fetch(url, { method: 'PUT', headers: h, body: formData }); return r.json(); }
    catch(e) { return { success: false, error: e.message }; }
  }
};

// ── INIT ──────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  setupMobileSidebar();

  // Verificar si hay token válido guardado
  if (getToken()) {
    const res = await api.get('/api/admin/check');
    if (res.authenticated) { showAdmin(); }
    else clearToken(); // token expirado
  }

  document.getElementById('loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const username = document.getElementById('loginUser').value;
    const password = document.getElementById('loginPass').value;
    const r = await api.post('/api/admin/login', { username, password });
    if (r.success && r.token) {
      setToken(r.token);
      showAdmin();
    } else {
      const err = document.getElementById('loginError');
      err.textContent = r.error || 'Credenciales incorrectas';
      err.classList.add('show');
      setTimeout(() => err.classList.remove('show'), 3000);
    }
  });

  document.getElementById('logoutBtn').addEventListener('click', () => {
    clearToken();
    location.reload();
  });

  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => switchPanel(item.dataset.panel));
  });
});

function showAdmin() {
  document.getElementById('loginWrap').style.display = 'none';
  document.getElementById('adminLayout').style.display = 'flex';
  loadDashboard();
  loadProfile();
}

// ── TOAST ─────────────────────────────────
function toast(msg, type = 'success') {
  const c = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = type === 'success' ? '✅ ' + msg : type === 'error' ? '❌ ' + msg : '⚠️ ' + msg;
  c.appendChild(t);
  setTimeout(() => {
    t.style.animation = 'toast-out 0.3s ease forwards';
    setTimeout(() => t.remove(), 300);
  }, 3500);
}

// ── PANEL NAVIGATION ──────────────────────
const panelTitles = {
  dashboard: 'Dashboard', profile: 'Perfil', skills: 'Habilidades',
  experience: 'Experiencia Laboral', education: 'Formación Académica',
  projects: 'Proyectos', certifications: 'Certificaciones',
  references: 'Referencias', pdf: 'Generar CV PDF', security: 'Seguridad'
};

function switchPanel(name) {
  document.querySelectorAll('.panel-section').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`panel-${name}`).classList.add('active');
  document.querySelector(`[data-panel="${name}"]`).classList.add('active');
  document.getElementById('topbarTitle').textContent = panelTitles[name] || name;

  const loaders = {
    skills: loadSkills, experience: loadExp, education: loadEdu,
    projects: loadProjects, certifications: loadCerts, references: loadRefs
  };
  if (loaders[name]) loaders[name]();
}

// ── MODAL HELPERS ─────────────────────────
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function showFileName(input, targetId) {
  document.getElementById(targetId).textContent = input.files[0] ? input.files[0].name : '';
}

// ── IMAGEN A BASE64 (comprimida) ──────────
// Comprime y convierte una imagen a base64 usando Canvas.
// Así se puede guardar directamente en la DB sin filesystem.
function imageToBase64(file, maxPx = 900, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = e => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const ratio = Math.min(maxPx / img.width, maxPx / img.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width  = Math.round(img.width  * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// Para archivos que no son imágenes (PDF) — solo convierte sin comprimir
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = e => resolve(e.target.result);
    reader.readAsDataURL(file);
  });
}

// ── DASHBOARD ─────────────────────────────
async function loadDashboard() {
  const r = await api.get('/api/portfolio');
  if (!r.success) return;
  const { skills, experiences, education, projects, certifications } = r.data;
  document.getElementById('dashStats').innerHTML = [
    { n: projects.length, l: 'Proyectos' },
    { n: skills.length, l: 'Habilidades' },
    { n: experiences.length, l: 'Experiencias' },
    { n: education.length, l: 'Educación' },
    { n: certifications.length, l: 'Certificados' },
    { n: projects.filter(p => p.is_production).length, l: 'En Prod.' }
  ].map(s => `
    <div class="stat-card">
      <div class="stat-card-number">${s.n}</div>
      <div class="stat-card-label">${s.l}</div>
    </div>
  `).join('');
}

// ── PROFILE ───────────────────────────────
async function loadProfile() {
  const r = await api.get('/api/admin/profile');
  if (!r.success) return;
  const p = r.data;
  document.getElementById('p_name').value = p.name || '';
  document.getElementById('p_title').value = p.title || '';
  document.getElementById('p_bio').value = p.bio || '';
  document.getElementById('p_phone').value = p.phone || '';
  document.getElementById('p_whatsapp').value = p.whatsapp || '';
  document.getElementById('p_email').value = p.email || '';
  document.getElementById('p_location').value = p.location || '';
  document.getElementById('p_linkedin').value = p.linkedin || '';
  document.getElementById('p_github').value = p.github || '';
  document.getElementById('p_portfolio_url').value = p.portfolio_url || '';

  if (p.photo) {
    document.getElementById('photoPlaceholder').style.display = 'none';
    const img = document.getElementById('photoPreview');
    img.src = p.photo;
    img.classList.add('show');
    // Si es URL externa, mostrarla en el campo
    if (p.photo.startsWith('http')) {
      document.getElementById('photoUrl').value = p.photo;
    }
  }
}

async function saveProfile() {
  const body = {
    name: document.getElementById('p_name').value,
    title: document.getElementById('p_title').value,
    bio: document.getElementById('p_bio').value,
    phone: document.getElementById('p_phone').value,
    whatsapp: document.getElementById('p_whatsapp').value,
    email: document.getElementById('p_email').value,
    location: document.getElementById('p_location').value,
    linkedin: document.getElementById('p_linkedin').value,
    github: document.getElementById('p_github').value,
    portfolio_url: document.getElementById('p_portfolio_url').value
  };
  const r = await api.put('/api/admin/profile', body);
  r.success ? toast('Perfil guardado correctamente') : toast(r.error || 'Error al guardar', 'error');
}

function previewPhoto(input) {
  if (!input.files[0]) return;
  document.getElementById('photoFileName').textContent = input.files[0].name;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('photoPlaceholder').style.display = 'none';
    const img = document.getElementById('photoPreview');
    img.src = e.target.result; img.classList.add('show');
  };
  reader.readAsDataURL(input.files[0]);
}

async function uploadPhoto() {
  const file = document.getElementById('photoFile').files[0];
  if (!file) { toast('Selecciona una foto primero', 'warning'); return; }
  toast('Procesando imagen...', 'success');
  try {
    const base64 = await imageToBase64(file, 500, 0.85);
    const r = await api.post('/api/admin/profile/photo', { data: base64 });
    if (r.success) {
      document.getElementById('photoPlaceholder').style.display = 'none';
      const img = document.getElementById('photoPreview');
      img.src = base64; img.classList.add('show');
      toast('Foto guardada en la base de datos');
    } else toast(r.error || 'Error', 'error');
  } catch (e) { toast('Error procesando imagen', 'error'); }
}

// ── SKILLS ────────────────────────────────
async function loadSkills() {
  const r = await api.get('/api/admin/skills');
  if (!r.success) return;
  const list = document.getElementById('skillsList');
  if (!r.data.length) { list.innerHTML = emptyState('⚡', 'No hay habilidades aún'); return; }
  list.innerHTML = r.data.map(s => `
    <div class="item-card">
      <div class="item-card-info">
        <div class="item-card-title">${s.name}</div>
        <div class="item-card-sub">${s.category}</div>
      </div>
      <span class="item-badge ${s.visible ? 'badge-visible' : 'badge-hidden'}">${s.visible ? 'Visible' : 'Oculto'}</span>
      <div class="item-card-actions">
        <button class="btn btn-ghost" style="font-size:0.75rem;" onclick="editSkill(${s.id},'${escHtml(s.name)}','${escHtml(s.category)}',${s.visible})">✏️ Editar</button>
        <button class="btn btn-danger" style="font-size:0.75rem;" onclick="deleteItem('/api/admin/skills/${s.id}',loadSkills)">🗑️</button>
      </div>
    </div>
  `).join('');
}

function openSkillModal() { document.getElementById('skill_id').value=''; document.getElementById('skill_name').value=''; document.getElementById('skillModalTitle').textContent='Agregar Habilidad'; openModal('skillModal'); }

function editSkill(id, name, category, visible) {
  document.getElementById('skill_id').value = id;
  document.getElementById('skill_name').value = name;
  document.getElementById('skill_category').value = category;
  document.getElementById('skillModalTitle').textContent = 'Editar Habilidad';
  openModal('skillModal');
}

async function saveSkill() {
  const id = document.getElementById('skill_id').value;
  const body = { name: document.getElementById('skill_name').value, category: document.getElementById('skill_category').value, visible: 1 };
  if (!body.name) { toast('El nombre es requerido', 'warning'); return; }
  const r = id ? await api.put(`/api/admin/skills/${id}`, body) : await api.post('/api/admin/skills', body);
  if (r.success) { closeModal('skillModal'); loadSkills(); toast('Habilidad guardada'); }
  else toast(r.error || 'Error', 'error');
}

// ── EXPERIENCE ────────────────────────────
async function loadExp() {
  const r = await api.get('/api/admin/experiences');
  if (!r.success) return;
  const list = document.getElementById('expList');
  if (!r.data.length) { list.innerHTML = emptyState('💼','No hay experiencia aún'); return; }
  list.innerHTML = r.data.map(e => `
    <div class="item-card">
      <div class="item-card-info">
        <div class="item-card-title">${e.title}</div>
        <div class="item-card-sub">${e.company || ''}${e.is_current ? ' · <span style="color:var(--cyan)">Actual</span>' : ''}</div>
      </div>
      <span class="item-badge ${e.is_current ? 'badge-current' : 'badge-visible'}">${e.is_current ? 'Actual' : 'Finalizado'}</span>
      <div class="item-card-actions">
        <button class="btn btn-ghost" style="font-size:0.75rem;" onclick="editExp(${JSON.stringify(e).replace(/"/g,'&quot;')})">✏️</button>
        <button class="btn btn-danger" style="font-size:0.75rem;" onclick="deleteItem('/api/admin/experiences/${e.id}',loadExp)">🗑️</button>
      </div>
    </div>
  `).join('');
}

function openExpModal(data = null) {
  document.getElementById('exp_id').value = data ? data.id : '';
  document.getElementById('exp_title').value = data ? data.title : '';
  document.getElementById('exp_company').value = data ? (data.company || '') : '';
  document.getElementById('exp_company_url').value = data ? (data.company_url || '') : '';
  document.getElementById('exp_start_date').value = data ? (data.start_date || '') : '';
  document.getElementById('exp_end_date').value = data ? (data.end_date || '') : '';
  document.getElementById('exp_is_current').checked = data ? !!data.is_current : false;
  document.getElementById('exp_description').value = data ? (data.description || '') : '';
  document.getElementById('expModalTitle').textContent = data ? 'Editar Experiencia' : 'Agregar Experiencia';
  openModal('expModal');
}

function editExp(data) { openExpModal(data); }

async function saveExp() {
  const id = document.getElementById('exp_id').value;
  const body = {
    title: document.getElementById('exp_title').value,
    company: document.getElementById('exp_company').value,
    company_url: document.getElementById('exp_company_url').value,
    start_date: document.getElementById('exp_start_date').value,
    end_date: document.getElementById('exp_end_date').value,
    is_current: document.getElementById('exp_is_current').checked,
    description: document.getElementById('exp_description').value,
    visible: 1
  };
  if (!body.title) { toast('El título es requerido', 'warning'); return; }
  const r = id ? await api.put(`/api/admin/experiences/${id}`, body) : await api.post('/api/admin/experiences', body);
  if (r.success) { closeModal('expModal'); loadExp(); toast('Experiencia guardada'); }
  else toast(r.error || 'Error', 'error');
}

// ── EDUCATION ─────────────────────────────
async function loadEdu() {
  const r = await api.get('/api/admin/education');
  if (!r.success) return;
  const list = document.getElementById('eduList');
  if (!r.data.length) { list.innerHTML = emptyState('🎓','No hay educación aún'); return; }
  list.innerHTML = r.data.map(e => `
    <div class="item-card">
      <div class="item-card-info">
        <div class="item-card-title">${e.degree}</div>
        <div class="item-card-sub">${e.institution || ''} · ${e.status}</div>
      </div>
      <div class="item-card-actions">
        <button class="btn btn-ghost" style="font-size:0.75rem;" onclick="editEdu(${JSON.stringify(e).replace(/"/g,'&quot;')})">✏️</button>
        <button class="btn btn-danger" style="font-size:0.75rem;" onclick="deleteItem('/api/admin/education/${e.id}',loadEdu)">🗑️</button>
      </div>
    </div>
  `).join('');
}

function openEduModal(data = null) {
  document.getElementById('edu_id').value = data ? data.id : '';
  document.getElementById('edu_degree').value = data ? data.degree : '';
  document.getElementById('edu_institution').value = data ? (data.institution || '') : '';
  document.getElementById('edu_year').value = data ? (data.year || '') : '';
  document.getElementById('edu_status').value = data ? data.status : 'Certificado';
  document.getElementById('eduModalTitle').textContent = data ? 'Editar Educación' : 'Agregar Educación';
  openModal('eduModal');
}

function editEdu(data) { openEduModal(data); }

async function saveEdu() {
  const id = document.getElementById('edu_id').value;
  const body = {
    degree: document.getElementById('edu_degree').value,
    institution: document.getElementById('edu_institution').value,
    year: document.getElementById('edu_year').value,
    status: document.getElementById('edu_status').value,
    visible: 1
  };
  if (!body.degree) { toast('El título es requerido', 'warning'); return; }
  const r = id ? await api.put(`/api/admin/education/${id}`, body) : await api.post('/api/admin/education', body);
  if (r.success) { closeModal('eduModal'); loadEdu(); toast('Educación guardada'); }
  else toast(r.error || 'Error', 'error');
}

// ── PROJECTS ──────────────────────────────
async function loadProjects() {
  const r = await api.get('/api/admin/projects');
  if (!r.success) return;
  const list = document.getElementById('projList');
  if (!r.data.length) { list.innerHTML = emptyState('🚀','No hay proyectos aún'); return; }
  list.innerHTML = r.data.map(p => `
    <div class="item-card">
      ${p.image ? `<img class="img-thumb" src="${p.image}" alt="${p.name}">` : '<div style="width:44px;height:44px;background:var(--card2);border-radius:6px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:1.4rem;">🖥️</div>'}
      <div class="item-card-info">
        <div class="item-card-title">${p.name}</div>
        <div class="item-card-sub">${p.url ? `<a href="${p.url}" target="_blank" style="color:var(--blue);">${p.url.replace('https://','')}</a>` : 'Sin URL'}</div>
      </div>
      ${p.is_production ? '<span class="item-badge badge-prod">En Producción</span>' : '<span class="item-badge badge-hidden">Borrador</span>'}
      <div class="item-card-actions">
        <button class="btn btn-ghost" style="font-size:0.75rem;" onclick="editProject(${JSON.stringify(p).replace(/"/g,'&quot;')})">✏️</button>
        <button class="btn btn-danger" style="font-size:0.75rem;" onclick="deleteItem('/api/admin/projects/${p.id}',loadProjects)">🗑️</button>
      </div>
    </div>
  `).join('');
}

function openProjModal(data = null) {
  document.getElementById('proj_id').value = data ? data.id : '';
  document.getElementById('proj_name').value = data ? data.name : '';
  document.getElementById('proj_description').value = data ? (data.description || '') : '';
  document.getElementById('proj_url').value = data ? (data.url || '') : '';
  document.getElementById('proj_tags').value = data ? (data.tags || '') : '';
  document.getElementById('proj_is_production').checked = data ? !!data.is_production : false;
  document.getElementById('proj_img_name').textContent = '';
  document.getElementById('proj_image').value = '';
  document.getElementById('proj_image_url').value =
    (data && data.image && data.image.startsWith('http')) ? data.image : '';
  // Mostrar preview si ya tiene imagen
  const prevEl = document.getElementById('proj_img_preview');
  if (prevEl) {
    prevEl.src = (data && data.image) ? data.image : '';
    prevEl.style.display = (data && data.image) ? 'block' : 'none';
  }
  document.getElementById('projModalTitle').textContent = data ? 'Editar Proyecto' : 'Agregar Proyecto';
  openModal('projModal');
}

function editProject(data) { openProjModal(data); }

async function saveProject() {
  const id = document.getElementById('proj_id').value;
  if (!document.getElementById('proj_name').value) { toast('El nombre es requerido', 'warning'); return; }

  let image = document.getElementById('proj_image_url').value.trim() || undefined;
  const imgFile = document.getElementById('proj_image').files[0];

  if (imgFile) {
    toast('Procesando imagen...', 'success');
    try { image = await imageToBase64(imgFile, 900, 0.8); }
    catch (e) { toast('Error procesando imagen', 'error'); return; }
  }

  const body = {
    name: document.getElementById('proj_name').value,
    description: document.getElementById('proj_description').value,
    url: document.getElementById('proj_url').value,
    tags: document.getElementById('proj_tags').value,
    is_production: document.getElementById('proj_is_production').checked ? 1 : 0,
    visible: 1,
    image
  };

  const r = id
    ? await api.put(`/api/admin/projects/${id}`, body)
    : await api.post('/api/admin/projects', body);

  if (r.success) { closeModal('projModal'); loadProjects(); toast('Proyecto guardado'); }
  else toast(r.error || 'Error', 'error');
}

// ── CERTIFICATIONS ────────────────────────
async function loadCerts() {
  const r = await api.get('/api/admin/certifications');
  if (!r.success) return;
  const list = document.getElementById('certList');
  if (!r.data.length) { list.innerHTML = emptyState('📜','No hay certificaciones aún'); return; }
  list.innerHTML = r.data.map(c => {
    // Miniatura: usa /api/img/cert/:id para no cargar todo el base64 en el listado
    const thumb = c.file_type === 'image'
      ? `<img class="img-thumb" src="/api/img/cert/${c.id}" alt="${c.name}" onerror="this.style.display='none'">`
      : '<div style="width:44px;height:44px;background:var(--card2);border-radius:6px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:1.4rem;">📄</div>';
    // No incluir file_path en el JSON del onclick (puede ser base64 enorme)
    const certData = JSON.stringify({ id: c.id, name: c.name, institution: c.institution, file_type: c.file_type, visible: c.visible }).replace(/"/g,'&quot;');
    return `
    <div class="item-card">
      ${thumb}
      <div class="item-card-info">
        <div class="item-card-title">${c.name}</div>
        <div class="item-card-sub">${c.institution || ''} · ${c.file_type === 'pdf' ? 'PDF' : 'Imagen'}</div>
      </div>
      <span class="item-badge ${c.visible ? 'badge-visible' : 'badge-hidden'}">${c.visible ? 'Visible' : 'Oculto'}</span>
      <div class="item-card-actions">
        <button class="btn btn-cyan" style="font-size:0.72rem;" onclick="toggleCert(${c.id})">👁 Toggle</button>
        <button class="btn btn-ghost" style="font-size:0.72rem;" onclick="editCert(${certData})">✏️ Editar</button>
        <button class="btn btn-danger" style="font-size:0.72rem;" onclick="deleteItem('/api/admin/certifications/${c.id}',loadCerts)">🗑️</button>
      </div>
    </div>
  `;
  }).join('');
}

function openCertModal(data = null) {
  document.getElementById('cert_id').value = data ? data.id : '';
  document.getElementById('cert_name').value = data ? data.name : '';
  document.getElementById('cert_institution').value = data ? (data.institution || '') : '';
  document.getElementById('cert_file_name').textContent = '';
  document.getElementById('cert_file').value = '';
  // Siempre mostrar el campo de archivo — permite cambiar imagen al editar
  document.getElementById('certFileGroup').style.display = 'block';
  const label = data
    ? (data.file_type === 'image' ? '📷 Cambiar imagen (opcional)' : '📎 Cambiar archivo (opcional)')
    : '📎 Seleccionar archivo';
  document.querySelector('#certFileGroup label[for="cert_file"]').textContent = label;
  document.getElementById('certModalTitle').textContent = data ? 'Editar Certificación' : 'Subir Certificación';
  openModal('certModal');
}

function editCert(data) { openCertModal(data); }

async function toggleCert(id) {
  const r = await api.patch(`/api/admin/certifications/${id}/toggle`);
  if (r.success) { loadCerts(); toast('Visibilidad actualizada'); }
  else toast(r.error || 'Error', 'error');
}

async function saveCert() {
  const id   = document.getElementById('cert_id').value;
  const name = document.getElementById('cert_name').value;
  const inst = document.getElementById('cert_institution').value;
  const file = document.getElementById('cert_file').files[0];

  if (!name) { toast('El nombre es requerido', 'warning'); return; }
  if (!id && !file) { toast('Selecciona un archivo', 'warning'); return; }

  // Si hay un archivo seleccionado → convertir a base64 (nueva o cambio de imagen)
  if (file) {
    toast('Procesando archivo...', 'success');
    try {
      let file_data, file_type;
      if (file.type.startsWith('image/')) {
        file_data = await imageToBase64(file, 1400, 0.88);
        file_type = 'image';
      } else {
        file_data = await fileToBase64(file);
        file_type = 'pdf';
      }
      if (id) {
        const r = await api.put(`/api/admin/certifications/${id}`, { name, institution: inst, visible: 1, file_data, file_type });
        if (r.success) { closeModal('certModal'); loadCerts(); toast('Certificación actualizada con nueva imagen'); }
        else toast(r.error || 'Error', 'error');
      } else {
        const r = await api.post('/api/admin/certifications', { name, institution: inst, file_data, file_type });
        if (r.success) { closeModal('certModal'); loadCerts(); toast('Certificación guardada en la DB'); }
        else toast(r.error || 'Error', 'error');
      }
    } catch (e) { toast('Error procesando archivo', 'error'); }
  } else {
    // Solo actualizar nombre/institución
    const r = await api.put(`/api/admin/certifications/${id}`, { name, institution: inst, visible: 1 });
    if (r.success) { closeModal('certModal'); loadCerts(); toast('Certificación actualizada'); }
    else toast(r.error || 'Error', 'error');
  }
}

// ── REFERENCES ────────────────────────────
async function loadRefs() {
  const r = await api.get('/api/admin/references');
  if (!r.success) return;

  const renderRef = (refs, type) => refs.map(ref => `
    <div class="item-card">
      <div class="item-card-info">
        <div class="item-card-title">${ref.name}</div>
        <div class="item-card-sub">${type === 'laboral' ? (ref.company || '') : (ref.relation || '')} ${ref.phone ? '· ' + ref.phone : ''}</div>
      </div>
      <div class="item-card-actions">
        <button class="btn btn-ghost" style="font-size:0.72rem;" onclick="editRef('${type}',${JSON.stringify(ref).replace(/"/g,'&quot;')})">✏️</button>
        <button class="btn btn-danger" style="font-size:0.72rem;" onclick="deleteItem('/api/admin/references/${type}/${ref.id}',loadRefs)">🗑️</button>
      </div>
    </div>
  `).join('') || emptyState('👥','Sin referencias');

  document.getElementById('refsPersonalList').innerHTML = renderRef(r.data.personal, 'personal');
  document.getElementById('refsLaboralList').innerHTML = renderRef(r.data.laboral, 'laboral');
}

function openRefModal(type, data = null) {
  document.getElementById('ref_id').value = data ? data.id : '';
  document.getElementById('ref_type').value = type;
  document.getElementById('ref_name').value = data ? data.name : '';
  document.getElementById('ref_phone').value = data ? (data.phone || '') : '';
  const extraField = document.getElementById('ref_extra');
  const extraGroup = document.getElementById('refCompanyGroup');
  if (type === 'laboral') {
    extraGroup.querySelector('label').textContent = 'Empresa';
    extraField.placeholder = 'Nombre de empresa';
    extraField.value = data ? (data.company || '') : '';
  } else {
    extraGroup.querySelector('label').textContent = 'Relación';
    extraField.placeholder = 'Amigo, colega, etc.';
    extraField.value = data ? (data.relation || '') : '';
  }
  document.getElementById('refModalTitle').textContent = `${data ? 'Editar' : 'Agregar'} Ref. ${type === 'laboral' ? 'Laboral' : 'Personal'}`;
  openModal('refModal');
}

function editRef(type, data) { openRefModal(type, data); }

async function saveRef() {
  const id = document.getElementById('ref_id').value;
  const type = document.getElementById('ref_type').value;
  const name = document.getElementById('ref_name').value;
  if (!name) { toast('El nombre es requerido', 'warning'); return; }
  const phone = document.getElementById('ref_phone').value;
  const extra = document.getElementById('ref_extra').value;

  const body = type === 'laboral'
    ? { name, phone, company: extra }
    : { name, phone, relation: extra };

  const url = `/api/admin/references/${type}${id ? '/'+id : ''}`;
  const r = id ? await api.put(url, body) : await api.post(url, body);

  if (r.success) { closeModal('refModal'); loadRefs(); toast('Referencia guardada'); }
  else toast(r.error || 'Error', 'error');
}

// ── PDF GENERATION ────────────────────────
async function generatePDF() {
  const includeCerts = document.getElementById('pdfIncludeCerts').checked;
  toast('Generando PDF, por favor espera...', 'success');
  const url = `/api/admin/pdf/generate?includeCerts=${includeCerts}`;
  try {
    // Incluir el token JWT — fetch directo necesita el header manualmente
    const token = getToken();
    const r = await fetch(url, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });
    if (!r.ok) {
      try { const j = await r.json(); toast(j.error || 'Error al generar PDF', 'error'); }
      catch (_) { toast('Error al generar PDF (status ' + r.status + ')', 'error'); }
      return;
    }
    const blob = await r.blob();
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objUrl; a.download = 'CV-Jose-Miguel-Franco-Bonilla.pdf';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(objUrl);
    toast('PDF generado y descargado exitosamente!');
  } catch(e) { toast('Error al generar PDF: ' + e.message, 'error'); }
}

// ── PASSWORD ──────────────────────────────
async function changePassword() {
  const curr = document.getElementById('currPass').value;
  const newP = document.getElementById('newPass').value;
  const conf = document.getElementById('confPass').value;
  if (!curr || !newP || !conf) { toast('Completa todos los campos', 'warning'); return; }
  if (newP !== conf) { toast('Las contraseñas no coinciden', 'warning'); return; }
  if (newP.length < 6) { toast('La contraseña debe tener mínimo 6 caracteres', 'warning'); return; }
  const r = await api.put('/api/admin/change-password', { currentPassword: curr, newPassword: newP });
  if (r.success) {
    toast('Contraseña actualizada correctamente');
    document.getElementById('currPass').value = '';
    document.getElementById('newPass').value = '';
    document.getElementById('confPass').value = '';
  } else toast(r.error || 'Error', 'error');
}

// ── GENERIC DELETE ────────────────────────
async function deleteItem(url, reloadFn) {
  if (!confirm('¿Estás seguro de eliminar este elemento?')) return;
  const r = await api.delete(url);
  if (r.success) { reloadFn(); toast('Eliminado correctamente'); }
  else toast(r.error || 'Error al eliminar', 'error');
}

// ── HELPERS ───────────────────────────────
function emptyState(icon, text) {
  return `<div class="empty-state"><div class="empty-state-icon">${icon}</div><div class="empty-state-text">${text}</div></div>`;
}

function escHtml(str) { return (str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;'); }

// ── SIDEBAR MÓVIL ─────────────────────────
// El CSS controla visibilidad del botón (.topbar-menu-btn)
// El JS solo maneja la lógica de abrir/cerrar
function setupMobileSidebar() {
  const menuBtn = document.getElementById('mobileMenuBtn');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');

  if (!menuBtn || !sidebar || !overlay) return;

  function openSidebar() {
    sidebar.classList.add('open');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden'; // evita scroll del fondo
  }

  function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  menuBtn.addEventListener('click', () =>
    sidebar.classList.contains('open') ? closeSidebar() : openSidebar()
  );

  overlay.addEventListener('click', closeSidebar);

  // Cerrar al seleccionar sección en móvil
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      if (window.matchMedia('(max-width: 768px)').matches) closeSidebar();
    });
  });

  // Cerrar si se agranda la ventana
  window.addEventListener('resize', () => {
    if (!window.matchMedia('(max-width: 768px)').matches) closeSidebar();
  });
}

/* ══════════════════════════════════════════
   PORTFOLIO MAIN.JS — Jose Miguel Franco B.
══════════════════════════════════════════ */

let portfolioData = null;

// ── INIT ──────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  createParticles();
  setupNavbar();
  setupHamburger();
  setupScrollAnimations();
  setupProjectFilters();
  setupCertLightbox();

  try {
    const res = await fetch('/api/portfolio');
    const json = await res.json();
    if (json.success) {
      portfolioData = json.data;
      renderAll(portfolioData);
    }
  } catch (e) {
    console.error('Error cargando portfolio:', e);
  }

  setTimeout(() => {
    const loading = document.getElementById('loading');
    if (loading) {
      loading.style.opacity = '0';
      loading.style.transition = 'opacity 0.5s ease';
      setTimeout(() => loading.remove(), 500);
    }
  }, 1500);
});

// ── RENDER ALL ────────────────────────────
function renderAll(data) {
  const { profile, skills, experiences, education, projects, certifications, refs_personal, refs_laboral } = data;

  renderHero(profile, projects, skills);
  renderAbout(profile);
  renderSkills(skills);
  renderExperience(experiences);
  renderEducation(education);
  renderProjects(projects);
  renderCertifications(certifications);
  renderReferences(refs_personal, refs_laboral);
  renderContact(profile);
}

// ── HERO ──────────────────────────────────
function renderHero(profile, projects, skills) {
  if (!profile) return;

  const nameParts = (profile.name || 'Jose Miguel Franco Bonilla').split(' ');
  const half = Math.ceil(nameParts.length / 2);
  document.getElementById('heroFirst').textContent = nameParts.slice(0, half).join(' ');
  document.getElementById('heroLast').textContent = nameParts.slice(half).join(' ');
  document.getElementById('heroTitle').textContent = profile.title || '';
  document.getElementById('statProjects').textContent = projects.length;
  document.getElementById('statSkills').textContent = skills.length + '+';
  document.title = (profile.name || 'Jose Miguel Franco Bonilla') + ' — Portfolio';
  document.getElementById('footerName').textContent = profile.name || 'Jose Miguel Franco Bonilla';

  if (profile.photo) {
    document.getElementById('heroPhotoWrap').innerHTML =
      `<img class="hero-photo" src="${profile.photo}" alt="${profile.name}" loading="lazy">`;
  }
}

// ── ABOUT ─────────────────────────────────
function renderAbout(profile) {
  if (!profile) return;

  document.getElementById('aboutBio').textContent = profile.bio || '';
  document.getElementById('aboutBadge').textContent = '✦ Fullstack Dev';

  if (profile.photo) {
    document.getElementById('aboutPhotoWrap').innerHTML =
      `<img class="about-photo" src="${profile.photo}" alt="${profile.name}" loading="lazy">`;
  }

  const details = [
    profile.phone && { icon: '📞', label: 'Teléfono', value: profile.phone },
    profile.email && { icon: '✉️', label: 'Email', value: profile.email },
    profile.location && { icon: '📍', label: 'Ubicación', value: profile.location },
    profile.linkedin && { icon: '💼', label: 'LinkedIn', value: profile.linkedin },
    profile.github && { icon: '🐙', label: 'GitHub', value: profile.github },
  ].filter(Boolean);

  document.getElementById('aboutDetails').innerHTML = details.map(d => `
    <div class="detail-item">
      <span class="detail-icon">${d.icon}</span>
      <div>
        <span class="detail-label">${d.label}</span>
        <span class="detail-value">${d.value}</span>
      </div>
    </div>
  `).join('');
}

// ── SKILLS ────────────────────────────────
function renderSkills(skills) {
  const container = document.getElementById('skillsContainer');
  if (!skills.length) { container.innerHTML = '<p style="text-align:center;color:var(--text-muted);">No hay habilidades configuradas.</p>'; return; }

  const byCategory = {};
  skills.forEach(s => {
    if (!byCategory[s.category]) byCategory[s.category] = [];
    byCategory[s.category].push(s);
  });

  container.innerHTML = Object.entries(byCategory).map(([cat, items]) => `
    <div class="skill-category">
      <div class="skill-category-title">${cat}</div>
      <div class="skills-tags">
        ${items.map(s => `
          <div class="skill-tag">
            <span class="skill-tag-dot"></span>
            ${s.name}
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

// ── EXPERIENCE ────────────────────────────
function renderExperience(experiences) {
  const container = document.getElementById('experienceContainer');
  if (!experiences.length) { container.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:2rem;">No hay experiencia configurada.</p>'; return; }

  container.innerHTML = experiences.map(exp => {
    const dates = exp.is_current
      ? (exp.start_date ? `${exp.start_date} — Presente` : 'Presente')
      : [exp.start_date, exp.end_date].filter(Boolean).join(' — ');
    const isCurrent = exp.is_current;
    return `
    <div class="timeline-item fade-up">
      <div class="timeline-dot">${isCurrent ? '🔥' : '💼'}</div>
      <div class="timeline-card">
        <div class="timeline-card-header">
          <span class="timeline-title">${exp.title}</span>
          <span class="timeline-badge ${isCurrent ? 'badge-current' : 'badge-past'}">${isCurrent ? 'Actual' : 'Finalizado'}</span>
        </div>
        ${exp.company ? `<div class="timeline-company">${exp.company_url ? `<a href="${exp.company_url}" target="_blank">${exp.company}</a>` : exp.company}</div>` : ''}
        ${dates ? `<div class="timeline-dates">📅 ${dates}</div>` : ''}
        ${exp.description ? `<div class="timeline-desc">${exp.description}</div>` : ''}
      </div>
    </div>
  `}).join('');

  setupScrollAnimations();
}

// ── EDUCATION ─────────────────────────────
function renderEducation(education) {
  const container = document.getElementById('educationContainer');
  if (!education.length) { container.innerHTML = '<p style="text-align:center;color:var(--text-muted);">No hay educación configurada.</p>'; return; }

  container.innerHTML = education.map(edu => {
    const statusClass = edu.status === 'En curso' ? 'status-curso' : edu.status === 'Certificado' ? 'status-cert' : 'status-done';
    return `
    <div class="edu-card fade-up">
      <div class="edu-status ${statusClass}">${edu.status}</div>
      <div class="edu-degree">${edu.degree}</div>
      ${edu.institution ? `<div class="edu-inst">🏫 ${edu.institution}</div>` : ''}
      ${edu.year ? `<div class="edu-inst" style="margin-top:4px;color:var(--text-muted);">📅 ${edu.year}</div>` : ''}
    </div>
  `}).join('');

  setupScrollAnimations();
}

// ── PROJECTS ──────────────────────────────
let allProjects = [];

function renderProjects(projects) {
  allProjects = projects;
  displayProjects('all');
}

function displayProjects(filter) {
  const container = document.getElementById('projectsContainer');
  const filtered = filter === 'all' ? allProjects
    : filter === 'production' ? allProjects.filter(p => p.is_production)
    : allProjects.filter(p => !p.is_production);

  if (!filtered.length) {
    container.innerHTML = '<p style="text-align:center;color:var(--text-muted);grid-column:1/-1;padding:2rem;">No hay proyectos en esta categoría.</p>';
    return;
  }

  container.innerHTML = filtered.map(p => {
    const tags = p.tags ? p.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
    return `
    <div class="project-card fade-up" data-prod="${p.is_production}">
      <div class="project-img-wrap">
        ${p.image
          ? `<img src="${p.image}" alt="${p.name}" loading="lazy">`
          : `<div class="project-img-placeholder">🖥️</div>`
        }
        ${p.is_production ? '<div class="project-prod-badge"><span class="prod-dot"></span> En Producción</div>' : ''}
      </div>
      <div class="project-body">
        <div class="project-name">${p.name}</div>
        <div class="project-desc">${p.description || ''}</div>
        ${tags.length ? `<div class="project-tags">${tags.map(t => `<span class="project-tag">${t}</span>`).join('')}</div>` : ''}
        ${p.url ? `<a href="${p.url}" target="_blank" rel="noopener" class="project-link">Ver proyecto →</a>` : ''}
      </div>
    </div>
  `}).join('');

  setupScrollAnimations();
}

function setupProjectFilters() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      displayProjects(btn.dataset.filter);
    });
  });
}

// ── CERTIFICATIONS ────────────────────────
function renderCertifications(certifications) {
  const container = document.getElementById('certsContainer');
  const section = document.getElementById('certifications');

  if (!certifications.length) {
    section.style.display = 'none';
    return;
  }

  container.innerHTML = certifications.map(cert => {
    // Las certs solo traen id/name/institution/file_type (no file_path por tamaño)
    // Usamos la ruta lazy /api/img/cert/:id para cargar la imagen
    const imgSrc = cert.file_type === 'image' ? `/api/img/cert/${cert.id}` : null;
    return `
    <div class="cert-card" onclick="openCertLightbox(${cert.id}, '${cert.name}', '${cert.file_type}')">
      <div class="cert-img-wrap">
        ${imgSrc
          ? `<img src="${imgSrc}" alt="${cert.name}" loading="lazy" onerror="this.parentNode.innerHTML='<div class=cert-img-placeholder>📜</div>'">`
          : `<div class="cert-img-placeholder">📄</div>`
        }
      </div>
      <div class="cert-body">
        <div class="cert-name">${cert.name}</div>
        ${cert.institution ? `<div class="cert-inst">${cert.institution}</div>` : ''}
      </div>
    </div>
  `;
  }).join('');
}

// ── REFERENCES ────────────────────────────
function renderReferences(personal, laboral) {
  const refsSection = document.getElementById('references');
  if (!personal.length && !laboral.length) { refsSection.style.display = 'none'; return; }

  document.getElementById('refsPersonal').innerHTML = personal.map(r => `
    <div class="ref-card">
      <div class="ref-name">${r.name}</div>
      ${r.relation ? `<div class="ref-company">${r.relation}</div>` : ''}
      ${r.phone ? `<div class="ref-phone">📞 ${r.phone}</div>` : ''}
    </div>
  `).join('') || '<p style="color:var(--text-muted);font-size:0.85rem;">Sin referencias personales.</p>';

  document.getElementById('refsLaboral').innerHTML = laboral.map(r => `
    <div class="ref-card">
      <div class="ref-name">${r.name}</div>
      ${r.company ? `<div class="ref-company">${r.company}</div>` : ''}
      ${r.phone ? `<div class="ref-phone">📞 ${r.phone}</div>` : ''}
    </div>
  `).join('') || '<p style="color:var(--text-muted);font-size:0.85rem;">Sin referencias laborales.</p>';
}

// ── CONTACT ───────────────────────────────
function renderContact(profile) {
  if (!profile) return;
  const links = [
    profile.email && { icon: '✉️', label: profile.email, href: `mailto:${profile.email}` },
    profile.phone && { icon: '📞', label: profile.phone, href: `tel:${profile.phone.replace(/\s/g,'')}` },
    profile.whatsapp && { icon: '💬', label: 'WhatsApp', href: `https://wa.me/${profile.whatsapp.replace(/\D/g,'')}` },
    profile.linkedin && { icon: '💼', label: 'LinkedIn', href: profile.linkedin.startsWith('http') ? profile.linkedin : `https://linkedin.com/in/${profile.linkedin}` },
    profile.github && { icon: '🐙', label: 'GitHub', href: profile.github.startsWith('http') ? profile.github : `https://github.com/${profile.github}` },
  ].filter(Boolean);

  document.getElementById('contactLinks').innerHTML = links.map(l => `
    <a href="${l.href}" target="_blank" rel="noopener" class="contact-link">
      <span class="contact-link-icon">${l.icon}</span>
      ${l.label}
    </a>
  `).join('');
}

// ── NAVBAR ────────────────────────────────
function setupNavbar() {
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 50);
  });
}

function setupHamburger() {
  const btn = document.getElementById('hamburger');
  const links = document.getElementById('navLinks');
  btn.addEventListener('click', () => links.classList.toggle('open'));
  document.querySelectorAll('.nav-links a').forEach(a => {
    a.addEventListener('click', () => links.classList.remove('open'));
  });
}

// ── SCROLL ANIMATIONS ─────────────────────
function setupScrollAnimations() {
  const els = document.querySelectorAll('.fade-up, .fade-in');
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
  els.forEach(el => obs.observe(el));
}

// ── PARTICLES ─────────────────────────────
function createParticles() {
  const container = document.getElementById('heroParticles');
  for (let i = 0; i < 25; i++) {
    const p = document.createElement('div');
    p.className = 'hero-particle';
    p.style.cssText = `
      left: ${Math.random() * 100}%;
      animation-duration: ${8 + Math.random() * 12}s;
      animation-delay: ${Math.random() * 8}s;
      width: ${1 + Math.random() * 2}px;
      height: ${1 + Math.random() * 2}px;
      opacity: ${0.3 + Math.random() * 0.4};
    `;
    container.appendChild(p);
  }
}

// ── CERT LIGHTBOX ─────────────────────────
function setupCertLightbox() {
  const lb = document.getElementById('certLightbox');
  document.getElementById('lightboxClose').addEventListener('click', () => lb.classList.remove('active'));
  lb.addEventListener('click', e => { if (e.target === lb) lb.classList.remove('active'); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') lb.classList.remove('active'); });
}

function openCertLightbox(id, name, fileType) {
  if (fileType !== 'image') return;
  document.getElementById('lightboxImg').src = `/api/img/cert/${id}`;
  document.getElementById('lightboxImg').alt = name;
  document.getElementById('certLightbox').classList.add('active');
}

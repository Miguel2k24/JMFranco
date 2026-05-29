const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcryptjs');

// Auth middleware
const auth = (req, res, next) => {
  if (req.session && req.session.adminLoggedIn) return next();
  res.status(401).json({ success: false, error: 'No autorizado' });
};

// Multer storage — usa uploadBase de app.locals (soporta /tmp en Vercel)
function makeStorage(subdir, prefix) {
  return multer.diskStorage({
    destination(req, file, cb) {
      const base = req.app.locals.uploadBase || 'uploads';
      cb(null, path.join(base, subdir));
    },
    filename: (req, file, cb) => cb(null, `${prefix}-${Date.now()}${path.extname(file.originalname)}`)
  });
}

const uploadPhoto   = multer({ storage: makeStorage('photos',         'profile'), limits: { fileSize: 5  * 1024 * 1024 } });
const uploadProject = multer({ storage: makeStorage('projects',       'project'), limits: { fileSize: 10 * 1024 * 1024 } });
const uploadCert    = multer({ storage: makeStorage('certifications', 'cert'),    limits: { fileSize: 20 * 1024 * 1024 } });

// ── AUTH ──────────────────────────────────────────────────────────
router.post('/login', (req, res) => {
  const db = req.app.locals.db;
  const { username, password } = req.body;
  const admin = db.prepare('SELECT * FROM admin_user WHERE username = ?').get(username);
  if (admin && bcrypt.compareSync(password, admin.password)) {
    req.session.adminLoggedIn = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, error: 'Credenciales incorrectas' });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

router.get('/check', (req, res) => {
  res.json({ authenticated: !!(req.session && req.session.adminLoggedIn) });
});

// ── PROFILE ───────────────────────────────────────────────────────
router.get('/profile', auth, (req, res) => {
  const db = req.app.locals.db;
  res.json({ success: true, data: db.prepare('SELECT * FROM profile WHERE id = 1').get() });
});

router.put('/profile', auth, (req, res) => {
  const db = req.app.locals.db;
  const { name, title, bio, phone, email, location, linkedin, github, portfolio_url, whatsapp } = req.body;
  db.prepare('UPDATE profile SET name=?,title=?,bio=?,phone=?,email=?,location=?,linkedin=?,github=?,portfolio_url=?,whatsapp=? WHERE id=1')
    .run(name, title, bio, phone, email, location, linkedin, github, portfolio_url, whatsapp);
  res.json({ success: true });
});

// Guardar foto (base64 o URL) directamente en la DB
router.post('/profile/photo', auth, (req, res) => {
  const db = req.app.locals.db;
  const { data } = req.body; // base64 data URL
  if (!data) return res.status(400).json({ success: false, error: 'Sin imagen' });
  db.prepare('UPDATE profile SET photo=? WHERE id=1').run(data);
  res.json({ success: true, photo: data });
});

// ── SKILLS ────────────────────────────────────────────────────────
router.get('/skills', auth, (req, res) => {
  const db = req.app.locals.db;
  res.json({ success: true, data: db.prepare('SELECT * FROM skills ORDER BY order_index, id').all() });
});

router.post('/skills', auth, (req, res) => {
  const db = req.app.locals.db;
  const { name, category } = req.body;
  const r = db.prepare('INSERT INTO skills (name,category) VALUES (?,?)').run(name, category);
  res.json({ success: true, id: r.lastInsertRowid });
});

router.put('/skills/:id', auth, (req, res) => {
  const db = req.app.locals.db;
  const { name, category, visible } = req.body;
  db.prepare('UPDATE skills SET name=?,category=?,visible=? WHERE id=?').run(name, category, visible, req.params.id);
  res.json({ success: true });
});

router.delete('/skills/:id', auth, (req, res) => {
  const db = req.app.locals.db;
  db.prepare('DELETE FROM skills WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ── EXPERIENCES ───────────────────────────────────────────────────
router.get('/experiences', auth, (req, res) => {
  const db = req.app.locals.db;
  res.json({ success: true, data: db.prepare('SELECT * FROM experiences ORDER BY order_index, id DESC').all() });
});

router.post('/experiences', auth, (req, res) => {
  const db = req.app.locals.db;
  const { title, company, company_url, start_date, end_date, is_current, description } = req.body;
  const r = db.prepare('INSERT INTO experiences (title,company,company_url,start_date,end_date,is_current,description) VALUES (?,?,?,?,?,?,?)')
    .run(title, company, company_url, start_date, end_date, is_current ? 1 : 0, description);
  res.json({ success: true, id: r.lastInsertRowid });
});

router.put('/experiences/:id', auth, (req, res) => {
  const db = req.app.locals.db;
  const { title, company, company_url, start_date, end_date, is_current, description, visible } = req.body;
  db.prepare('UPDATE experiences SET title=?,company=?,company_url=?,start_date=?,end_date=?,is_current=?,description=?,visible=? WHERE id=?')
    .run(title, company, company_url, start_date, end_date, is_current ? 1 : 0, description, visible ?? 1, req.params.id);
  res.json({ success: true });
});

router.delete('/experiences/:id', auth, (req, res) => {
  const db = req.app.locals.db;
  db.prepare('DELETE FROM experiences WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ── EDUCATION ─────────────────────────────────────────────────────
router.get('/education', auth, (req, res) => {
  const db = req.app.locals.db;
  res.json({ success: true, data: db.prepare('SELECT * FROM education ORDER BY order_index, id').all() });
});

router.post('/education', auth, (req, res) => {
  const db = req.app.locals.db;
  const { degree, institution, year, status } = req.body;
  const r = db.prepare('INSERT INTO education (degree,institution,year,status) VALUES (?,?,?,?)').run(degree, institution, year, status);
  res.json({ success: true, id: r.lastInsertRowid });
});

router.put('/education/:id', auth, (req, res) => {
  const db = req.app.locals.db;
  const { degree, institution, year, status, visible } = req.body;
  db.prepare('UPDATE education SET degree=?,institution=?,year=?,status=?,visible=? WHERE id=?').run(degree, institution, year, status, visible ?? 1, req.params.id);
  res.json({ success: true });
});

router.delete('/education/:id', auth, (req, res) => {
  const db = req.app.locals.db;
  db.prepare('DELETE FROM education WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ── PROJECTS ──────────────────────────────────────────────────────
router.get('/projects', auth, (req, res) => {
  const db = req.app.locals.db;
  res.json({ success: true, data: db.prepare('SELECT * FROM projects ORDER BY order_index, id DESC').all() });
});

router.post('/projects', auth, (req, res) => {
  const db = req.app.locals.db;
  const { name, description, url, is_production, tags, image } = req.body;
  const r = db.prepare('INSERT INTO projects (name,description,url,image,is_production,tags) VALUES (?,?,?,?,?,?)')
    .run(name, description, url, image || null, is_production ? 1 : 0, tags);
  res.json({ success: true, id: r.lastInsertRowid });
});

router.put('/projects/:id', auth, (req, res) => {
  const db = req.app.locals.db;
  const { name, description, url, is_production, tags, visible, image } = req.body;
  const existing = db.prepare('SELECT image FROM projects WHERE id=?').get(req.params.id);
  const finalImage = image !== undefined ? (image || null) : (existing ? existing.image : null);
  db.prepare('UPDATE projects SET name=?,description=?,url=?,image=?,is_production=?,tags=?,visible=? WHERE id=?')
    .run(name, description, url, finalImage, is_production ? 1 : 0, tags, visible ?? 1, req.params.id);
  res.json({ success: true });
});

router.delete('/projects/:id', auth, (req, res) => {
  const db = req.app.locals.db;
  db.prepare('DELETE FROM projects WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ── CERTIFICATIONS ────────────────────────────────────────────────
router.get('/certifications', auth, (req, res) => {
  const db = req.app.locals.db;
  res.json({ success: true, data: db.prepare('SELECT * FROM certifications ORDER BY order_index, id').all() });
});

// Certificaciones: base64 guardado en DB (funciona en Vercel y local)
router.post('/certifications', auth, (req, res) => {
  const db = req.app.locals.db;
  const { name, institution, file_data, file_type } = req.body;
  if (!name) return res.status(400).json({ success: false, error: 'Nombre requerido' });
  if (!file_data) return res.status(400).json({ success: false, error: 'Archivo requerido' });
  const r = db.prepare('INSERT INTO certifications (name,institution,file_path,file_type) VALUES (?,?,?,?)')
    .run(name, institution, file_data, file_type || 'image');
  res.json({ success: true, id: r.lastInsertRowid });
});

router.put('/certifications/:id', auth, (req, res) => {
  const db = req.app.locals.db;
  const { name, institution, visible } = req.body;
  db.prepare('UPDATE certifications SET name=?,institution=?,visible=? WHERE id=?').run(name, institution, visible ?? 1, req.params.id);
  res.json({ success: true });
});

router.patch('/certifications/:id/toggle', auth, (req, res) => {
  const db = req.app.locals.db;
  const cert = db.prepare('SELECT visible FROM certifications WHERE id=?').get(req.params.id);
  if (!cert) return res.status(404).json({ success: false });
  const newVisible = cert.visible ? 0 : 1;
  db.prepare('UPDATE certifications SET visible=? WHERE id=?').run(newVisible, req.params.id);
  res.json({ success: true, visible: newVisible });
});

router.delete('/certifications/:id', auth, (req, res) => {
  const db = req.app.locals.db;
  db.prepare('DELETE FROM certifications WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ── REFERENCES ────────────────────────────────────────────────────
router.get('/references', auth, (req, res) => {
  const db = req.app.locals.db;
  res.json({
    success: true,
    data: {
      personal: db.prepare('SELECT * FROM refs_personal').all(),
      laboral: db.prepare('SELECT * FROM refs_laboral').all()
    }
  });
});

router.post('/references/personal', auth, (req, res) => {
  const db = req.app.locals.db;
  const { name, phone, relation } = req.body;
  const r = db.prepare('INSERT INTO refs_personal (name,phone,relation) VALUES (?,?,?)').run(name, phone, relation);
  res.json({ success: true, id: r.lastInsertRowid });
});

router.put('/references/personal/:id', auth, (req, res) => {
  const db = req.app.locals.db;
  const { name, phone, relation, visible } = req.body;
  db.prepare('UPDATE refs_personal SET name=?,phone=?,relation=?,visible=? WHERE id=?').run(name, phone, relation, visible ?? 1, req.params.id);
  res.json({ success: true });
});

router.delete('/references/personal/:id', auth, (req, res) => {
  const db = req.app.locals.db;
  db.prepare('DELETE FROM refs_personal WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

router.post('/references/laboral', auth, (req, res) => {
  const db = req.app.locals.db;
  const { name, phone, company } = req.body;
  const r = db.prepare('INSERT INTO refs_laboral (name,phone,company) VALUES (?,?,?)').run(name, phone, company);
  res.json({ success: true, id: r.lastInsertRowid });
});

router.put('/references/laboral/:id', auth, (req, res) => {
  const db = req.app.locals.db;
  const { name, phone, company, visible } = req.body;
  db.prepare('UPDATE refs_laboral SET name=?,phone=?,company=?,visible=? WHERE id=?').run(name, phone, company, visible ?? 1, req.params.id);
  res.json({ success: true });
});

router.delete('/references/laboral/:id', auth, (req, res) => {
  const db = req.app.locals.db;
  db.prepare('DELETE FROM refs_laboral WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ── PDF GENERATION ────────────────────────────────────────────────
router.get('/pdf/generate', auth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const includeCerts = req.query.includeCerts !== 'false';
    const { generatePDF } = require('../utils/pdfGenerator');

    const profile = db.prepare('SELECT * FROM profile WHERE id = 1').get();
    const skills = db.prepare('SELECT * FROM skills WHERE visible = 1 ORDER BY order_index, id').all();
    const experiences = db.prepare('SELECT * FROM experiences WHERE visible = 1 ORDER BY order_index, id DESC').all();
    const education = db.prepare('SELECT * FROM education WHERE visible = 1 ORDER BY order_index, id').all();
    const projects = db.prepare('SELECT * FROM projects WHERE visible = 1 ORDER BY is_production DESC, order_index, id').all();
    const certifications = includeCerts
      ? db.prepare('SELECT * FROM certifications WHERE visible = 1 ORDER BY order_index, id').all()
      : [];
    const refs_personal = db.prepare('SELECT * FROM refs_personal WHERE visible = 1').all();
    const refs_laboral = db.prepare('SELECT * FROM refs_laboral WHERE visible = 1').all();

    const data = { profile, skills, experiences, education, projects, certifications, refs_personal, refs_laboral };
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="CV-Jose-Miguel-Franco-Bonilla.pdf"');
    await generatePDF(data, res);
  } catch (err) {
    console.error('Error PDF:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── CHANGE PASSWORD ───────────────────────────────────────────────
router.put('/change-password', auth, (req, res) => {
  const db = req.app.locals.db;
  const { currentPassword, newPassword } = req.body;
  const admin = db.prepare('SELECT * FROM admin_user WHERE id = 1').get();
  if (!bcrypt.compareSync(currentPassword, admin.password)) {
    return res.status(400).json({ success: false, error: 'Contraseña actual incorrecta' });
  }
  db.prepare('UPDATE admin_user SET password=? WHERE id=1').run(bcrypt.hashSync(newPassword, 10));
  res.json({ success: true });
});

module.exports = router;

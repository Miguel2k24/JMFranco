const express = require('express');
const router = express.Router();

// Límite para imágenes inline en la respuesta pública (200KB en base64 ≈ 150KB imagen)
const IMG_INLINE_LIMIT = 200 * 1024;

// Si la imagen es base64 muy grande, devuelve una URL especial para cargarla por separado
function compactImg(img, id, type) {
  if (!img) return null;
  if (img.startsWith('data:') && img.length > IMG_INLINE_LIMIT) {
    return `/api/img/${type}/${id}`; // cargada lazy
  }
  return img;
}

router.get('/portfolio', (req, res) => {
  try {
    const db = req.app.locals.db;
    const profile = db.prepare('SELECT * FROM profile WHERE id = 1').get();
    const skills = db.prepare('SELECT * FROM skills WHERE visible = 1 ORDER BY order_index, id').all();
    const experiences = db.prepare('SELECT * FROM experiences WHERE visible = 1 ORDER BY order_index, id DESC').all();
    const education = db.prepare('SELECT * FROM education WHERE visible = 1 ORDER BY order_index, id').all();
    const projects = db.prepare('SELECT * FROM projects WHERE visible = 1 ORDER BY order_index, id DESC').all();
    const certifications = db.prepare('SELECT id, name, institution, file_type, visible, order_index FROM certifications WHERE visible = 1 ORDER BY order_index, id').all();
    const refs_personal = db.prepare('SELECT * FROM refs_personal WHERE visible = 1').all();
    const refs_laboral = db.prepare('SELECT * FROM refs_laboral WHERE visible = 1').all();

    // Optimizar imágenes grandes para no bloquear la carga inicial
    if (profile && profile.photo) {
      profile.photo = compactImg(profile.photo, 1, 'profile');
    }
    projects.forEach(p => {
      p.image = compactImg(p.image, p.id, 'project');
    });

    res.json({ success: true, data: { profile, skills, experiences, education, projects, certifications, refs_personal, refs_laboral } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Ruta lazy para cargar imágenes grandes
router.get('/img/profile/:id', (req, res) => {
  try {
    const db = req.app.locals.db;
    const row = db.prepare('SELECT photo FROM profile WHERE id = ?').get(req.params.id);
    if (!row || !row.photo) return res.status(404).send('Not found');
    if (row.photo.startsWith('data:')) {
      const [header, data] = row.photo.split(',');
      const mime = header.replace('data:', '').replace(';base64', '');
      res.setHeader('Content-Type', mime);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(Buffer.from(data, 'base64'));
    } else {
      res.redirect(row.photo);
    }
  } catch (err) { res.status(500).send('Error'); }
});

router.get('/img/project/:id', (req, res) => {
  try {
    const db = req.app.locals.db;
    const row = db.prepare('SELECT image FROM projects WHERE id = ?').get(req.params.id);
    if (!row || !row.image) return res.status(404).send('Not found');
    if (row.image.startsWith('data:')) {
      const [header, data] = row.image.split(',');
      const mime = header.replace('data:', '').replace(';base64', '');
      res.setHeader('Content-Type', mime);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(Buffer.from(data, 'base64'));
    } else {
      res.redirect(row.image);
    }
  } catch (err) { res.status(500).send('Error'); }
});

// Imagen de certificación (para el lightbox)
router.get('/img/cert/:id', (req, res) => {
  try {
    const db = req.app.locals.db;
    const row = db.prepare('SELECT file_path, file_type FROM certifications WHERE id = ?').get(req.params.id);
    if (!row || !row.file_path) return res.status(404).send('Not found');
    if (row.file_path.startsWith('data:')) {
      const [header, data] = row.file_path.split(',');
      const mime = header.replace('data:', '').replace(';base64', '');
      res.setHeader('Content-Type', mime);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(Buffer.from(data, 'base64'));
    } else {
      res.redirect(row.file_path);
    }
  } catch (err) { res.status(500).send('Error'); }
});

module.exports = router;

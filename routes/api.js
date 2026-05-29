const express = require('express');
const router = express.Router();

router.get('/portfolio', (req, res) => {
  try {
    const db = req.app.locals.db;
    const profile = db.prepare('SELECT * FROM profile WHERE id = 1').get();
    const skills = db.prepare('SELECT * FROM skills WHERE visible = 1 ORDER BY order_index, id').all();
    const experiences = db.prepare('SELECT * FROM experiences WHERE visible = 1 ORDER BY order_index, id DESC').all();
    const education = db.prepare('SELECT * FROM education WHERE visible = 1 ORDER BY order_index, id').all();
    const projects = db.prepare('SELECT * FROM projects WHERE visible = 1 ORDER BY order_index, id DESC').all();
    const certifications = db.prepare('SELECT * FROM certifications WHERE visible = 1 ORDER BY order_index, id').all();
    const refs_personal = db.prepare('SELECT * FROM refs_personal WHERE visible = 1').all();
    const refs_laboral = db.prepare('SELECT * FROM refs_laboral WHERE visible = 1').all();

    res.json({ success: true, data: { profile, skills, experiences, education, projects, certifications, refs_personal, refs_laboral } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

const express = require('express');
const session = require('express-session');
const path    = require('path');
const fs      = require('fs');
const { initDB } = require('./database/init');

const app      = express();
const PORT     = process.env.PORT || 3000;
const IS_VERCEL = !!process.env.VERCEL;

// Base de uploads: /tmp en Vercel (efímero), uploads/ en local
const UPLOAD_BASE = IS_VERCEL
  ? '/tmp'
  : path.join(__dirname, 'uploads');

// Crear subdirectorios de upload
['photos', 'projects', 'certifications'].forEach(sub => {
  const dir = path.join(UPLOAD_BASE, sub);
  try { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); } catch (_) {}
});

app.locals.uploadBase = UPLOAD_BASE;
app.locals.isVercel   = IS_VERCEL;

/* ── MIDDLEWARE ───────────────────────────────────────────────── */
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Servir uploads desde /tmp en Vercel o desde /uploads local
if (IS_VERCEL) {
  app.use('/uploads', (req, res) => {
    const file = path.join('/tmp', req.path);
    if (fs.existsSync(file)) res.sendFile(file);
    else res.status(404).send('Not found');
  });
} else {
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
}

app.use(session({
  secret: process.env.SESSION_SECRET || 'portfolio_secret_jose_miguel_2024_xK9#mL',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: IS_VERCEL,          // HTTPS en producción
    sameSite: IS_VERCEL ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
  }
}));

/* ── ESPERAR A QUE LA DB ESTÉ LISTA ──────────────────────────── */
let dbReady = false;
const dbPromise = initDB().then(db => {
  app.locals.db = db;
  dbReady = true;
}).catch(err => {
  console.error('Error iniciando DB:', err);
});

app.use((req, res, next) => {
  if (dbReady) return next();
  dbPromise.then(next).catch(() =>
    res.status(503).json({ error: 'Servicio iniciando, intenta de nuevo en unos segundos' })
  );
});

/* ── RUTAS ────────────────────────────────────────────────────── */
app.use('/api',       require('./routes/api'));
app.use('/api/admin', require('./routes/admin'));

app.get('/admin', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'admin.html'))
);
app.get('*', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
);

/* ── ARRANQUE LOCAL ───────────────────────────────────────────── */
if (!IS_VERCEL && require.main === module) {
  dbPromise.then(() => {
    app.listen(PORT, () => {
      console.log('\n╔══════════════════════════════════════╗');
      console.log('║   🚀 PORTFOLIO JOSE MIGUEL ACTIVO   ║');
      console.log('╠══════════════════════════════════════╣');
      console.log(`║  🌐 Portfolio: http://localhost:${PORT}   ║`);
      console.log(`║  ⚙️  Admin:    http://localhost:${PORT}/admin║`);
      console.log('╠══════════════════════════════════════╣');
      console.log('║  👤 Usuario:  admin                  ║');
      console.log('║  🔑 Password: admin123               ║');
      console.log('╚══════════════════════════════════════╝\n');
    });
  }).catch(err => { console.error('Fatal:', err); process.exit(1); });
}

/* ── EXPORT PARA VERCEL ───────────────────────────────────────── */
module.exports = app;

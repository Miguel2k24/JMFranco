const PDFDocument = require('pdfkit');
const fs   = require('fs');
const path = require('path');

/* ══════════════════════════════════════════════════════════════════
   SANITIZACIÓN - solo caracteres Latin-1 (0x20–0xFF) que Helvetica/Arial
   puede representar. Caracteres fuera de rango → eliminados.
══════════════════════════════════════════════════════════════════ */
function san(v) {
  if (!v) return '';
  return String(v)
    .replace(/[''`]/g,  "'")
    .replace(/[""“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[•‣⁌⁍]/g, '-')
    // Elimina todo caracter cuyo código sea > 0xFF
    .replace(/[Ā-￿]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/* ══════════════════════════════════════════════════════════════════
   fitLine — calcula con métricas reales la cantidad de caracteres
   que caben en `maxW` puntos. Garantiza que doc.text() nunca supera
   el ancho. ESTA ES LA CLAVE: no hay overflow posible.
══════════════════════════════════════════════════════════════════ */
function fitLine(doc, str, maxW) {
  const s = san(str);
  if (!s) return '';
  // Si entra completo, retornamos directo
  if (doc.widthOfString(s) <= maxW) return s;
  // Búsqueda binaria para el corte exacto
  let lo = 0, hi = s.length;
  while (lo < hi - 1) {
    const mid = Math.floor((lo + hi) / 2);
    const test = s.slice(0, mid) + '...';
    if (doc.widthOfString(test) <= maxW) lo = mid;
    else hi = mid;
  }
  return lo > 0 ? s.slice(0, lo) + '...' : '';
}

/* ══════════════════════════════════════════════════════════════════
   Dibuja UNA LÍNEA de texto. Sin overflow, sin wrapping, sin magia.
══════════════════════════════════════════════════════════════════ */
function line(doc, str, x, y, maxW, font, size, color) {
  doc.font(font).fontSize(size);
  const s = fitLine(doc, str, maxW);
  if (!s) return;
  doc.fillColor(color).text(s, x, y, { lineBreak: false });
}

/* ══════════════════════════════════════════════════════════════════
   Dibuja un BLOQUE de texto multi-línea con altura máxima fija.
   Usa clip + estimación de chars para garantizar que no desborda.
══════════════════════════════════════════════════════════════════ */
function block(doc, str, x, y, maxW, maxH, font, size, color) {
  doc.font(font).fontSize(size);
  const lineH    = size * 1.35;
  const maxLines = Math.max(1, Math.floor(maxH / lineH));
  // Estima chars por línea con la fuente actual
  const avgCW  = doc.widthOfString('abcdefghijklmnopqrstuvwxyz') / 26;
  const cpl    = Math.floor(maxW / avgCW);
  const maxCh  = cpl * maxLines;
  const raw    = san(str);
  const s = raw.length <= maxCh ? raw : raw.slice(0, maxCh - 3).replace(/\s\S*$/, '') + '...';
  if (!s) return;
  // Doble protección: clip region sobre el área del bloque
  doc.save();
  doc.rect(x, y, maxW, maxH + 2).clip();
  doc.fillColor(color).text(s, x, y, { width: maxW, lineBreak: true, lineGap: 0.8 });
  doc.restore();
}

/* ══════════════════════════════════════════════════════════════════
   FUENTES — Arial (Windows) si existe, si no Helvetica
══════════════════════════════════════════════════════════════════ */
function loadFonts(doc) {
  const rr = ['C:\\Windows\\Fonts\\arial.ttf',   'C:\\Windows\\Fonts\\ARIAL.TTF'];
  const bb = ['C:\\Windows\\Fonts\\arialbd.ttf', 'C:\\Windows\\Fonts\\ARIALBD.TTF'];
  for (const r of rr) {
    if (!fs.existsSync(r)) continue;
    try {
      doc.registerFont('R', r);
      for (const b of bb) { if (fs.existsSync(b)) { doc.registerFont('B', b); break; } }
      return { R: 'R', B: 'B' };
    } catch (_) {}
  }
  return { R: 'Helvetica', B: 'Helvetica-Bold' };
}

/* ══════════════════════════════════════════════════════════════════
   PALETA
══════════════════════════════════════════════════════════════════ */
const K = {
  side:   [13,  19,  33],
  blue:   [0,   102, 255],
  cyan:   [0,   212, 255],
  white:  [255, 255, 255],
  dark:   [20,  20,  40],
  gray:   [74,  85,  104],
  silver: [113, 128, 150],
  rule:   [220, 228, 240],
  pale:   [235, 245, 255],
  cream:  [247, 250, 252],
  fog:    [176, 196, 222],
  tagBg:  [18,  48,  88],
};

/* ══════════════════════════════════════════════════════════════════
   TARJETA DE PROYECTO — altura FIJA, texto NUNCA desborda
══════════════════════════════════════════════════════════════════ */
function drawCard(doc, proj, px, py, pw, ch, f) {
  // Fondo
  doc.rect(px, py, pw, ch).fill(K.pale);
  doc.rect(px, py, 3, ch).fill(K.blue);

  const iw = pw - 10; // ancho interior

  // Nombre (1 línea)
  doc.font(f.B).fontSize(7.8);
  line(doc, proj.name, px + 6, py + 4, iw, f.B, 7.8, K.dark);

  // Descripción (1 línea — fitLine garantiza que nunca desborde)
  doc.font(f.R).fontSize(6.2);
  line(doc, proj.description, px + 6, py + 15, iw, f.R, 6.2, K.gray);

  // URL (1 línea)
  if (proj.url) {
    const u = san(proj.url).replace(/^https?:\/\//, '');
    line(doc, u, px + 6, py + 24, iw, f.R, 5.8, K.blue);
  }
}

/* ══════════════════════════════════════════════════════════════════
   ENCABEZADOS
══════════════════════════════════════════════════════════════════ */
function sHdr(doc, label, y, sw, f) {
  doc.font(f.B).fontSize(6.5).fillColor(K.cyan)
    .text(label, 12, y, { lineBreak: false });
  y += 9;
  doc.rect(12, y, sw - 24, 0.5).fill(K.blue);
  return y + 6;
}

function mHdr(doc, label, y, x, w, f) {
  doc.font(f.B).fontSize(8).fillColor(K.blue)
    .text(label, x, y, { lineBreak: false });
  y += 12;
  doc.rect(x, y, w, 0.5).fill(K.rule);
  return y + 5;
}

/* ══════════════════════════════════════════════════════════════════
   GENERADOR PRINCIPAL
══════════════════════════════════════════════════════════════════ */
async function generatePDF(data, out) {
  const { profile, skills, experiences, education,
          projects, certifications, refs_personal, refs_laboral } = data;

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    autoFirstPage: true,
    bufferPages: true,
    compress: false,
  });
  doc.pipe(out);

  const f = loadFonts(doc);

  const PW = 595.28, PH = 841.89;
  const SW = 182,    MX = SW + 15, MW = PW - MX - 18;
  const YMAX = PH - 20;
  const GAP  = 5;

  /* ── FONDOS ─────────────────────────────────────────────────── */
  doc.rect(0, 0, SW, PH).fill(K.side);
  doc.rect(SW - 2, 0, 2, PH).fill(K.blue);
  doc.rect(SW, 0, PW - SW, PH).fill(K.white);

  /* ── FOTO ────────────────────────────────────────────────────── */
  const PR = 50, PCX = SW / 2, PCY = 60;
  const pp = profile.photo ? path.join(process.cwd(), profile.photo) : null;
  if (pp && fs.existsSync(pp)) {
    doc.save();
    doc.circle(PCX, PCY, PR).clip();
    doc.image(pp, PCX - PR, PCY - PR, { width: PR * 2, height: PR * 2 });
    doc.restore();
  } else {
    doc.circle(PCX, PCY, PR).fill([18, 40, 78]);
    doc.font(f.B).fontSize(22).fillColor(K.cyan)
      .text('JM', PCX - PR, PCY - 14, { width: PR * 2, align: 'center', lineBreak: false });
  }
  doc.circle(PCX, PCY, PR + 1.5).lineWidth(1.5).strokeColor(K.cyan).stroke();

  /* ── SIDEBAR ────────────────────────────────────────────────── */
  let sy = PCY + PR + 10;

  // Nombre
  const sw = san(profile.name || 'Jose Miguel Franco Bonilla').split(' ');
  const sh = Math.ceil(sw.length / 2);
  doc.font(f.B).fontSize(9).fillColor(K.white)
    .text(sw.slice(0, sh).join(' '), 8, sy, { width: SW - 16, align: 'center', lineBreak: false });
  sy += 11;
  doc.font(f.B).fontSize(9).fillColor(K.cyan)
    .text(sw.slice(sh).join(' '), 8, sy, { width: SW - 16, align: 'center', lineBreak: false });
  sy += 16;

  // CONTACTO
  sy = sHdr(doc, 'CONTACTO', sy, SW, f);
  const cw = SW - 26;
  [profile.phone, profile.email, profile.location,
   profile.linkedin, profile.github].filter(Boolean).forEach(c => {
    doc.font(f.R).fontSize(6.5);
    line(doc, c, 12, sy, cw, f.R, 6.5, K.fog);
    sy += 11;
  });
  sy += 5;

  // TECNOLOGIAS
  sy = sHdr(doc, 'TECNOLOGIAS', sy, SW, f);
  const byCat = {};
  skills.forEach(s => {
    if (!byCat[s.category]) byCat[s.category] = [];
    byCat[s.category].push(san(s.name));
  });
  Object.entries(byCat).forEach(([cat, names]) => {
    doc.font(f.B).fontSize(6).fillColor(K.cyan)
      .text(san(cat).toUpperCase(), 12, sy, { lineBreak: false });
    sy += 9;
    let tx = 12, ty = sy;
    names.forEach(nm => {
      const tw = Math.min(nm.length * 4.7 + 8, SW - 26);
      if (tx + tw > SW - 8) { tx = 12; ty += 12; }
      doc.rect(tx, ty - 1, tw, 10).fill(K.tagBg);
      doc.font(f.R).fontSize(5.8);
      const label = fitLine(doc, nm, tw - 6);
      doc.fillColor(K.cyan).text(label, tx + 3, ty + 1, { lineBreak: false });
      tx += tw + 3;
    });
    sy = ty + 13;
  });
  sy += 4;

  // REFS PERSONALES
  if (refs_personal.length > 0) {
    sy = sHdr(doc, 'REFS. PERSONALES', sy, SW, f);
    refs_personal.forEach(r => {
      line(doc, r.name,  12, sy, SW - 26, f.B, 7,   K.white); sy += 9;
      if (r.phone) { line(doc, r.phone, 12, sy, SW - 26, f.R, 6.5, K.fog); sy += 10; }
    });
    sy += 4;
  }

  // IDIOMAS (rellena el sidebar)
  if (sy < PH - 120) {
    sy = sHdr(doc, 'IDIOMAS', sy, SW, f);
    [['Espanol', 'Nativo'], ['Ingles', 'Basico']].forEach(([lg, lv]) => {
      doc.font(f.B).fontSize(7).fillColor(K.white).text(lg, 12, sy, { lineBreak: false });
      const lgW = doc.widthOfString(lg);
      doc.font(f.R).fontSize(6.5).fillColor(K.fog)
        .text('  -  ' + lv, 12 + lgW, sy, { lineBreak: false });
      sy += 11;
    });
    sy += 6;
  }

  // Pie decorativo sidebar
  doc.rect(12, PH - 32, SW - 24, 0.5).fill(K.blue);
  doc.font(f.R).fontSize(6).fillColor(K.cyan)
    .text('Fullstack Developer', 8, PH - 24,
      { width: SW - 16, align: 'center', lineBreak: false });

  /* ── CONTENIDO PRINCIPAL ────────────────────────────────────── */
  let my = 24;

  // Nombre bicolor
  const mn  = san(profile.name || 'Jose Miguel Franco Bonilla').split(' ');
  const mh  = Math.ceil(mn.length / 2);
  const np1 = mn.slice(0, mh).join(' ');
  const np2 = mn.slice(mh).join(' ');
  doc.font(f.B).fontSize(20).fillColor(K.dark)
    .text(np1 + ' ', MX, my, { continued: true, lineBreak: false });
  doc.fillColor(K.blue).text(np2, { lineBreak: false });
  my += 23;

  // Titulo
  if (profile.title) {
    line(doc, profile.title, MX, my, MW, f.R, 7.5, K.gray);
    my += 13;
  }

  // Línea divisora
  doc.rect(MX, my, MW, 1.5).fill(K.blue);
  my += 9;

  /* PERFIL PROFESIONAL */
  if (profile.bio && my < YMAX - 60) {
    my = mHdr(doc, 'PERFIL PROFESIONAL', my, MX, MW, f);
    block(doc, profile.bio, MX, my, MW, 40, f.R, 7.8, K.gray);
    my += 44;
  }

  /* EXPERIENCIA LABORAL */
  if (experiences.length > 0 && my < YMAX - 35) {
    my = mHdr(doc, 'EXPERIENCIA LABORAL', my, MX, MW, f);
    for (const e of experiences) {
      if (my > YMAX - 35) break;
      doc.circle(MX + 4, my + 5, 3.5).fill(K.blue);
      line(doc, e.title,   MX + 13, my, MW - 13, f.B, 8.5, K.dark);   my += 11;
      if (e.company) {
        line(doc, e.company, MX + 13, my, MW - 13, f.R, 7.5, K.blue); my += 9;
      }
      const dates = e.is_current
        ? (e.start_date ? san(e.start_date) + ' - Presente' : 'Presente')
        : [san(e.start_date), san(e.end_date)].filter(Boolean).join(' - ');
      if (dates) {
        line(doc, dates, MX + 13, my, MW - 13, f.R, 6.8, K.silver);   my += 9;
      }
      if (e.description) {
        block(doc, e.description, MX + 13, my, MW - 13, 18, f.R, 7.5, K.gray);
        my += 21;
      }
      my += 4;
    }
  }

  /* FORMACION ACADEMICA */
  if (education.length > 0 && my < YMAX - 25) {
    my = mHdr(doc, 'FORMACION ACADEMICA', my, MX, MW, f);
    for (const e of education) {
      if (my > YMAX - 22) break;
      doc.circle(MX + 4, my + 5, 3.5).fill(K.cyan);
      line(doc, e.degree, MX + 13, my, MW - 13, f.B, 8, K.dark);   my += 11;
      const sub = [san(e.institution), san(e.status)].filter(Boolean).join(' - ');
      if (sub) { line(doc, sub, MX + 13, my, MW - 13, f.R, 7.5, K.blue); my += 11; }
    }
  }

  /* PROYECTOS EN PRODUCCION */
  const prodProjs = projects.filter(p => p.is_production);
  if (prodProjs.length > 0 && my < YMAX - 40) {
    my = mHdr(doc, 'PROYECTOS EN PRODUCCION', my, MX, MW, f);
    const CH = 32, pW = (MW - GAP) / 2;
    let px = MX, py = my, col = 0;

    prodProjs.slice(0, 8).forEach(proj => {
      if (py + CH > YMAX - 8) return;
      drawCard(doc, proj, px, py, pW, CH, f);
      col++;
      if (col % 2 === 0) { py += CH + GAP; px = MX; }
      else               { px = MX + pW + GAP; }
    });

    if (col % 2 === 1) py += CH + GAP;
    my = py + 4;
  }

  /* REFERENCIAS LABORALES */
  if (refs_laboral.length > 0 && my < YMAX - 38) {
    my = mHdr(doc, 'REFERENCIAS LABORALES', my, MX, MW, f);
    const rl = refs_laboral.slice(0, 3);
    const rw = (MW - GAP * (rl.length - 1)) / rl.length;
    let rx = MX;
    rl.forEach(r => {
      doc.rect(rx, my, rw, 30).fill(K.cream);
      doc.rect(rx, my, 3, 30).fill(K.cyan);
      line(doc, r.name,    rx + 6, my + 4,  rw - 10, f.B, 7.5, K.dark);
      if (r.company) line(doc, r.company, rx + 6, my + 14, rw - 10, f.R, 6.5, K.blue);
      if (r.phone)   line(doc, r.phone,   rx + 6, my + 22, rw - 10, f.R, 6.5, K.gray);
      rx += rw + GAP;
    });
    my += 34;
  }

  /* Pie de página */
  const today = new Date().toLocaleDateString('es', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
  doc.rect(MX, YMAX - 10, MW, 0.5).fill(K.rule);
  doc.font(f.R).fontSize(6).fillColor(K.silver)
    .text('CV generado el ' + today, MX, YMAX - 6,
      { width: MW, align: 'right', lineBreak: false });

  /* ── PÁGINAS DE CERTIFICACIONES ─────────────────────────────── */
  for (const cert of certifications) {
    doc.addPage({ size: 'A4', margins: { top: 0, bottom: 0, left: 0, right: 0 } });
    doc.rect(0, 0, PW, 54).fill(K.side);
    doc.rect(0, 54, PW, 2).fill(K.blue);

    doc.font(f.B).fontSize(11).fillColor(K.white)
      .text('CERTIFICACION', 40, 10,
        { width: PW - 80, align: 'center', lineBreak: false });
    doc.font(f.B).fontSize(10);
    const certTitle = fitLine(doc, cert.name, PW - 80);
    doc.fillColor(K.cyan).text(certTitle, 40, 26,
      { width: PW - 80, align: 'center', lineBreak: false });
    if (cert.institution) {
      doc.font(f.R).fontSize(7.5);
      const instLine = fitLine(doc, cert.institution, PW - 80);
      doc.fillColor(K.fog).text(instLine, 40, 42,
        { width: PW - 80, align: 'center', lineBreak: false });
    }

    if (cert.file_type === 'image' && cert.file_path) {
      const cp = path.join(process.cwd(), cert.file_path);
      if (fs.existsSync(cp)) {
        try {
          doc.image(cp, 25, 62, { fit: [PW - 50, PH - 85], align: 'center', valign: 'center' });
        } catch (_) {}
      }
    } else {
      doc.font(f.R).fontSize(13).fillColor(K.gray)
        .text('[Certificado PDF adjunto]', 40, PH / 2,
          { width: PW - 80, align: 'center' });
    }

    doc.rect(0, PH - 20, PW, 20).fill(K.side);
    doc.font(f.R).fontSize(6.5);
    const footerLine = fitLine(doc,
      san(profile.name || 'Jose Miguel Franco Bonilla') + ' - Certificaciones',
      PW - 40);
    doc.fillColor(K.fog).text(footerLine, 20, PH - 13,
      { width: PW - 40, align: 'center', lineBreak: false });
  }

  doc.end();
}

module.exports = { generatePDF };

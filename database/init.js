const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'portfolio.db');

let _db = null;
let _initialized = false;

// Convierte resultado sql.js a array de objetos
function toObjects(results) {
  if (!results || !results.length) return [];
  const { columns, values } = results[0];
  return values.map(row => {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
}

// Persiste la base de datos en disco
function save() {
  try {
    const data = _db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  } catch (e) {
    console.error('Error guardando DB:', e.message);
  }
}

// API compatible con better-sqlite3
function createInterface(sqljs) {
  if (fs.existsSync(DB_PATH)) {
    _db = new sqljs.Database(fs.readFileSync(DB_PATH));
  } else {
    _db = new sqljs.Database();
  }

  const iface = {
    _raw: _db,

    exec(sql) {
      _db.run(sql);
      save();
    },

    pragma(stmt) {
      try { _db.run(`PRAGMA ${stmt}`); } catch(e) {}
    },

    prepare(sql) {
      return {
        get(...args) {
          const params = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
          try {
            const stmt = _db.prepare(sql);
            stmt.bind(params);
            if (stmt.step()) {
              const row = stmt.getAsObject();
              stmt.free();
              return row;
            }
            stmt.free();
            return undefined;
          } catch(e) { return undefined; }
        },

        all(...args) {
          const params = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
          try {
            const results = _db.exec(sql, params);
            return toObjects(results);
          } catch(e) { return []; }
        },

        run(...args) {
          const params = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
          try {
            _db.run(sql, params);
            const lastId = toObjects(_db.exec('SELECT last_insert_rowid() as id'))[0]?.id || 0;
            save();
            return { lastInsertRowid: lastId, changes: _db.getRowsModified() };
          } catch(e) {
            console.error('DB run error:', e.message, sql);
            throw e;
          }
        }
      };
    }
  };

  return iface;
}

async function initDB() {
  if (_initialized) return _db.iface;
  const SQL = await initSqlJs();
  const iface = createInterface(SQL);
  _db.iface = iface;

  iface.exec(`
    CREATE TABLE IF NOT EXISTS profile (
      id INTEGER PRIMARY KEY DEFAULT 1,
      name TEXT NOT NULL DEFAULT 'Jose Miguel Franco Bonilla',
      title TEXT DEFAULT 'Ing. en Sistemas Computacionales · Desarrollador Fullstack · Soporte Técnico',
      bio TEXT,
      photo TEXT,
      phone TEXT,
      email TEXT,
      location TEXT,
      linkedin TEXT,
      github TEXT,
      portfolio_url TEXT,
      whatsapp TEXT
    );
    CREATE TABLE IF NOT EXISTS skills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT DEFAULT 'General',
      visible INTEGER DEFAULT 1,
      order_index INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS experiences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      company TEXT,
      company_url TEXT,
      start_date TEXT,
      end_date TEXT,
      is_current INTEGER DEFAULT 0,
      description TEXT,
      visible INTEGER DEFAULT 1,
      order_index INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS education (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      degree TEXT NOT NULL,
      institution TEXT,
      year TEXT,
      status TEXT DEFAULT 'Certificado',
      visible INTEGER DEFAULT 1,
      order_index INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      url TEXT,
      image TEXT,
      is_production INTEGER DEFAULT 0,
      tags TEXT,
      visible INTEGER DEFAULT 1,
      order_index INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS certifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      institution TEXT,
      file_path TEXT,
      file_type TEXT DEFAULT 'image',
      visible INTEGER DEFAULT 1,
      order_index INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS refs_personal (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      relation TEXT,
      visible INTEGER DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS refs_laboral (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      company TEXT,
      visible INTEGER DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS admin_user (
      id INTEGER PRIMARY KEY DEFAULT 1,
      username TEXT DEFAULT 'admin',
      password TEXT NOT NULL
    );
  `);

  seedData(iface);
  _initialized = true;
  return iface;
}

function seedData(db) {
  const profileExists = db.prepare('SELECT id FROM profile WHERE id = 1').get();
  if (!profileExists) {
    db.prepare(`INSERT INTO profile (id,name,title,bio,phone,email,location) VALUES (1,?,?,?,?,?,?)`)
      .run(
        'Jose Miguel Franco Bonilla',
        'Ing. en Sistemas Computacionales · Desarrollador Fullstack · Soporte Técnico',
        'Estudiante de Ingeniería en Sistemas Computacionales con experiencia en desarrollo web fullstack y soporte técnico. Extrovertido, proactivo y orientado al aprendizaje continuo. Busco aportar soluciones tecnológicas de impacto donde pueda seguir creciendo profesionalmente.',
        '+1 (809) 434-8735',
        'francobonillajosemiguel@gmail.com',
        'Santo Domingo, RD'
      );
  }

  const sc = db.prepare('SELECT COUNT(*) as c FROM skills').get();
  if (!sc || sc.c == 0) {
    const skills = [
      ['JavaScript','Frontend'],['TypeScript','Frontend'],['Next.js','Frontend'],
      ['Angular','Frontend'],['HTML5 / CSS3','Frontend'],
      ['Node.js','Backend'],['Nest.js','Backend'],['C# / ASP.NET','Backend'],
      ['SQL Server','Base de Datos'],['PostgreSQL','Base de Datos']
    ];
    skills.forEach(([n,c]) => db.prepare('INSERT INTO skills (name,category) VALUES (?,?)').run(n,c));
  }

  const ec = db.prepare('SELECT COUNT(*) as c FROM experiences').get();
  if (!ec || ec.c == 0) {
    db.prepare('INSERT INTO experiences (title,company,start_date,end_date,is_current,description) VALUES (?,?,?,?,?,?)')
      .run('Técnico de Aires Acondicionados','Airconditioning — Proyecto Propio',null,null,1,'Instalación, mantenimiento y reparación de sistemas de climatización residenciales y comerciales.');
    db.prepare('INSERT INTO experiences (title,company,start_date,end_date,is_current,description) VALUES (?,?,?,?,?,?)')
      .run('Soporte Técnico de Software y Hardware','Motocentro LM','16/03/2023','16/10/2024',0,'Soporte técnico de software y hardware · Encargado de taller · Auxiliar de repuestos.');
  }

  const eduC = db.prepare('SELECT COUNT(*) as c FROM education').get();
  if (!eduC || eduC.c == 0) {
    const edus = [
      ['Ing. en Sistemas Computacionales / Informática','UTESA',null,'En curso'],
      ['Desarrollador Fullstack Intermedio','Talento Digital',null,'Certificado'],
      ['Programación FrontEnd G3 · Base de Datos SQL Server','Alura Latam + Oracle NEXT Education',null,'Certificado'],
      ['Servicio al Cliente · Gestión de Calidad','INFOTEP',null,'Certificado'],
      ['Bachillerato','Fernando Alberto Defillo',null,'Completado']
    ];
    edus.forEach(([d,i,y,s]) => db.prepare('INSERT INTO education (degree,institution,year,status) VALUES (?,?,?,?)').run(d,i,y,s));
  }

  const pc = db.prepare('SELECT COUNT(*) as c FROM projects').get();
  if (!pc || pc.c == 0) {
    const projs = [
      ['App de Tareas','Gestión de tareas con interfaz moderna y funcionalidades CRUD completas','https://sage-pixie-6fa007.netlify.app',1],
      ['Fast Food','Plataforma de pedidos de comida rápida con carrito de compras','https://fast-food-wheat.vercel.app',1],
      ['Centro de Comidas','Sistema de gestión de menú y servicios para restaurante','https://eloquent-marzipan-2ce7d7.netlify.app',1],
      ['Encriptado de Mensajes','Herramienta de cifrado de texto seguro con interfaz intuitiva','https://dynamic-dusk-be4011.netlify.app',1],
      ['Apeperia','Sitio web de planes y servicios con diseño moderno','https://serene-treacle-02be50.netlify.app',1]
    ];
    projs.forEach(([n,d,u,p]) => db.prepare('INSERT INTO projects (name,description,url,is_production) VALUES (?,?,?,?)').run(n,d,u,p));
  }

  const rpc = db.prepare('SELECT COUNT(*) as c FROM refs_personal').get();
  if (!rpc || rpc.c == 0) {
    db.prepare('INSERT INTO refs_personal (name,phone) VALUES (?,?)').run('Jeisci Salcedo','(809) 749-5309');
    db.prepare('INSERT INTO refs_personal (name,phone) VALUES (?,?)').run('Javier Romero','(829) 763-0547');
  }

  const rlc = db.prepare('SELECT COUNT(*) as c FROM refs_laboral').get();
  if (!rlc || rlc.c == 0) {
    db.prepare('INSERT INTO refs_laboral (name,company) VALUES (?,?)').run('Motocentro LM','Motocentro LM');
    db.prepare('INSERT INTO refs_laboral (name,phone,company) VALUES (?,?,?)').run('Vladimir Almonte','(829) 715-1829','Motocentro LM');
    db.prepare('INSERT INTO refs_laboral (name,phone,company) VALUES (?,?,?)').run('Mairenys Walters','(809) 495-0536','Motocentro LM');
  }

  const adminEx = db.prepare('SELECT id FROM admin_user WHERE id = 1').get();
  if (!adminEx) {
    db.prepare('INSERT INTO admin_user (id,username,password) VALUES (1,?,?)').run('admin', bcrypt.hashSync('admin123',10));
  }
}

module.exports = { initDB };

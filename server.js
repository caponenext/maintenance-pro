/**
 * Maintenance Pro V4 - Server Completo
 * Gestione Manutenzioni Industriale con Allarmi, Foto, Notifiche
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const sharp = require('sharp');
const cors = require('cors');
const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');
const XLSX = require('xlsx');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'maintenance-pro-secret-key-v4';

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));

// Assicurati che le directory esistano
const uploadsDir = path.join(__dirname, 'public', 'uploads');
const photosDir = path.join(uploadsDir, 'photos');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(photosDir)) fs.mkdirSync(photosDir, { recursive: true });

// Database SQLite
const db = new Database('maintenance.db');
db.pragma('journal_mode = WAL');

// ============================================
// INIZIALIZZAZIONE DATABASE
// ============================================

function initDatabase() {
  // Aziende
  db.exec(`
    CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT,
      phone TEXT,
      email TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Stabilimenti
  db.exec(`
    CREATE TABLE IF NOT EXISTS plants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER,
      name TEXT NOT NULL,
      location TEXT,
      manager_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (company_id) REFERENCES companies(id)
    )
  `);

  // Reparti
  db.exec(`
    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plant_id INTEGER,
      name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (plant_id) REFERENCES plants(id)
    )
  `);

  // Categorie macchine
  db.exec(`
    CREATE TABLE IF NOT EXISTS machine_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Macchine
  db.exec(`
    CREATE TABLE IF NOT EXISTS machines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category_id INTEGER,
      plant_id INTEGER,
      department_id INTEGER,
      serial_number TEXT,
      manufacturer TEXT,
      model TEXT,
      year INTEGER,
      location TEXT,
      status TEXT DEFAULT 'OK' CHECK(status IN ('OK', 'DA_TESTARE', 'NON_FUNZIONANTE')),
      notes TEXT,
      qr_code TEXT UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES machine_categories(id),
      FOREIGN KEY (plant_id) REFERENCES plants(id),
      FOREIGN KEY (department_id) REFERENCES departments(id)
    )
  `);

  // Tipi manutenzione
  db.exec(`
    CREATE TABLE IF NOT EXISTS maintenance_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      frequency_days INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Utenti
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'technician' CHECK(role IN ('admin', 'technician', 'manager')),
      plant_id INTEGER,
      phone TEXT,
      signature_image TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (plant_id) REFERENCES plants(id)
    )
  `);

  // Registro manutenzioni
  db.exec(`
    CREATE TABLE IF NOT EXISTS maintenance_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      machine_id INTEGER NOT NULL,
      maintenance_type_id INTEGER,
      type TEXT CHECK(type IN ('ordinary', 'scheduled', 'emergency')),
      scheduled_date DATE,
      executed_date DATE,
      technician_id INTEGER,
      start_time TIME,
      end_time TIME,
      work_hours REAL,
      description TEXT NOT NULL,
      parts_used TEXT,
      status TEXT DEFAULT 'completed' CHECK(status IN ('pending', 'in_progress', 'completed', 'cancelled')),
      notes TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (machine_id) REFERENCES machines(id),
      FOREIGN KEY (maintenance_type_id) REFERENCES maintenance_types(id),
      FOREIGN KEY (technician_id) REFERENCES users(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  // Foto manutenzioni
  db.exec(`
    CREATE TABLE IF NOT EXISTS maintenance_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      maintenance_id INTEGER NOT NULL,
      photo_type TEXT CHECK(photo_type IN ('before', 'after', 'during', 'detail')),
      file_path TEXT NOT NULL,
      thumbnail_path TEXT,
      notes TEXT,
      taken_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (maintenance_id) REFERENCES maintenance_records(id) ON DELETE CASCADE
    )
  `);

  // Scadenze manutenzioni
  db.exec(`
    CREATE TABLE IF NOT EXISTS maintenance_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      machine_id INTEGER NOT NULL,
      maintenance_type_id INTEGER,
      last_execution DATE,
      next_execution DATE NOT NULL,
      frequency_days INTEGER NOT NULL,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'paused', 'completed')),
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (machine_id) REFERENCES machines(id),
      FOREIGN KEY (maintenance_type_id) REFERENCES maintenance_types(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  // Allarmi/Notifiche
  db.exec(`
    CREATE TABLE IF NOT EXISTS maintenance_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      machine_id INTEGER,
      schedule_id INTEGER,
      alert_type TEXT CHECK(alert_type IN ('due_soon', 'overdue', 'emergency')),
      scheduled_date DATE,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'sent', 'acknowledged', 'resolved')),
      priority TEXT DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'urgent')),
      notified_at DATETIME,
      resolved_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (machine_id) REFERENCES machines(id),
      FOREIGN KEY (schedule_id) REFERENCES maintenance_schedules(id)
    )
  `);

  // Impostazioni email
  db.exec(`
    CREATE TABLE IF NOT EXISTS email_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      smtp_host TEXT,
      smtp_port INTEGER DEFAULT 587,
      smtp_user TEXT,
      smtp_pass TEXT,
      smtp_from TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Inserisci dati di default
  const defaultCompany = db.prepare('SELECT id FROM companies LIMIT 1').get();
  if (!defaultCompany) {
    db.prepare('INSERT INTO companies (name) VALUES (?)').run('Azienda Default');
  }

  const defaultPlant = db.prepare('SELECT id FROM plants LIMIT 1').get();
  if (!defaultPlant) {
    const company = db.prepare('SELECT id FROM companies LIMIT 1').get();
    db.prepare('INSERT INTO plants (company_id, name) VALUES (?, ?)')
      .run(company.id, 'Stabilimento Principale');
  }

  const defaultUser = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@maintenance.pro');
  if (!defaultUser) {
    const hashedPassword = bcrypt.hashSync('admin', 10);
    db.prepare(`
      INSERT INTO users (name, email, password, role) 
      VALUES (?, ?, ?, ?)
    `).run('Amministratore', 'admin@maintenance.pro', hashedPassword, 'admin');
  }

  const defaultTypes = db.prepare('SELECT id FROM maintenance_types LIMIT 1').get();
  if (!defaultTypes) {
    const types = [
      { name: 'Manutenzione Ordinaria', frequency_days: 30 },
      { name: 'Manutenzione Programmata', frequency_days: 90 },
      { name: 'Controllo Periodico', frequency_days: 7 },
      { name: 'Sostituzione Ricambi', frequency_days: 180 }
    ];
    const stmt = db.prepare('INSERT INTO maintenance_types (name, frequency_days) VALUES (?, ?)');
    types.forEach(t => stmt.run(t.name, t.frequency_days));
  }

  console.log('Database inizializzato con successo');
}

initDatabase();

// ============================================
// MIDDLEWARE AUTENTICAZIONE
// ============================================

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token mancante' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token non valido' });
    }
    req.user = user;
    next();
  });
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accesso riservato agli amministratori' });
  }
  next();
}

// ============================================
// CONFIGURAZIONE UPLOAD FOTO
// ============================================

const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo file immagine sono permessi'));
    }
  }
});

// ============================================
// API AUTHENTICAZIONE
// ============================================

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  const user = db.prepare('SELECT * FROM users WHERE email = ? AND is_active = 1').get(email);
  if (!user) {
    return res.status(401).json({ error: 'Credenziali non valide' });
  }

  const validPassword = bcrypt.compareSync(password, user.password);
  if (!validPassword) {
    return res.status(401).json({ error: 'Credenziali non valide' });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name, plant_id: user.plant_id },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      plant_id: user.plant_id
    }
  });
});

app.get('/api/verify-token', authenticateToken, (req, res) => {
  res.json({ valid: true, user: req.user });
});

// ============================================
// API UTENTI
// ============================================

app.get('/api/users', authenticateToken, (req, res) => {
  const users = db.prepare(`
    SELECT u.id, u.name, u.email, u.role, u.phone, u.is_active, 
           u.created_at, p.name as plant_name
    FROM users u
    LEFT JOIN plants p ON u.plant_id = p.id
    ORDER BY u.name
  `).all();
  res.json(users);
});

app.post('/api/users', authenticateToken, requireAdmin, (req, res) => {
  const { name, email, password, role, plant_id, phone } = req.body;

  try {
    const hashedPassword = bcrypt.hashSync(password, 10);
    const result = db.prepare(`
      INSERT INTO users (name, email, password, role, plant_id, phone)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(name, email, hashedPassword, role, plant_id, phone);

    res.status(201).json({ id: result.lastInsertRowid, message: 'Utente creato' });
  } catch (err) {
    res.status(400).json({ error: 'Email già esistente' });
  }
});

app.put('/api/users/:id', authenticateToken, requireAdmin, (req, res) => {
  const { name, email, role, plant_id, phone, is_active } = req.body;

  db.prepare(`
    UPDATE users SET name = ?, email = ?, role = ?, plant_id = ?, phone = ?, is_active = ?
    WHERE id = ?
  `).run(name, email, role, plant_id, phone, is_active, req.params.id);

  res.json({ message: 'Utente aggiornato' });
});

app.put('/api/users/:id/reset-password', authenticateToken, requireAdmin, (req, res) => {
  const { password } = req.body;
  const hashedPassword = bcrypt.hashSync(password, 10);

  db.prepare('UPDATE users SET password = ? WHERE id = ?')
    .run(hashedPassword, req.params.id);

  res.json({ message: 'Password aggiornata' });
});

// ============================================
// API STABILIMENTI
// ============================================

app.get('/api/plants', authenticateToken, (req, res) => {
  const plants = db.prepare(`
    SELECT p.*, c.name as company_name,
           (SELECT COUNT(*) FROM machines WHERE plant_id = p.id) as machine_count
    FROM plants p
    JOIN companies c ON p.company_id = c.id
    ORDER BY p.name
  `).all();
  res.json(plants);
});

app.post('/api/plants', authenticateToken, requireAdmin, (req, res) => {
  const { company_id, name, location, manager_name } = req.body;
  const result = db.prepare(`
    INSERT INTO plants (company_id, name, location, manager_name)
    VALUES (?, ?, ?, ?)
  `).run(company_id, name, location, manager_name);

  res.status(201).json({ id: result.lastInsertRowid });
});

// ============================================
// API REPARTI
// ============================================

app.get('/api/departments', authenticateToken, (req, res) => {
  const { plant_id } = req.query;
  let query = `
    SELECT d.*, p.name as plant_name
    FROM departments d
    JOIN plants p ON d.plant_id = p.id
  `;
  const params = [];
  
  if (plant_id) {
    query += ' WHERE d.plant_id = ?';
    params.push(plant_id);
  }
  
  query += ' ORDER BY d.name';
  
  const departments = db.prepare(query).all(...params);
  res.json(departments);
});

app.post('/api/departments', authenticateToken, requireAdmin, (req, res) => {
  const { plant_id, name, description } = req.body;
  const result = db.prepare(`
    INSERT INTO departments (plant_id, name, description)
    VALUES (?, ?, ?)
  `).run(plant_id, name, description);

  res.status(201).json({ id: result.lastInsertRowid });
});

// ============================================
// API CATEGORIE MACCHINE
// ============================================

app.get('/api/machine-categories', authenticateToken, (req, res) => {
  const categories = db.prepare('SELECT * FROM machine_categories ORDER BY name').all();
  res.json(categories);
});

app.post('/api/machine-categories', authenticateToken, requireAdmin, (req, res) => {
  const { name, description } = req.body;
  const result = db.prepare(`
    INSERT INTO machine_categories (name, description)
    VALUES (?, ?)
  `).run(name, description);

  res.status(201).json({ id: result.lastInsertRowid });
});

// ============================================
// API MACCHINE
// ============================================

app.get('/api/machines', authenticateToken, (req, res) => {
  const { plant_id, status, search } = req.query;
  
  let query = `
    SELECT m.*, 
           mc.name as category_name,
           p.name as plant_name,
           d.name as department_name,
           (SELECT COUNT(*) FROM maintenance_records WHERE machine_id = m.id) as maintenance_count,
           (SELECT MAX(executed_date) FROM maintenance_records WHERE machine_id = m.id) as last_maintenance
    FROM machines m
    LEFT JOIN machine_categories mc ON m.category_id = mc.id
    LEFT JOIN plants p ON m.plant_id = p.id
    LEFT JOIN departments d ON m.department_id = d.id
    WHERE 1=1
  `;
  const params = [];

  if (plant_id) {
    query += ' AND m.plant_id = ?';
    params.push(plant_id);
  }
  if (status) {
    query += ' AND m.status = ?';
    params.push(status);
  }
  if (search) {
    query += ' AND (m.name LIKE ? OR m.code LIKE ? OR m.serial_number LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  query += ' ORDER BY m.code';

  const machines = db.prepare(query).all(...params);
  res.json(machines);
});

app.get('/api/machines/:id', authenticateToken, (req, res) => {
  const machine = db.prepare(`
    SELECT m.*, 
           mc.name as category_name,
           p.name as plant_name,
           d.name as department_name
    FROM machines m
    LEFT JOIN machine_categories mc ON m.category_id = mc.id
    LEFT JOIN plants p ON m.plant_id = p.id
    LEFT JOIN departments d ON m.department_id = d.id
    WHERE m.id = ?
  `).get(req.params.id);

  if (!machine) {
    return res.status(404).json({ error: 'Macchina non trovata' });
  }

  res.json(machine);
});

app.post('/api/machines', authenticateToken, requireAdmin, (req, res) => {
  const {
    code, name, category_id, plant_id, department_id,
    serial_number, manufacturer, model, year, location, notes
  } = req.body;

  const qr_code = uuidv4();

  try {
    const result = db.prepare(`
      INSERT INTO machines 
      (code, name, category_id, plant_id, department_id, serial_number, 
       manufacturer, model, year, location, notes, qr_code)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(code, name, category_id, plant_id, department_id, serial_number,
           manufacturer, model, year, location, notes, qr_code);

    res.status(201).json({ id: result.lastInsertRowid, qr_code });
  } catch (err) {
    res.status(400).json({ error: 'Codice macchina già esistente' });
  }
});

app.put('/api/machines/:id', authenticateToken, requireAdmin, (req, res) => {
  const {
    code, name, category_id, plant_id, department_id,
    serial_number, manufacturer, model, year, location, status, notes
  } = req.body;

  db.prepare(`
    UPDATE machines SET
      code = ?, name = ?, category_id = ?, plant_id = ?, department_id = ?,
      serial_number = ?, manufacturer = ?, model = ?, year = ?, 
      location = ?, status = ?, notes = ?
    WHERE id = ?
  `).run(code, name, category_id, plant_id, department_id,
         serial_number, manufacturer, model, year,
         location, status, notes, req.params.id);

  res.json({ message: 'Macchina aggiornata' });
});

app.delete('/api/machines/:id', authenticateToken, requireAdmin, (req, res) => {
  db.prepare('DELETE FROM machines WHERE id = ?').run(req.params.id);
  res.json({ message: 'Macchina eliminata' });
});

// ============================================
// API MANUTENZIONI
// ============================================

app.get('/api/maintenance', authenticateToken, (req, res) => {
  const { machine_id, technician_id, type, limit = 100 } = req.query;
  
  let query = `
    SELECT mr.*,
           m.code as machine_code, m.name as machine_name,
           u.name as technician_name,
           mt.name as maintenance_type_name
    FROM maintenance_records mr
    JOIN machines m ON mr.machine_id = m.id
    LEFT JOIN users u ON mr.technician_id = u.id
    LEFT JOIN maintenance_types mt ON mr.maintenance_type_id = mt.id
    WHERE 1=1
  `;
  const params = [];

  if (machine_id) {
    query += ' AND mr.machine_id = ?';
    params.push(machine_id);
  }
  if (technician_id) {
    query += ' AND mr.technician_id = ?';
    params.push(technician_id);
  }
  if (type) {
    query += ' AND mr.type = ?';
    params.push(type);
  }

  query += ' ORDER BY mr.executed_date DESC, mr.created_at DESC LIMIT ?';
  params.push(parseInt(limit));

  const records = db.prepare(query).all(...params);
  res.json(records);
});

app.get('/api/maintenance/:id', authenticateToken, (req, res) => {
  const record = db.prepare(`
    SELECT mr.*,
           m.code as machine_code, m.name as machine_name,
           u.name as technician_name,
           mt.name as maintenance_type_name
    FROM maintenance_records mr
    JOIN machines m ON mr.machine_id = m.id
    LEFT JOIN users u ON mr.technician_id = u.id
    LEFT JOIN maintenance_types mt ON mr.maintenance_type_id = mt.id
    WHERE mr.id = ?
  `).get(req.params.id);

  if (!record) {
    return res.status(404).json({ error: 'Manutenzione non trovata' });
  }

  // Recupera anche le foto
  const photos = db.prepare(`
    SELECT * FROM maintenance_photos WHERE maintenance_id = ?
  `).all(req.params.id);

  res.json({ ...record, photos });
});

app.post('/api/maintenance', authenticateToken, (req, res) => {
  const {
    machine_id, maintenance_type_id, type, scheduled_date,
    executed_date, technician_id, start_time, end_time,
    description, parts_used, notes
  } = req.body;

  // Calcola ore lavorate
  let work_hours = 0;
  if (start_time && end_time) {
    const start = new Date(`2000-01-01T${start_time}`);
    const end = new Date(`2000-01-01T${end_time}`);
    work_hours = (end - start) / (1000 * 60 * 60);
    if (work_hours < 0) work_hours += 24; // Gestisce turno notturno
  }

  const result = db.prepare(`
    INSERT INTO maintenance_records 
    (machine_id, maintenance_type_id, type, scheduled_date, executed_date,
     technician_id, start_time, end_time, work_hours, description, parts_used, 
     notes, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(machine_id, maintenance_type_id, type, scheduled_date, executed_date,
         technician_id || req.user.id, start_time, end_time, work_hours,
         description, parts_used, notes, req.user.id);

  // Aggiorna ultima manutenzione nella scheda macchina
  if (executed_date) {
    db.prepare('UPDATE machines SET status = ? WHERE id = ?').run('OK', machine_id);
  }

  // Aggiorna schedule se presente
  if (maintenance_type_id) {
    const schedule = db.prepare(`
      SELECT * FROM maintenance_schedules 
      WHERE machine_id = ? AND maintenance_type_id = ?
    `).get(machine_id, maintenance_type_id);

    if (schedule) {
      const nextDate = new Date(executed_date || new Date());
      nextDate.setDate(nextDate.getDate() + schedule.frequency_days);
      
      db.prepare(`
        UPDATE maintenance_schedules 
        SET last_execution = ?, next_execution = ?
        WHERE id = ?
      `).run(executed_date || new Date().toISOString().split('T')[0], 
             nextDate.toISOString().split('T')[0], schedule.id);
    }
  }

  res.status(201).json({ 
    id: result.lastInsertRowid, 
    work_hours,
    message: 'Manutenzione registrata' 
  });
});

app.put('/api/maintenance/:id', authenticateToken, (req, res) => {
  const {
    machine_id, maintenance_type_id, type, scheduled_date,
    executed_date, technician_id, start_time, end_time,
    description, parts_used, notes, status
  } = req.body;

  let work_hours = 0;
  if (start_time && end_time) {
    const start = new Date(`2000-01-01T${start_time}`);
    const end = new Date(`2000-01-01T${end_time}`);
    work_hours = (end - start) / (1000 * 60 * 60);
    if (work_hours < 0) work_hours += 24;
  }

  db.prepare(`
    UPDATE maintenance_records SET
      machine_id = ?, maintenance_type_id = ?, type = ?, scheduled_date = ?,
      executed_date = ?, technician_id = ?, start_time = ?, end_time = ?,
      work_hours = ?, description = ?, parts_used = ?, notes = ?, status = ?
    WHERE id = ?
  `).run(machine_id, maintenance_type_id, type, scheduled_date,
         executed_date, technician_id, start_time, end_time,
         work_hours, description, parts_used, notes, status, req.params.id);

  res.json({ message: 'Manutenzione aggiornata' });
});

app.delete('/api/maintenance/:id', authenticateToken, requireAdmin, (req, res) => {
  db.prepare('DELETE FROM maintenance_records WHERE id = ?').run(req.params.id);
  res.json({ message: 'Manutenzione eliminata' });
});

// ============================================
// API FOTO
// ============================================

app.post('/api/maintenance/:id/photos', authenticateToken, upload.single('photo'), async (req, res) => {
  try {
    const { photo_type, notes } = req.body;
    const maintenance_id = req.params.id;

    if (!req.file) {
      return res.status(400).json({ error: 'Nessuna foto caricata' });
    }

    // Genera nomi file univoci
    const filename = `${uuidv4()}.jpg`;
    const thumbnailName = `${uuidv4()}_thumb.jpg`;
    const filepath = path.join(photosDir, filename);
    const thumbnailPath = path.join(photosDir, thumbnailName);

    // Comprimi e salva immagine
    await sharp(req.file.buffer)
      .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toFile(filepath);

    // Crea thumbnail
    await sharp(req.file.buffer)
      .resize(300, 300, { fit: 'cover' })
      .jpeg({ quality: 70 })
      .toFile(thumbnailPath);

    // Salva nel database
    const result = db.prepare(`
      INSERT INTO maintenance_photos (maintenance_id, photo_type, file_path, thumbnail_path, notes)
      VALUES (?, ?, ?, ?, ?)
    `).run(maintenance_id, photo_type, `/uploads/photos/${filename}`, `/uploads/photos/${thumbnailName}`, notes);

    res.status(201).json({
      id: result.lastInsertRowid,
      file_path: `/uploads/photos/${filename}`,
      thumbnail_path: `/uploads/photos/${thumbnailName}`
    });
  } catch (err) {
    console.error('Errore upload foto:', err);
    res.status(500).json({ error: 'Errore durante il caricamento della foto' });
  }
});

app.get('/api/maintenance/:id/photos', authenticateToken, (req, res) => {
  const photos = db.prepare(`
    SELECT * FROM maintenance_photos WHERE maintenance_id = ?
  `).all(req.params.id);

  res.json(photos);
});

app.delete('/api/photos/:id', authenticateToken, requireAdmin, (req, res) => {
  const photo = db.prepare('SELECT * FROM maintenance_photos WHERE id = ?').get(req.params.id);
  
  if (photo) {
    // Elimina file fisici
    const filepath = path.join(__dirname, 'public', photo.file_path);
    const thumbpath = path.join(__dirname, 'public', photo.thumbnail_path);
    
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    if (fs.existsSync(thumbpath)) fs.unlinkSync(thumbpath);
    
    db.prepare('DELETE FROM maintenance_photos WHERE id = ?').run(req.params.id);
  }

  res.json({ message: 'Foto eliminata' });
});

// ============================================
// API SCHEDULE/SCADENZE
// ============================================

app.get('/api/schedules', authenticateToken, (req, res) => {
  const { plant_id, overdue } = req.query;
  
  let query = `
    SELECT ms.*,
           m.code as machine_code, m.name as machine_name,
           mt.name as maintenance_type_name,
           p.name as plant_name,
           julianday(ms.next_execution) - julianday('now') as days_until
    FROM maintenance_schedules ms
    JOIN machines m ON ms.machine_id = m.id
    JOIN maintenance_types mt ON ms.maintenance_type_id = mt.id
    JOIN plants p ON m.plant_id = p.id
    WHERE ms.status = 'active'
  `;
  const params = [];

  if (plant_id) {
    query += ' AND m.plant_id = ?';
    params.push(plant_id);
  }
  if (overdue === 'true') {
    query += ' AND ms.next_execution < date("now")';
  }

  query += ' ORDER BY ms.next_execution';

  const schedules = db.prepare(query).all(...params);
  res.json(schedules);
});

app.post('/api/schedules', authenticateToken, (req, res) => {
  const { machine_id, maintenance_type_id, next_execution, frequency_days } = req.body;

  const result = db.prepare(`
    INSERT INTO maintenance_schedules 
    (machine_id, maintenance_type_id, next_execution, frequency_days, created_by)
    VALUES (?, ?, ?, ?, ?)
  `).run(machine_id, maintenance_type_id, next_execution, frequency_days, req.user.id);

  res.status(201).json({ id: result.lastInsertRowid });
});

// ============================================
// API ALLARMI/NOTIFICHE
// ============================================

app.get('/api/alerts', authenticateToken, (req, res) => {
  const { status, priority } = req.query;
  
  let query = `
    SELECT ma.*,
           m.code as machine_code, m.name as machine_name,
           p.name as plant_name
    FROM maintenance_alerts ma
    JOIN machines m ON ma.machine_id = m.id
    JOIN plants p ON m.plant_id = p.id
    WHERE 1=1
  `;
  const params = [];

  if (status) {
    query += ' AND ma.status = ?';
    params.push(status);
  }
  if (priority) {
    query += ' AND ma.priority = ?';
    params.push(priority);
  }

  query += ' ORDER BY ma.created_at DESC';

  const alerts = db.prepare(query).all(...params);
  res.json(alerts);
});

app.get('/api/alerts/dashboard', authenticateToken, (req, res) => {
  // Allarmi per dashboard - scadenze prossime e scadute
  const alerts = db.prepare(`
    SELECT 
      'overdue' as alert_type,
      m.id as machine_id,
      m.code as machine_code,
      m.name as machine_name,
      p.name as plant_name,
      ms.next_execution as due_date,
      mt.name as maintenance_type_name,
      julianday('now') - julianday(ms.next_execution) as days_overdue,
      'urgent' as priority
    FROM maintenance_schedules ms
    JOIN machines m ON ms.machine_id = m.id
    JOIN maintenance_types mt ON ms.maintenance_type_id = mt.id
    JOIN plants p ON m.plant_id = p.id
    WHERE ms.status = 'active' AND ms.next_execution < date('now')
    
    UNION ALL
    
    SELECT 
      'due_soon' as alert_type,
      m.id as machine_id,
      m.code as machine_code,
      m.name as machine_name,
      p.name as plant_name,
      ms.next_execution as due_date,
      mt.name as maintenance_type_name,
      julianday(ms.next_execution) - julianday('now') as days_overdue,
      CASE 
        WHEN julianday(ms.next_execution) - julianday('now') <= 3 THEN 'high'
        WHEN julianday(ms.next_execution) - julianday('now') <= 7 THEN 'medium'
        ELSE 'low'
      END as priority
    FROM maintenance_schedules ms
    JOIN machines m ON ms.machine_id = m.id
    JOIN maintenance_types mt ON ms.maintenance_type_id = mt.id
    JOIN plants p ON m.plant_id = p.id
    WHERE ms.status = 'active' 
      AND ms.next_execution >= date('now')
      AND ms.next_execution <= date('now', '+7 days')
    
    ORDER BY due_date
  `).all();

  res.json(alerts);
});

app.put('/api/alerts/:id/acknowledge', authenticateToken, (req, res) => {
  db.prepare(`
    UPDATE maintenance_alerts 
    SET status = 'acknowledged', resolved_at = datetime('now')
    WHERE id = ?
  `).run(req.params.id);

  res.json({ message: 'Allarme confermato' });
});

// ============================================
// API STATISTICHE
// ============================================

app.get('/api/stats', authenticateToken, (req, res) => {
  const { plant_id, period = '30' } = req.query;
  const days = parseInt(period);

  // Statistiche base
  const stats = {};

  // Conteggio macchine
  let machineQuery = 'SELECT COUNT(*) as count FROM machines WHERE 1=1';
  if (plant_id) machineQuery += ` AND plant_id = ${plant_id}`;
  stats.totalMachines = db.prepare(machineQuery).get().count;

  // Macchine per stato
  stats.machinesByStatus = db.prepare(`
    SELECT status, COUNT(*) as count 
    FROM machines 
    ${plant_id ? 'WHERE plant_id = ?' : ''}
    GROUP BY status
  `).all(plant_id || []).reduce((acc, row) => {
    acc[row.status] = row.count;
    return acc;
  }, {});

  // Manutenzioni totali
  let maintQuery = `
    SELECT COUNT(*) as count, SUM(work_hours) as total_hours
    FROM maintenance_records mr
    JOIN machines m ON mr.machine_id = m.id
    WHERE mr.executed_date >= date('now', '-${days} days')
  `;
  if (plant_id) maintQuery += ` AND m.plant_id = ${plant_id}`;
  const maintStats = db.prepare(maintQuery).get();
  stats.totalMaintenance = maintStats.count;
  stats.totalWorkHours = maintStats.total_hours || 0;

  // Manutenzioni per tipo
  stats.maintenanceByType = db.prepare(`
    SELECT mr.type, COUNT(*) as count
    FROM maintenance_records mr
    JOIN machines m ON mr.machine_id = m.id
    WHERE mr.executed_date >= date('now', '-${days} days')
    ${plant_id ? 'AND m.plant_id = ?' : ''}
    GROUP BY mr.type
  `).all(plant_id || []).reduce((acc, row) => {
    acc[row.type] = row.count;
    return acc;
  }, {});

  // Ore lavorate per tecnico
  stats.hoursByTechnician = db.prepare(`
    SELECT u.name, SUM(mr.work_hours) as hours, COUNT(*) as interventions
    FROM maintenance_records mr
    JOIN users u ON mr.technician_id = u.id
    JOIN machines m ON mr.machine_id = m.id
    WHERE mr.executed_date >= date('now', '-${days} days')
    ${plant_id ? 'AND m.plant_id = ?' : ''}
    GROUP BY u.id
    ORDER BY hours DESC
  `).all(plant_id || []);

  // Scadenze in arrivo
  stats.upcomingDeadlines = db.prepare(`
    SELECT COUNT(*) as count
    FROM maintenance_schedules ms
    JOIN machines m ON ms.machine_id = m.id
    WHERE ms.status = 'active'
      AND ms.next_execution <= date('now', '+7 days')
      ${plant_id ? 'AND m.plant_id = ?' : ''}
  `).get(plant_id || []).count;

  // Scadenze scadute
  stats.overdueDeadlines = db.prepare(`
    SELECT COUNT(*) as count
    FROM maintenance_schedules ms
    JOIN machines m ON ms.machine_id = m.id
    WHERE ms.status = 'active'
      AND ms.next_execution < date('now')
      ${plant_id ? 'AND m.plant_id = ?' : ''}
  `).get(plant_id || []).count;

  res.json(stats);
});

// ============================================
// API EMAIL
// ============================================

app.get('/api/email-settings', authenticateToken, requireAdmin, (req, res) => {
  const settings = db.prepare('SELECT * FROM email_settings LIMIT 1').get();
  res.json(settings || {});
});

app.put('/api/email-settings', authenticateToken, requireAdmin, (req, res) => {
  const { smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from } = req.body;

  const existing = db.prepare('SELECT id FROM email_settings LIMIT 1').get();
  
  if (existing) {
    db.prepare(`
      UPDATE email_settings 
      SET smtp_host = ?, smtp_port = ?, smtp_user = ?, smtp_pass = ?, smtp_from = ?
      WHERE id = ?
    `).run(smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from, existing.id);
  } else {
    db.prepare(`
      INSERT INTO email_settings (smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from)
      VALUES (?, ?, ?, ?, ?)
    `).run(smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from);
  }

  res.json({ message: 'Impostazioni email salvate' });
});

app.post('/api/send-report', authenticateToken, async (req, res) => {
  const { to, subject, message, maintenance_id } = req.body;

  const settings = db.prepare('SELECT * FROM email_settings LIMIT 1').get();
  if (!settings || !settings.smtp_host) {
    return res.status(400).json({ error: 'Impostazioni email non configurate' });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: settings.smtp_host,
      port: settings.smtp_port || 587,
      secure: false,
      auth: {
        user: settings.smtp_user,
        pass: settings.smtp_pass
      }
    });

    // Recupera dati manutenzione
    const maintenance = db.prepare(`
      SELECT mr.*, m.code as machine_code, m.name as machine_name,
             u.name as technician_name
      FROM maintenance_records mr
      JOIN machines m ON mr.machine_id = m.id
      LEFT JOIN users u ON mr.technician_id = u.id
      WHERE mr.id = ?
    `).get(maintenance_id);

    const photos = db.prepare('SELECT * FROM maintenance_photos WHERE maintenance_id = ?')
      .all(maintenance_id);

    // Costruisci HTML email
    const html = `
      <h2>Report Manutenzione #${maintenance_id}</h2>
      <p><strong>Macchina:</strong> ${maintenance.machine_code} - ${maintenance.machine_name}</p>
      <p><strong>Data:</strong> ${maintenance.executed_date}</p>
      <p><strong>Tecnico:</strong> ${maintenance.technician_name}</p>
      <p><strong>Ore lavorate:</strong> ${maintenance.work_hours}</p>
      <p><strong>Descrizione:</strong></p>
      <p>${maintenance.description}</p>
      ${maintenance.parts_used ? `<p><strong>Ricambi utilizzati:</strong> ${maintenance.parts_used}</p>` : ''}
      ${message ? `<p><strong>Note aggiuntive:</strong> ${message}</p>` : ''}
      <p>Inviato da: ${req.user.name} (${req.user.email})</p>
    `;

    const mailOptions = {
      from: settings.smtp_from,
      to,
      subject: subject || `Report Manutenzione - ${maintenance.machine_name}`,
      html,
      attachments: photos.map(p => ({
        filename: path.basename(p.file_path),
        path: path.join(__dirname, 'public', p.file_path)
      }))
    };

    await transporter.sendMail(mailOptions);
    res.json({ message: 'Email inviata con successo' });
  } catch (err) {
    console.error('Errore invio email:', err);
    res.status(500).json({ error: 'Errore durante l\'invio dell\'email' });
  }
});

// ============================================
// API EXPORT
// ============================================

app.get('/api/export/maintenance', authenticateToken, (req, res) => {
  const { start_date, end_date, plant_id } = req.query;

  let query = `
    SELECT 
      mr.executed_date as 'Data',
      m.code as 'Codice Macchina',
      m.name as 'Nome Macchina',
      p.name as 'Stabilimento',
      mr.type as 'Tipo',
      u.name as 'Tecnico',
      mr.start_time as 'Ora Inizio',
      mr.end_time as 'Ora Fine',
      mr.work_hours as 'Ore Lavorate',
      mr.description as 'Descrizione',
      mr.parts_used as 'Ricambi Utilizzati',
      mr.notes as 'Note'
    FROM maintenance_records mr
    JOIN machines m ON mr.machine_id = m.id
    JOIN plants p ON m.plant_id = p.id
    LEFT JOIN users u ON mr.technician_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (start_date) {
    query += ' AND mr.executed_date >= ?';
    params.push(start_date);
  }
  if (end_date) {
    query += ' AND mr.executed_date <= ?';
    params.push(end_date);
  }
  if (plant_id) {
    query += ' AND m.plant_id = ?';
    params.push(plant_id);
  }

  query += ' ORDER BY mr.executed_date DESC';

  const data = db.prepare(query).all(...params);

  // Crea workbook Excel
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Manutenzioni');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=manutenzioni.xlsx');
  res.send(buffer);
});

// ============================================
// CRON JOB - VERIFICA SCADENZE
// ============================================

function checkDeadlines() {
  console.log('Verifica scadenze manutenzioni...');

  // Trova scadenze scadute
  const overdue = db.prepare(`
    SELECT ms.*, m.code as machine_code, m.name as machine_name
    FROM maintenance_schedules ms
    JOIN machines m ON ms.machine_id = m.id
    WHERE ms.status = 'active'
      AND ms.next_execution < date('now')
      AND NOT EXISTS (
        SELECT 1 FROM maintenance_alerts ma 
        WHERE ma.schedule_id = ms.id 
        AND ma.status IN ('pending', 'sent')
        AND ma.alert_type = 'overdue'
      )
  `).all();

  overdue.forEach(item => {
    db.prepare(`
      INSERT INTO maintenance_alerts 
      (machine_id, schedule_id, alert_type, scheduled_date, priority)
      VALUES (?, ?, 'overdue', ?, 'urgent')
    `).run(item.machine_id, item.id, item.next_execution);
  });

  // Trova scadenze in arrivo (prossimi 3 giorni)
  const dueSoon = db.prepare(`
    SELECT ms.*, m.code as machine_code, m.name as machine_name
    FROM maintenance_schedules ms
    JOIN machines m ON ms.machine_id = m.id
    WHERE ms.status = 'active'
      AND ms.next_execution BETWEEN date('now') AND date('now', '+3 days')
      AND NOT EXISTS (
        SELECT 1 FROM maintenance_alerts ma 
        WHERE ma.schedule_id = ms.id 
        AND ma.status IN ('pending', 'sent')
        AND ma.alert_type = 'due_soon'
      )
  `).all();

  dueSoon.forEach(item => {
    db.prepare(`
      INSERT INTO maintenance_alerts 
      (machine_id, schedule_id, alert_type, scheduled_date, priority)
      VALUES (?, ?, 'due_soon', ?, 'high')
    `).run(item.machine_id, item.id, item.next_execution);
  });

  if (overdue.length > 0 || dueSoon.length > 0) {
    console.log(`Create ${overdue.length} allarmi scaduti e ${dueSoon.length} allarmi imminenti`);
  }
}

// Esegui ogni ora
cron.schedule('0 * * * *', checkDeadlines);

// Esegui all'avvio
checkDeadlines();

// ============================================
// ROUTE FRONTEND
// ============================================

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/mobile', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'mobile.html'));
});

// ============================================
// ERROR HANDLING
// ============================================

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Errore interno del server' });
});

// ============================================
// AVVIO SERVER
// ============================================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║         Maintenance Pro V4 - Server Avviato               ║
║                                                            ║
║  Porta: ${PORT}                                            ║
║  URL: http://localhost:${PORT}                             ║
║                                                            ║
║  Endpoint API:                                             ║
║  - POST /api/login        - Login utente                   ║
║  - GET  /api/machines     - Lista macchine                 ║
║  - GET  /api/maintenance  - Registro manutenzioni          ║
║  - GET  /api/alerts       - Allarmi scadenze               ║
║  - GET  /api/stats        - Statistiche                    ║
║                                                            ║
║  Credenziali default:                                      ║
║  - Email: admin@maintenance.pro                            ║
║  - Password: admin                                         ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});

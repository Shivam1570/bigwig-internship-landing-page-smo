const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const port = process.env.PORT || 3000;

// Enable simple CORS middleware for local developer testing
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// When set to 'true', do not write JSON files to disk — keep data in memory only.
const NO_FILE_SAVE = (process.env.NO_FILE_SAVE === 'true');
if (NO_FILE_SAVE) console.log('NO_FILE_SAVE mode enabled — data will not be written to disk');

// --- Simple .env loader (supports KEY=VAL and PowerShell $env:KEY='VAL') ---
try {
  const envPaths = [path.join(__dirname, '.env'), path.join(__dirname, 'node_modules', '.env')];
  for (const p of envPaths) {
    if (!fs.existsSync(p)) continue;
    const content = fs.readFileSync(p, 'utf8');
    content.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      // PowerShell style: $env:KEY='value';
      const psMatch = trimmed.match(/^\$env:(\w+)\s*=\s*['\"]?(.*?)['\"]?;?$/);
      if (psMatch) {
        const k = psMatch[1]; const v = psMatch[2]; if (!process.env[k]) process.env[k] = v; return;
      }
      const m = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (m) {
        const k = m[1]; let v = m[2] || '';
        // remove surrounding quotes
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        // strip trailing semicolon if present
        if (v.endsWith(';')) v = v.slice(0, -1);
        if (!process.env[k]) process.env[k] = v;
      }
    });
    // stop after first found
    break;
  }
} catch (e) {
  console.error('Failed to read .env file:', e.message);
}

app.use(express.json());

// --- Helpers ---
// In-memory store used when NO_FILE_SAVE is enabled
const memStore = { admins: null, sessions: null, leads: null };
const readJSON = (p) => {
  if (NO_FILE_SAVE) {
    if (p === ADMINS_DB) { memStore.admins = memStore.admins || []; return memStore.admins; }
    if (p === SESSIONS_DB) { memStore.sessions = memStore.sessions || []; return memStore.sessions; }
    if (p === LEADS_DB) { memStore.leads = memStore.leads || []; return memStore.leads; }
    return [];
  }
  return (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : []);
};
const writeJSON = (p, data) => {
  if (NO_FILE_SAVE) {
    if (p === ADMINS_DB) { memStore.admins = data; return; }
    if (p === SESSIONS_DB) { memStore.sessions = data; return; }
    if (p === LEADS_DB) { memStore.leads = data; return; }
    return;
  }
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
};

const hashPassword = (password, salt) => {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return { salt, hash };
};

const verifyPassword = (password, salt, hash) => {
  const h = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return h === hash;
};

const ADMINS_DB = path.join(__dirname, 'admins.json');
const SESSIONS_DB = path.join(__dirname, 'sessions.json');
const LEADS_DB = path.join(__dirname, 'leads.json');

// Initialize SQLite database for leads persistence (default)
const DB_FILE = path.join(__dirname, 'data.sqlite');
const db = new sqlite3.Database(DB_FILE, (err) => {
  if (err) {
    console.error('Failed to open SQLite DB:', err.message);
    return;
  }
  db.run(`CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fullName TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    service TEXT NOT NULL,
    requirements TEXT,
    receivedAt TEXT NOT NULL
  )`, (e) => { if (e) console.error('Failed to create leads table:', e.message); });
});

const makeToken = () => crypto.randomBytes(24).toString('hex');

function parseCookies(req) {
  const header = req.headers.cookie || '';
  return header.split(';').map(c => c.trim()).filter(Boolean).reduce((acc, cur) => {
    const [k, v] = cur.split('='); acc[k] = v; return acc;
  }, {});
}

function getSession(req) {
  const cookies = parseCookies(req);
  const token = cookies.session;
  if (!token) return null;
  const sessions = readJSON(SESSIONS_DB);
  const s = sessions.find(x => x.token === token && x.expires > Date.now());
  return s || null;
}

// App-level password (optional). If set, certain admin actions require this value.
// For local convenience, allow requests originating from localhost even if the
// client doesn't include the app password. Remote requests must include it.
const APP_PASSWORD = process.env.APP_PASSWORD || process.env.APP_PASS || null;
function checkAppPassword(req) {
  if (!APP_PASSWORD) return true;
  if (req.body && req.body.appPassword && req.body.appPassword === APP_PASSWORD) return true;
  const host = (req.get && req.get('host')) ? req.get('host') : '';
  const ip = req.ip || (req.connection && req.connection.remoteAddress) || '';
  const localHostMatch = host.includes('localhost') || host.includes('127.0.0.1');
  const localIpMatch = ip === '::1' || ip === '127.0.0.1' || ip === '::ffff:127.0.0.1';
  if (localHostMatch || localIpMatch) return true;
  return false;
}

// --- Nodemailer setup (lazy) ---
let mailerTransporter = null;
async function getMailer() {
  if (mailerTransporter) return mailerTransporter;
  // If SMTP env vars provided and not a placeholder host, use them
  const host = process.env.SMTP_HOST || '';
  const isPlaceholder = host.includes('example') || host.includes('localhost') || host.trim() === '';
  if (!isPlaceholder && process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    mailerTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
    return mailerTransporter;
  }

  // Otherwise create a test account (nodemailer ethereal) for development
  const testAccount = await nodemailer.createTestAccount();
  mailerTransporter = nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: { user: testAccount.user, pass: testAccount.pass }
  });
  return mailerTransporter;
}

async function sendResetEmail(toEmail, resetToken, host, protocol) {
  const transporter = await getMailer();
  const resetLink = `${protocol}://${host}/admin-reset.html?token=${resetToken}`;
  const info = await transporter.sendMail({
    from: process.env.FROM_EMAIL || 'no-reply@localhost',
    to: toEmail,
    subject: 'Admin password reset',
    text: `Use this link to reset your admin password: ${resetLink}`,
    html: `<p>Use this link to reset your admin password:</p><p><a href="${resetLink}">${resetLink}</a></p>`
  });

  // If using ethereal, return preview URL for dev convenience
  return nodemailer.getTestMessageUrl ? nodemailer.getTestMessageUrl(info) : null;
}

// Serve admin auth before static assets so it can redirect
app.get(['/admin-auth.html', '/admin-auth', '/admin-auth/'], (req, res) => {
  res.sendFile(path.join(__dirname, 'admin-auth.html'));
});

// Admin area - protected, redirect to auth if no session
app.get(['/admin', '/admin.html', '/admin/'], (req, res) => {
  const s = getSession(req);
  if (s) return res.sendFile(path.join(__dirname, 'admin.html'));
  return res.redirect('/admin-auth.html');
});

app.use(express.static(path.join(__dirname)));

// --- Leads API ---
app.post('/api/leads', (req, res) => {
  const { fullName, email, phone, service, requirements } = req.body;
  if (!fullName || !email || !phone || !service) return res.status(400).json({ error: 'Missing required fields.' });
  const receivedAt = new Date().toISOString();
  const params = [fullName, email, phone, service, requirements || '', receivedAt];
  db.run('INSERT INTO leads (fullName,email,phone,service,requirements,receivedAt) VALUES (?,?,?,?,?,?)', params, function(err) {
    if (err) {
      console.error('DB insert error:', err.message);
      return res.status(500).json({ error: 'Failed to save lead.' });
    }
    const id = this.lastID;
    db.get('SELECT * FROM leads WHERE id = ?', [id], (e, row) => {
      if (e) return res.status(500).json({ error: 'Failed to fetch lead.' });
      res.json({ success: true, lead: row });
    });
  });
});

app.get('/api/leads', (req, res) => {
  db.all('SELECT * FROM leads ORDER BY receivedAt DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to read leads.' });
    res.json({ leads: rows });
  });
});

app.delete('/api/leads/:id', (req, res) => {
  const id = Number(req.params.id);
  db.run('DELETE FROM leads WHERE id = ?', [id], function(err) {
    if (err) return res.status(500).json({ error: 'Failed to delete lead.' });
    if (this.changes === 0) return res.status(404).json({ error: 'Lead not found.' });
    res.json({ success: true });
  });
});

// --- Admin auth endpoints ---
app.post('/admin/register', (req, res) => {
  const { username, password } = req.body;
  if (!checkAppPassword(req)) return res.status(403).json({ error: 'Missing or invalid app password.' });
  if (!username || !password || password.length < 6) return res.status(400).json({ error: 'Invalid input.' });
  const admins = readJSON(ADMINS_DB);
  if (admins.find(a => a.username === username)) return res.status(400).json({ error: 'User already exists.' });
  const { salt, hash } = hashPassword(password);
  const admin = { id: Date.now(), username, salt, hash, createdAt: new Date().toISOString() };
  admins.push(admin);
  writeJSON(ADMINS_DB, admins);
  res.json({ success: true });
});

app.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Invalid input.' });
  const admins = readJSON(ADMINS_DB);
  const admin = admins.find(a => a.username === username);
  if (!admin) return res.status(400).json({ error: 'Invalid credentials.' });
  if (!verifyPassword(password, admin.salt, admin.hash)) return res.status(400).json({ error: 'Invalid credentials.' });
  const token = makeToken();
  const sessions = readJSON(SESSIONS_DB);
  const expires = Date.now() + 7 * 24 * 3600 * 1000; // 7 days
  sessions.push({ token, adminId: admin.id, expires });
  writeJSON(SESSIONS_DB, sessions);
  res.setHeader('Set-Cookie', `session=${token}; HttpOnly; Path=/; Max-Age=${7*24*3600}`);
  res.json({ success: true });
});

app.post('/admin/logout', (req, res) => {
  const cookies = parseCookies(req);
  const token = cookies.session;
  if (token) {
    const sessions = readJSON(SESSIONS_DB).filter(s => s.token !== token);
    writeJSON(SESSIONS_DB, sessions);
  }
  res.setHeader('Set-Cookie', 'session=; HttpOnly; Path=/; Max-Age=0');
  res.json({ success: true });
});

app.post('/admin/forgot', async (req, res) => {
  const { username } = req.body;
  if (!checkAppPassword(req)) return res.status(403).json({ error: 'Missing or invalid app password.' });
  if (!username) return res.status(400).json({ error: 'Invalid input.' });
  const admins = readJSON(ADMINS_DB);
  const admin = admins.find(a => a.username === username);
  if (!admin) return res.status(200).json({ success: true, message: 'If that account exists, a reset token was generated.' });

  const resetToken = makeToken();
  admin.resetToken = resetToken;
  admin.resetExpires = Date.now() + 3600 * 1000; // 1 hour
  writeJSON(ADMINS_DB, admins);

  try {
    const previewUrl = await sendResetEmail(admin.username, resetToken, req.get('host'), req.protocol);
    const resp = { success: true };
    if (previewUrl) resp.previewUrl = previewUrl;
    return res.json(resp);
  } catch (err) {
    console.error('Failed to send reset email', err);
    return res.status(500).json({ error: 'Failed to send reset email.' });
  }
});

app.post('/admin/reset', (req, res) => {
  const { token, password } = req.body;
  if (!token || !password || password.length < 6) return res.status(400).json({ error: 'Invalid input.' });
  const admins = readJSON(ADMINS_DB);
  const admin = admins.find(a => a.resetToken === token && a.resetExpires > Date.now());
  if (!admin) return res.status(400).json({ error: 'Invalid or expired token.' });
  const { salt, hash } = hashPassword(password);
  admin.salt = salt; admin.hash = hash; delete admin.resetToken; delete admin.resetExpires;
  writeJSON(ADMINS_DB, admins);
  res.json({ success: true });
});

// Fallback 404
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, '404.html'));
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

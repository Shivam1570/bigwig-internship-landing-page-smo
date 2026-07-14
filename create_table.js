const sqlite3 = require('sqlite3').verbose();
const DB = 'd:/bigwig/smopage/data.sqlite';
const db = new sqlite3.Database(DB, (err) => {
  if (err) { console.error('open err', err.message); process.exit(1); }
  db.run(`CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fullName TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    service TEXT NOT NULL,
    requirements TEXT,
    receivedAt TEXT NOT NULL
  )`, (e) => {
    if (e) { console.error('create table err', e.message); process.exit(1); }
    console.log('created leads table');
    process.exit(0);
  });
});

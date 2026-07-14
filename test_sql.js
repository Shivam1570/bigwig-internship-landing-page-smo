const sqlite3 = require('sqlite3').verbose();
const DB = 'd:/bigwig/smopage/data.sqlite';
const db = new sqlite3.Database(DB, (err) => {
  if (err) { console.error('open err', err.message); process.exit(1); }
  db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='leads'", (e, row) => {
    console.log('leads table exists:', !!row);
    process.exit(0);
  });
});

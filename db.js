/**
 * FMFO Sports — Database (SQLite)
 * Lightweight, zero-config, file-based database
 * Perfect for getting started — swap for PostgreSQL when scaling
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let _db = null;

function initDB() {
  const dbPath = process.env.DB_PATH || './data/fmfo-sports.db';
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  _db = new Database(dbPath);
  _db.pragma('journal_mode = WAL');

  _db.exec(`
    CREATE TABLE IF NOT EXISTS predictions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL DEFAULT 'default',
      pick TEXT NOT NULL,
      sport TEXT NOT NULL,
      team TEXT,
      result TEXT DEFAULT 'pending',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS analyses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL DEFAULT 'default',
      query TEXT NOT NULL,
      sport TEXT NOT NULL,
      team TEXT,
      tab TEXT,
      output TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scores (
      league TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS standings (
      league TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_pred_user ON predictions(user_id);
    CREATE INDEX IF NOT EXISTS idx_analyses_user ON analyses(user_id);
  `);

  console.log('  ✓ Database initialized');
}

function db() {
  if (!_db) throw new Error('Database not initialized — call initDB() first');
  return _db;
}

module.exports = { initDB, db };

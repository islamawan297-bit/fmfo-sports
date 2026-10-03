/**
 * FMFO Sports — Database (SQLite / Vercel Serverless Compatible)
 * Lightweight, zero-config database with resilient Vercel fallback
 */

const path = require('path');
const fs = require('fs');

let _db = null;

class MockStatement {
  constructor(sql, store) {
    this.sql = sql;
    this.store = store;
  }
  run(...params) {
    return { lastInsertRowid: Date.now(), changes: 1 };
  }
  get(...params) {
    return null;
  }
  all(...params) {
    return [];
  }
}

class MockDB {
  constructor() {
    this.store = {};
  }
  pragma() {}
  exec() {}
  prepare(sql) {
    return new MockStatement(sql, this.store);
  }
}

function initDB() {
  if (_db) return _db;

  try {
    const Database = require('better-sqlite3');
    let dbPath = process.env.DB_PATH;
    if (!dbPath) {
      if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
        dbPath = '/tmp/fmfo-sports.db';
      } else {
        dbPath = './data/fmfo-sports.db';
      }
    }

    if (dbPath !== ':memory:' && dbPath !== '/tmp/fmfo-sports.db') {
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }

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

    console.log('  ✓ Database initialized at', dbPath);
  } catch (err) {
    console.warn('  ⚠️ SQLite initialization warning (using resilient fallback):', err.message);
    try {
      const Database = require('better-sqlite3');
      _db = new Database(':memory:');
      _db.exec(`
        CREATE TABLE IF NOT EXISTS predictions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, pick TEXT, sport TEXT, team TEXT, result TEXT DEFAULT 'pending', created_at TEXT);
        CREATE TABLE IF NOT EXISTS analyses (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, query TEXT, sport TEXT, team TEXT, tab TEXT, output TEXT, created_at TEXT);
        CREATE TABLE IF NOT EXISTS scores (league TEXT PRIMARY KEY, data TEXT, updated_at TEXT);
        CREATE TABLE IF NOT EXISTS standings (league TEXT PRIMARY KEY, data TEXT, updated_at TEXT);
      `);
    } catch (e2) {
      _db = new MockDB();
    }
  }

  return _db;
}

function db() {
  if (!_db) initDB();
  return _db;
}

module.exports = { initDB, db };

// electron/database.js — SQLite database initialization (better-sqlite3)
const path = require('path');
const { app } = require('electron');

let db = null;

function getDbPath() {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'rooms.db');
}

function initDatabase() {
  const Database = require('better-sqlite3');
  const dbPath = getDbPath();
  console.log('[DB] Opening database at:', dbPath);

  db = new Database(dbPath);

  // WAL mode for better performance (writes don't block reads)
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // ---- Documents table ----
  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      short_id TEXT UNIQUE NOT NULL,
      title TEXT DEFAULT 'SANS TITRE',
      elements TEXT DEFAULT '[]',
      characters TEXT DEFAULT '[]',
      locations TEXT DEFAULT '[]',
      comments TEXT DEFAULT '[]',
      suggestions TEXT DEFAULT '[]',
      beat_cards TEXT DEFAULT '[]',
      structure_beats TEXT DEFAULT '[]',
      scene_synopsis TEXT DEFAULT '{}',
      scene_status TEXT DEFAULT '{}',
      whiteboard_elements TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // ---- History entries table ----
  db.exec(`
    CREATE TABLE IF NOT EXISTS history_entries (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      user_name TEXT DEFAULT 'Moi',
      user_color TEXT DEFAULT '#4ECDC4',
      action TEXT NOT NULL,
      snapshot_name TEXT,
      data TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
    )
  `);

  // Indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_documents_short_id ON documents(short_id);
    CREATE INDEX IF NOT EXISTS idx_history_document_id ON history_entries(document_id, created_at);
  `);

  console.log('[DB] Database initialized successfully');
  return db;
}

function getDb() {
  if (!db) throw new Error('Database not initialized. Call initDatabase() first.');
  return db;
}

function closeDatabase() {
  if (db) {
    console.log('[DB] Closing database');
    db.close();
    db = null;
  }
}

module.exports = { initDatabase, getDb, closeDatabase, getDbPath };

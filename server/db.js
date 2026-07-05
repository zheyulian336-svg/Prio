// SQLite 数据库初始化与操作封装。
// 文件位置：server/data/prio.db

const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, 'data', 'prio.db');

let db = null;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initTables();
  }
  return db;
}

function initTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS drag_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL DEFAULT 'default_user',
      task_title TEXT NOT NULL,
      from_x REAL,
      from_y REAL,
      to_x REAL,
      to_y REAL,
      from_quadrant TEXT,
      to_quadrant TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS user_profile (
      user_id TEXT PRIMARY KEY,
      profile_text TEXT NOT NULL DEFAULT '',
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);
}

// ---------- drag_events ----------

function insertDragEvent({ userId, taskTitle, fromX, fromY, toX, toY, fromQuadrant, toQuadrant }) {
  const stmt = getDb().prepare(`
    INSERT INTO drag_events (user_id, task_title, from_x, from_y, to_x, to_y, from_quadrant, to_quadrant)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  return stmt.run(userId, taskTitle, fromX, fromY, toX, toY, fromQuadrant, toQuadrant);
}

function getRecentDragEvents(userId, limit = 50) {
  const stmt = getDb().prepare(`
    SELECT task_title, from_x, from_y, to_x, to_y, from_quadrant, to_quadrant, created_at
    FROM drag_events
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `);
  return stmt.all(userId, limit);
}

// ---------- user_profile ----------

function getProfile(userId) {
  const stmt = getDb().prepare('SELECT profile_text FROM user_profile WHERE user_id = ?');
  const row = stmt.get(userId);
  return row ? row.profile_text : '';
}

function upsertProfile(userId, profileText) {
  const stmt = getDb().prepare(`
    INSERT INTO user_profile (user_id, profile_text, updated_at)
    VALUES (?, ?, unixepoch())
    ON CONFLICT(user_id) DO UPDATE SET profile_text = excluded.profile_text, updated_at = unixepoch()
  `);
  return stmt.run(userId, profileText);
}

module.exports = { getDb, insertDragEvent, getRecentDragEvents, getProfile, upsertProfile };

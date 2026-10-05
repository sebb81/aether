import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function openLocalDatabase(path: string): DatabaseSync {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  try {
    db.exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=DELETE; PRAGMA secure_delete=ON; PRAGMA foreign_keys=ON;');
    const version = Number(db.prepare('PRAGMA user_version').get()!.user_version);
    if (version > 3) throw new Error('Version de MEMORY plus récente que cette application. Aucune donnée n’a été modifiée.');
    if (version < 1) db.exec(`BEGIN IMMEDIATE;
      CREATE TABLE memories(id TEXT PRIMARY KEY, content TEXT NOT NULL, category TEXT NOT NULL, origin TEXT NOT NULL CHECK(origin IN ('explicit','inference')), confidence REAL, source TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE VIRTUAL TABLE memory_search USING fts5(id UNINDEXED, content, tokenize='unicode61 remove_diacritics 2');
      PRAGMA user_version=1; COMMIT;`);
    if (version < 2) db.exec(`BEGIN IMMEDIATE;
      CREATE TABLE curiosity_interests(id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, level REAL NOT NULL CHECK(level BETWEEN 0 AND 1), origin TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('active','dormant','abandoned')));
      CREATE TABLE curiosity_explorations(id TEXT PRIMARY KEY, interest_id TEXT REFERENCES curiosity_interests(id) ON DELETE CASCADE, targets TEXT NOT NULL, action TEXT NOT NULL, created_at TEXT NOT NULL, completed_at TEXT, status TEXT NOT NULL, reason TEXT NOT NULL, model TEXT, route TEXT, error TEXT, next_question TEXT, unread INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE curiosity_items(id TEXT PRIMARY KEY, interest_id TEXT NOT NULL REFERENCES curiosity_interests(id) ON DELETE CASCADE, exploration_id TEXT NOT NULL REFERENCES curiosity_explorations(id) ON DELETE CASCADE, kind TEXT NOT NULL CHECK(kind IN ('question','hypothesis','discovery')), content TEXT NOT NULL, created_at TEXT NOT NULL, confidence REAL, limits TEXT, status TEXT NOT NULL);
      CREATE TABLE curiosity_connections(id TEXT PRIMARY KEY, from_id TEXT NOT NULL REFERENCES curiosity_interests(id) ON DELETE CASCADE, to_id TEXT NOT NULL REFERENCES curiosity_interests(id) ON DELETE CASCADE, exploration_id TEXT NOT NULL REFERENCES curiosity_explorations(id) ON DELETE CASCADE, description TEXT NOT NULL, created_at TEXT NOT NULL, CHECK(from_id <> to_id), UNIQUE(from_id,to_id));
      CREATE TABLE curiosity_history(id TEXT PRIMARY KEY, interest_id TEXT NOT NULL REFERENCES curiosity_interests(id) ON DELETE CASCADE, exploration_id TEXT REFERENCES curiosity_explorations(id) ON DELETE CASCADE, created_at TEXT NOT NULL, action TEXT NOT NULL, reason TEXT NOT NULL, previous_level REAL, level REAL NOT NULL, previous_status TEXT, status TEXT NOT NULL);
      CREATE TABLE curiosity_blocks(domain TEXT PRIMARY KEY);
      CREATE TABLE curiosity_settings(id INTEGER PRIMARY KEY CHECK(id=1), content TEXT NOT NULL);
      CREATE TABLE curiosity_forgotten(title_hash TEXT PRIMARY KEY);
      CREATE INDEX curiosity_items_interest ON curiosity_items(interest_id);
      CREATE INDEX curiosity_history_interest ON curiosity_history(interest_id);
      PRAGMA user_version=2; COMMIT;`);
    if (version < 3) db.exec(`BEGIN IMMEDIATE;
      CREATE TABLE echo_sessions(id TEXT PRIMARY KEY, started_at TEXT NOT NULL, ended_at TEXT, status TEXT NOT NULL, root TEXT NOT NULL, summary TEXT, error TEXT);
      CREATE TABLE echo_events(id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES echo_sessions(id) ON DELETE CASCADE, content TEXT NOT NULL);
      CREATE TABLE echo_habits(id TEXT PRIMARY KEY, content TEXT NOT NULL, memory_id TEXT REFERENCES memories(id) ON DELETE SET NULL);
      CREATE TABLE echo_hypotheses(id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES echo_sessions(id) ON DELETE CASCADE, habit_id TEXT NOT NULL REFERENCES echo_habits(id) ON DELETE CASCADE, content TEXT NOT NULL);
      CREATE TABLE echo_invalidations(signature TEXT PRIMARY KEY, reason TEXT NOT NULL);
      CREATE TABLE echo_settings(id INTEGER PRIMARY KEY CHECK(id=1), content TEXT NOT NULL);
      CREATE TABLE echo_opportunities(id TEXT PRIMARY KEY, habit_id TEXT NOT NULL REFERENCES echo_habits(id) ON DELETE CASCADE, content TEXT NOT NULL);
      CREATE INDEX echo_events_session ON echo_events(session_id);
      CREATE INDEX echo_hypotheses_habit ON echo_hypotheses(habit_id);
      PRAGMA user_version=3; COMMIT;`);
    return db;
  } catch (error) { db.close(); throw error; }
}

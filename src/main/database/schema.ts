import Database from 'better-sqlite3';

export const createTablesSQL = `
CREATE TABLE IF NOT EXISTS topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  korean_content TEXT NOT NULL,
  english_content TEXT NOT NULL,
  cefr_level TEXT NOT NULL CHECK (cefr_level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  keywords TEXT,
  recording_path TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  week_start_date DATE
);

CREATE INDEX IF NOT EXISTS idx_topics_status ON topics(status);
CREATE INDEX IF NOT EXISTS idx_topics_created_at ON topics(created_at);
CREATE INDEX IF NOT EXISTS idx_topics_week_start_date ON topics(week_start_date);

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id INTEGER NOT NULL,
  step INTEGER NOT NULL CHECK (step IN (1, 2, 3, 4, 5, 6)),
  date DATE NOT NULL,
  duration INTEGER,
  recording_path TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_topic_id ON sessions(topic_id);
CREATE INDEX IF NOT EXISTS idx_sessions_step ON sessions(step);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(date);

CREATE TABLE IF NOT EXISTS corrections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER,
  topic_id INTEGER,
  original_sentence TEXT NOT NULL,
  corrected_sentence TEXT NOT NULL,
  explanation TEXT NOT NULL,
  categories TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_corrections_session_id ON corrections(session_id);
CREATE INDEX IF NOT EXISTS idx_corrections_topic_id ON corrections(topic_id);
CREATE INDEX IF NOT EXISTS idx_corrections_created_at ON corrections(created_at);

CREATE TABLE IF NOT EXISTS retellings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id INTEGER NOT NULL,
  duration INTEGER NOT NULL CHECK (duration IN (3, 2, 1)),
  audio_path TEXT,
  transcribed_text TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_retellings_topic_id ON retellings(topic_id);
CREATE INDEX IF NOT EXISTS idx_retellings_duration ON retellings(duration);
CREATE INDEX IF NOT EXISTS idx_retellings_created_at ON retellings(created_at);
`;

export const createTriggersSQL = `
CREATE TRIGGER IF NOT EXISTS update_topics_timestamp
AFTER UPDATE ON topics
FOR EACH ROW
BEGIN
  UPDATE topics SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS update_settings_timestamp
AFTER UPDATE ON settings
FOR EACH ROW
BEGIN
  UPDATE settings SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;
`;

export const insertDefaultSettingsSQL = `
INSERT OR IGNORE INTO settings (key, value) VALUES ('ttsVoiceId', 'en-US-AriaNeural');
INSERT OR IGNORE INTO settings (key, value) VALUES ('recordingSavePath', '');
`;

export function initializeDatabase(db: Database.Database): void {
  db.exec(createTablesSQL);
  db.exec(createTriggersSQL);
  db.exec(insertDefaultSettingsSQL);
}

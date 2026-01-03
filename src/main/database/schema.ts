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
`;

export const createTriggersSQL = `
CREATE TRIGGER IF NOT EXISTS update_topics_timestamp
AFTER UPDATE ON topics
FOR EACH ROW
BEGIN
  UPDATE topics SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;
`;

export function initializeDatabase(db: Database.Database): void {
  db.exec(createTablesSQL);
  db.exec(createTriggersSQL);
}

export const SCHEMA_VERSION = 2;

/**
 * Ordered migrations applied to an existing database whose recorded version is
 * lower than `to`. Fresh databases are created at SCHEMA_VERSION directly.
 */
export const MIGRATIONS: { to: number; sql: string }[] = [
  {
    to: 2,
    sql: `ALTER TABLE monthly_goal ADD COLUMN weight INTEGER NOT NULL DEFAULT 0;`,
  },
];

/** Full DDL. Executed once when a fresh database is created. */
export const SCHEMA_SQL = /* sql */ `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS setting (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS life_area (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  icon        TEXT NOT NULL DEFAULT '',
  position    INTEGER NOT NULL DEFAULT 0,
  is_demo     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS monthly_goal (
  id            TEXT PRIMARY KEY,
  life_area_id  TEXT NOT NULL REFERENCES life_area(id) ON DELETE CASCADE,
  year          INTEGER NOT NULL,
  month         INTEGER NOT NULL,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  weight        INTEGER NOT NULL DEFAULT 0,
  is_demo       INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  UNIQUE (life_area_id, year, month)
);

CREATE TABLE IF NOT EXISTS process (
  id               TEXT PRIMARY KEY,
  monthly_goal_id  TEXT NOT NULL REFERENCES monthly_goal(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  description      TEXT NOT NULL DEFAULT '',
  weight           INTEGER NOT NULL DEFAULT 0,
  target_value     REAL NOT NULL DEFAULT 1,
  unit             TEXT NOT NULL DEFAULT '',
  position         INTEGER NOT NULL DEFAULT 0,
  active           INTEGER NOT NULL DEFAULT 1,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_execution (
  id           TEXT PRIMARY KEY,
  process_id   TEXT NOT NULL REFERENCES process(id) ON DELETE CASCADE,
  date         TEXT NOT NULL,
  completed    INTEGER NOT NULL DEFAULT 0,
  actual_value REAL,
  score        REAL NOT NULL DEFAULT 0,
  note         TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  UNIQUE (process_id, date)
);

CREATE TABLE IF NOT EXISTS daily_score (
  id                     TEXT PRIMARY KEY,
  date                   TEXT NOT NULL UNIQUE,
  score                  REAL NOT NULL DEFAULT 0,
  is_minimum_viable_day  INTEGER NOT NULL DEFAULT 0,
  is_freeze_day          INTEGER NOT NULL DEFAULT 0,
  created_at             TEXT NOT NULL,
  updated_at             TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS streak (
  id                    INTEGER PRIMARY KEY CHECK (id = 1),
  current_streak        INTEGER NOT NULL DEFAULT 0,
  longest_streak        INTEGER NOT NULL DEFAULT 0,
  last_active_date      TEXT,
  freeze_days_used      INTEGER NOT NULL DEFAULT 0,
  freeze_days_available INTEGER NOT NULL DEFAULT 2,
  updated_at            TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS weekly_reflection (
  id                             TEXT PRIMARY KEY,
  week_start                     TEXT NOT NULL UNIQUE,
  week_end                       TEXT NOT NULL,
  what_went_well                 TEXT NOT NULL DEFAULT '',
  what_didnt_go_well             TEXT NOT NULL DEFAULT '',
  what_to_change                 TEXT NOT NULL DEFAULT '',
  previous_action_items_reviewed INTEGER NOT NULL DEFAULT 0,
  created_at                     TEXT NOT NULL,
  updated_at                     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS action_item (
  id            TEXT PRIMARY KEY,
  reflection_id TEXT NOT NULL REFERENCES weekly_reflection(id) ON DELETE CASCADE,
  text          TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'open',
  position      INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_goal_period ON monthly_goal (year, month);
CREATE INDEX IF NOT EXISTS idx_process_goal ON process (monthly_goal_id);
CREATE INDEX IF NOT EXISTS idx_exec_process_date ON daily_execution (process_id, date);
CREATE INDEX IF NOT EXISTS idx_exec_date ON daily_execution (date);

INSERT INTO schema_version (version) VALUES (${SCHEMA_VERSION});
INSERT OR IGNORE INTO streak (id, updated_at) VALUES (1, datetime('now'));
`;

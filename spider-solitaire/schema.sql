-- D1 - Spider Solitaire Géocaching

CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  player TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id TEXT NOT NULL UNIQUE,
  player TEXT NOT NULL,
  score INTEGER NOT NULL,
  seconds INTEGER NOT NULL,
  moves INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (game_id) REFERENCES games(id)
);

CREATE INDEX IF NOT EXISTS idx_scores_ranking
ON scores (
  score DESC,
  seconds ASC,
  moves ASC,
  created_at ASC
);

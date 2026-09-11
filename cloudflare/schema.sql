CREATE TABLE IF NOT EXISTS scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pseudo TEXT NOT NULL,
  score INTEGER NOT NULL,
  seconds INTEGER NOT NULL,
  moves INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scores_ranking
ON scores (score DESC, seconds ASC, moves ASC, created_at ASC);

-- One row per player (device) per day: their round as scored by the server.
CREATE TABLE IF NOT EXISTS results (
  day    INTEGER NOT NULL,
  device TEXT    NOT NULL,
  name   TEXT    NOT NULL,
  pts    INTEGER NOT NULL,
  acc    REAL    NOT NULL,
  tests  INTEGER NOT NULL,
  hex    TEXT    NOT NULL,  -- the best color they tested
  at     TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (day, device)
);
CREATE INDEX IF NOT EXISTS results_by_day ON results (day, pts DESC);
CREATE INDEX IF NOT EXISTS results_by_device ON results (device);

PRAGMA foreign_keys = ON;

CREATE TABLE attendees (
  event_id TEXT NOT NULL,
  attendee_id TEXT NOT NULL,
  recovery_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (event_id, attendee_id),
  UNIQUE (event_id, recovery_hash)
);

CREATE TABLE submissions (
  event_id TEXT NOT NULL,
  attendee_id TEXT NOT NULL,
  phase TEXT NOT NULL CHECK (phase IN ('entrance', 'exit')),
  submitted_at INTEGER NOT NULL,
  response_hash TEXT NOT NULL,
  PRIMARY KEY (event_id, attendee_id, phase),
  FOREIGN KEY (event_id, attendee_id)
    REFERENCES attendees (event_id, attendee_id)
    ON DELETE CASCADE
);

CREATE TABLE answers (
  event_id TEXT NOT NULL,
  attendee_id TEXT NOT NULL,
  phase TEXT NOT NULL CHECK (phase IN ('entrance', 'exit')),
  question_id TEXT NOT NULL,
  option_id TEXT NOT NULL,
  PRIMARY KEY (event_id, attendee_id, phase, question_id, option_id),
  FOREIGN KEY (event_id, attendee_id, phase)
    REFERENCES submissions (event_id, attendee_id, phase)
    ON DELETE CASCADE
);

CREATE INDEX answers_aggregate_idx
  ON answers (event_id, phase, question_id, option_id);

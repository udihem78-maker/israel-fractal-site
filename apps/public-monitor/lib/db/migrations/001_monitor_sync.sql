CREATE TABLE monitor_sync (
  id integer PRIMARY KEY CHECK (id = 1),
  snapshot jsonb,
  last_attempt timestamptz,
  last_success timestamptz,
  next_attempt timestamptz,
  last_error text,
  running boolean NOT NULL DEFAULT false
);

INSERT INTO monitor_sync (id) VALUES (1);

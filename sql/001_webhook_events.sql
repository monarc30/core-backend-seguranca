-- 1) Rode este primeiro no SQL Editor do Supabase

DROP TABLE IF EXISTS webhook_events_processed CASCADE;

CREATE TABLE webhook_events_processed (
  event_id     TEXT PRIMARY KEY,
  provider     TEXT NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  payload_hash TEXT,
  outcome      TEXT DEFAULT 'processing'
);

CREATE INDEX idx_webhook_events_provider
  ON webhook_events_processed(provider, processed_at);

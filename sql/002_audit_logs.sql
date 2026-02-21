-- 2) Rode este depois no SQL Editor do Supabase

DROP TABLE IF EXISTS audit_logs CASCADE;

CREATE TABLE audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  account_id    UUID NOT NULL,
  user_id       UUID,
  action        TEXT NOT NULL,
  resource_type TEXT,
  resource_id   TEXT,
  old_value     JSONB,
  new_value     JSONB,
  metadata      JSONB,
  performed_by  UUID
);

CREATE INDEX idx_audit_account_created
  ON audit_logs(account_id, created_at DESC);

CREATE INDEX idx_audit_action
  ON audit_logs(action, created_at DESC);

CREATE INDEX idx_audit_created
  ON audit_logs(created_at DESC);

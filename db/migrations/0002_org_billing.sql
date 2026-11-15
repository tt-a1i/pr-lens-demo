-- Move billing ownership from individual users to organizations
ALTER TABLE users
  DROP COLUMN stripe_customer_id;

ALTER TABLE invoices
  DROP CONSTRAINT invoices_user_id_fkey,
  DROP COLUMN user_id,
  ADD COLUMN org_id uuid NOT NULL REFERENCES organizations(id),
  ADD COLUMN idempotency_key text NOT NULL,
  ALTER COLUMN amount_cents TYPE bigint;

CREATE UNIQUE INDEX invoices_idempotency_key_idx ON invoices (idempotency_key);

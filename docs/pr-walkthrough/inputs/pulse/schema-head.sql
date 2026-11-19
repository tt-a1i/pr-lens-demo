CREATE TABLE users (
  id uuid PRIMARY KEY,
  email citext NOT NULL UNIQUE
);

CREATE TABLE organizations (
  id uuid PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  stripe_account_id text NOT NULL
);

CREATE TABLE invoices (
  id uuid PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES organizations(id),
  idempotency_key text NOT NULL,
  amount_cents bigint NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX invoices_idempotency_key_idx ON invoices (idempotency_key);

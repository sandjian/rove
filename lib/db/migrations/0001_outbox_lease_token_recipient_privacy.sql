ALTER TABLE "email_outbox" ADD COLUMN IF NOT EXISTS "lease_token" varchar(64);

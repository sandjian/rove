-- Migración 0001: Mecanismo de propiedad de lease explícito y privacidad de destinatario en email_outbox
-- PREPARADA LOCALMENTE: No ha sido aplicada a Neon ni a entornos remotos.

ALTER TABLE "email_outbox" ADD COLUMN IF NOT EXISTS "lease_token" varchar(64);
--> statement-breakpoint
ALTER TABLE "email_outbox" ALTER COLUMN "recipient" DROP NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_email_outbox_lease" ON "email_outbox" ("id", "lease_token");

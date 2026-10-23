CREATE TABLE "admin_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_id" uuid NOT NULL,
	"customer_name" varchar(120) NOT NULL,
	"customer_email" varchar(255) NOT NULL,
	"customer_phone" varchar(50) NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"status" varchar(20) DEFAULT 'confirmed' NOT NULL,
	"service_name_snapshot" varchar(120) NOT NULL,
	"service_duration_snapshot" integer NOT NULL,
	"service_price_snapshot" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'ARS' NOT NULL,
	"cancellation_token_hash" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone,
	CONSTRAINT "chk_appts_status_valid" CHECK ("appointments"."status" IN ('confirmed', 'cancelled', 'completed')),
	CONSTRAINT "chk_appts_chronological" CHECK ("appointments"."end_at" > "appointments"."start_at"),
	CONSTRAINT "chk_appts_duration_positive" CHECK ("appointments"."service_duration_snapshot" > 0),
	CONSTRAINT "chk_appts_price_positive" CHECK ("appointments"."service_price_snapshot" >= 0)
);
--> statement-breakpoint
CREATE TABLE "availability_windows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"is_blocked" boolean DEFAULT false NOT NULL,
	"reason" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_avail_window_chronological" CHECK ("availability_windows"."end_at" > "availability_windows"."start_at")
);
--> statement-breakpoint
CREATE TABLE "email_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"appointment_id" uuid NOT NULL,
	"event_type" varchar(50) NOT NULL,
	"recipient" varchar(255) NOT NULL,
	"payload" jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"provider_message_id" varchar(255),
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	CONSTRAINT "chk_outbox_event_type" CHECK ("email_outbox"."event_type" IN ('booking_confirmed', 'customer_cancellation', 'admin_cancellation')),
	CONSTRAINT "chk_outbox_status" CHECK ("email_outbox"."status" IN ('pending', 'processing', 'sent', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"price_amount" integer NOT NULL,
	"duration_minutes" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_services_price_positive" CHECK ("services"."price_amount" >= 0),
	CONSTRAINT "chk_services_duration_range" CHECK ("services"."duration_minutes" > 0 AND "services"."duration_minutes" <= 480)
);
--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_outbox" ADD CONSTRAINT "email_outbox_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_admin_users_email" ON "admin_users" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "idx_appts_cancellation_token_hash" ON "appointments" USING btree ("cancellation_token_hash");--> statement-breakpoint
CREATE INDEX "idx_appts_schedule_search" ON "appointments" USING btree ("start_at","end_at");--> statement-breakpoint
CREATE INDEX "idx_appts_customer_email" ON "appointments" USING btree ("customer_email");--> statement-breakpoint
CREATE INDEX "idx_avail_windows_range" ON "availability_windows" USING btree ("start_at","end_at");--> statement-breakpoint
CREATE INDEX "idx_email_outbox_dispatch" ON "email_outbox" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "idx_email_outbox_appointment" ON "email_outbox" USING btree ("appointment_id");--> statement-breakpoint
CREATE INDEX "idx_services_active_sort" ON "services" USING btree ("is_active","sort_order");--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "no_overlapping_confirmed_appointments" EXCLUDE USING gist (tstzrange("start_at", "end_at", '[)') WITH &&) WHERE ("status" = 'confirmed');
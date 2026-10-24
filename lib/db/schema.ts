import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql, relations } from "drizzle-orm";

// ==============================================================================
// 1. ADMIN USERS (Cuenta administrativa única para el barbero)
// ==============================================================================
export const adminUsers = pgTable(
  "admin_users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("idx_admin_users_email").on(sql`lower(${table.email})`),
  ]
);

// ==============================================================================
// 2. SERVICES (Catálogo de servicios)
// ==============================================================================
export const services = pgTable(
  "services",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    priceAmount: integer("price_amount").notNull(), // Importe en enteros (ARS)
    durationMinutes: integer("duration_minutes").notNull(), // Entre 1 y 480 min
    isActive: boolean("is_active").default(true).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check("chk_services_price_positive", sql`${table.priceAmount} >= 0`),
    check(
      "chk_services_duration_range",
      sql`${table.durationMinutes} > 0 AND ${table.durationMinutes} <= 480`
    ),
    index("idx_services_active_sort").on(table.isActive, table.sortOrder),
  ]
);

// ==============================================================================
// 3. AVAILABILITY WINDOWS (Franjas de trabajo y bloqueos manuales)
// ==============================================================================
export const availabilityWindows = pgTable(
  "availability_windows",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    isBlocked: boolean("is_blocked").default(false).notNull(), // true = descanso, feriado, bloqueo
    reason: varchar("reason", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check("chk_avail_window_chronological", sql`${table.endAt} > ${table.startAt}`),
    index("idx_avail_windows_range").on(table.startAt, table.endAt),
  ]
);

// ==============================================================================
// 4. APPOINTMENTS (Turnos reservados)
// ==============================================================================
export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "restrict" }),
    customerName: varchar("customer_name", { length: 120 }).notNull(),
    customerEmail: varchar("customer_email", { length: 255 }).notNull(),
    customerPhone: varchar("customer_phone", { length: 50 }).notNull(), // OBLIGATORIO
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    status: varchar("status", { length: 20 }).default("confirmed").notNull(), // 'confirmed' | 'cancelled' | 'completed'
    serviceNameSnapshot: varchar("service_name_snapshot", { length: 120 }).notNull(),
    serviceDurationSnapshot: integer("service_duration_snapshot").notNull(),
    servicePriceSnapshot: integer("service_price_snapshot").notNull(),
    currency: varchar("currency", { length: 3 }).default("ARS").notNull(),
    cancellationTokenHash: varchar("cancellation_token_hash", {
      length: 64,
    }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  },
  (table) => [
    check(
      "chk_appts_status_valid",
      sql`${table.status} IN ('confirmed', 'cancelled', 'completed')`
    ),
    check("chk_appts_chronological", sql`${table.endAt} > ${table.startAt}`),
    check(
      "chk_appts_duration_positive",
      sql`${table.serviceDurationSnapshot} > 0`
    ),
    check("chk_appts_price_positive", sql`${table.servicePriceSnapshot} >= 0`),
    uniqueIndex("idx_appts_cancellation_token_hash").on(
      table.cancellationTokenHash
    ),
    index("idx_appts_schedule_search").on(table.startAt, table.endAt),
    index("idx_appts_customer_email").on(table.customerEmail),
  ]
);

// ==============================================================================
// 5. EMAIL OUTBOX (Cola de correos transaccionales desacoplada)
// ==============================================================================
export const emailOutbox = pgTable(
  "email_outbox",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    appointmentId: uuid("appointment_id")
      .notNull()
      .references(() => appointments.id, { onDelete: "cascade" }),
    eventType: varchar("event_type", { length: 50 }).notNull(), // 'booking_confirmed' | 'customer_cancellation' | 'admin_cancellation'
    recipient: varchar("recipient", { length: 255 }).notNull(),
    payload: jsonb("payload").notNull(),
    status: varchar("status", { length: 20 }).default("pending").notNull(), // 'pending' | 'processing' | 'sent' | 'failed'
    attemptCount: integer("attempt_count").default(0).notNull(),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    leaseToken: varchar("lease_token", { length: 64 }), // Token criptográfico único por reclamación de lease
    providerMessageId: varchar("provider_message_id", { length: 255 }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (table) => [
    check(
      "chk_outbox_event_type",
      sql`${table.eventType} IN ('booking_confirmed', 'customer_cancellation', 'admin_cancellation')`
    ),
    check(
      "chk_outbox_status",
      sql`${table.status} IN ('pending', 'processing', 'sent', 'failed')`
    ),
    index("idx_email_outbox_dispatch").on(table.status, table.nextAttemptAt),
    index("idx_email_outbox_appointment").on(table.appointmentId),
  ]
);

// ==============================================================================
// RELACIONES DRIZZLE ORM
// ==============================================================================
export const servicesRelations = relations(services, ({ many }) => ({
  appointments: many(appointments),
}));

export const appointmentsRelations = relations(appointments, ({ one, many }) => ({
  service: one(services, {
    fields: [appointments.serviceId],
    references: [services.id],
  }),
  emailNotifications: many(emailOutbox),
}));

export const emailOutboxRelations = relations(emailOutbox, ({ one }) => ({
  appointment: one(appointments, {
    fields: [emailOutbox.appointmentId],
    references: [appointments.id],
  }),
}));

// ==============================================================================
// TIPOS INFERIDOS DE DOMINIO
// ==============================================================================
export type AdminUser = typeof adminUsers.$inferSelect;
export type NewAdminUser = typeof adminUsers.$inferInsert;

export type Service = typeof services.$inferSelect;
export type NewService = typeof services.$inferInsert;

export type AvailabilityWindow = typeof availabilityWindows.$inferSelect;
export type NewAvailabilityWindow = typeof availabilityWindows.$inferInsert;

export type Appointment = typeof appointments.$inferSelect;
export type NewAppointment = typeof appointments.$inferInsert;

export type EmailOutboxItem = typeof emailOutbox.$inferSelect;
export type NewEmailOutboxItem = typeof emailOutbox.$inferInsert;

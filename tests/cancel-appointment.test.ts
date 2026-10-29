import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  cancelAppointmentByToken,
  getAppointmentByCancellationToken,
} from "../lib/services/appointments/cancel-appointment";
import { cancelAppointmentAction } from "../app/actions";
import { hashCancellationToken } from "../lib/security";
import type { Appointment, EmailOutboxItem } from "../lib/db/schema";
import type { DrizzleDb } from "../lib/db";

function createMockAppointment(overrides?: Partial<Appointment>): Appointment {
  const now = new Date();
  return {
    id: "appt-" + Math.random().toString(36).substring(2, 9),
    serviceId: "srv-123",
    customerName: "Carlos Tevez",
    customerEmail: "carlos@example.com",
    customerPhone: "+5491112345678",
    startAt: new Date(now.getTime() + 86400000), // +24h
    endAt: new Date(now.getTime() + 86400000 + 45 * 60000),
    status: "confirmed",
    serviceNameSnapshot: "Corte Clásico",
    serviceDurationSnapshot: 45,
    servicePriceSnapshot: 15000,
    currency: "ARS",
    cancellationTokenHash: "dummy-hash",
    createdAt: now,
    updatedAt: now,
    cancelledAt: null,
    ...overrides,
  };
}

/**
 * Cliente Drizzle simulado para verificar atomicidad, bloqueos y mutaciones
 */
function createMockCancelDb(initialAppointments: Appointment[] = []) {
  const store = new Map<string, Appointment>();
  for (const appt of initialAppointments) {
    store.set(appt.id, { ...appt });
  }

  const outboxEntries: EmailOutboxItem[] = [];
  let selectForUpdateCalled = false;
  let transactionCalled = false;

  const mockDb = {
    select: () => ({
      from: () => ({
        where: (condition: unknown) => ({
          limit: async (num: number) => {
            // Busqueda por tokenHash
            const appts = Array.from(store.values());
            return appts.slice(0, num);
          },
        }),
      }),
    }),
    transaction: async <T>(callback: (tx: any) => Promise<T>): Promise<T> => {
      transactionCalled = true;
      const tx = {
        select: () => ({
          from: () => ({
            where: (condition: unknown) => ({
              for: (lockMode: string) => {
                if (lockMode === "update") {
                  selectForUpdateCalled = true;
                }
                return Array.from(store.values());
              },
            }),
          }),
        }),
        update: (table: unknown) => ({
          set: (fields: Partial<Appointment>) => ({
            where: (condition: unknown) => ({
              returning: async () => {
                // actualizar en store
                const existing = Array.from(store.values())[0];
                if (existing) {
                  Object.assign(existing, fields, { cancelledAt: new Date() });
                  store.set(existing.id, existing);
                  return [existing];
                }
                return [];
              },
            }),
          }),
        }),
        insert: (table: unknown) => ({
          values: async (data: any) => {
            const entry: EmailOutboxItem = {
              id: "outbox-" + Math.random().toString(36).substring(2, 9),
              appointmentId: data.appointmentId,
              eventType: data.eventType,
              recipient: data.recipient,
              payload: data.payload,
              status: data.status,
              attemptCount: 0,
              nextAttemptAt: new Date(),
              leaseToken: null,
              providerMessageId: null,
              lastError: null,
              createdAt: new Date(),
              sentAt: null,
            };
            outboxEntries.push(entry);
            return [entry];
          },
        }),
      };

      return await callback(tx);
    },
    // Getters para auditoría
    getStore: () => store,
    getOutbox: () => outboxEntries,
    wasTransactionUsed: () => transactionCalled,
    wasSelectForUpdateUsed: () => selectForUpdateCalled,
  };

  return mockDb as unknown as DrizzleDb & {
    getStore: () => Map<string, Appointment>;
    getOutbox: () => EmailOutboxItem[];
    wasTransactionUsed: () => boolean;
    wasSelectForUpdateUsed: () => boolean;
  };
}

describe("Servicio de Cancelación de Turnos (Fase 4B)", () => {
  const validToken = "a".repeat(64);
  const validTokenHash = hashCancellationToken(validToken);

  it("1. getAppointmentByCancellationToken rechaza tokens malformados sin consultar BD", async () => {
    const mockDb = createMockCancelDb([]);
    const resShort = await getAppointmentByCancellationToken("too-short", mockDb);
    assert.equal(resShort, null);

    const resEmpty = await getAppointmentByCancellationToken("", mockDb);
    assert.equal(resEmpty, null);

    const resInvalidType = await getAppointmentByCancellationToken(null as any, mockDb);
    assert.equal(resInvalidType, null);
  });

  it("2. cancelAppointmentByToken rechaza tokens inválidos o de longitud distinta a 64 hex", async () => {
    const mockDb = createMockCancelDb([]);
    const res = await cancelAppointmentByToken("token_invalido_123", mockDb);
    assert.equal(res.success, false);
    assert.match(res.error ?? "", /no es válido/i);
    assert.equal(mockDb.wasTransactionUsed(), false);
  });

  it("3. cancelAppointmentByToken retorna error claro si no encuentra reserva", async () => {
    const mockDb = createMockCancelDb([]); // vacio
    const res = await cancelAppointmentByToken(validToken, mockDb);

    assert.equal(res.success, false);
    assert.match(res.error ?? "", /no se encontró ninguna reserva/i);
    assert.equal(mockDb.wasTransactionUsed(), true);
  });

  it("4. cancelAppointmentByToken es idempotente si la cita ya estaba cancelada", async () => {
    const appt = createMockAppointment({
      cancellationTokenHash: validTokenHash,
      status: "cancelled",
      cancelledAt: new Date(),
    });
    const mockDb = createMockCancelDb([appt]);

    const res = await cancelAppointmentByToken(validToken, mockDb);

    assert.equal(res.success, true);
    assert.equal(res.alreadyCancelled, true);
    assert.equal(res.appointment?.status, "cancelled");
    // No debe insertar en outbox de nuevo si ya estaba cancelada
    assert.equal(mockDb.getOutbox().length, 0);
  });

  it("5. cancelAppointmentByToken cancela con éxito, bloquea con FOR UPDATE y despacha email directo vía Resend", async () => {
    const appt = createMockAppointment({
      cancellationTokenHash: validTokenHash,
      status: "confirmed",
    });
    const mockDb = createMockCancelDb([appt]);

    const sentEmails: Array<{ to: string | string[]; subject: string }> = [];
    const mockResend = {
      emails: {
        send: async (payload: { to: string | string[]; subject: string }) => {
          sentEmails.push(payload);
          return { data: { id: "msg-cancel-1" }, error: null };
        },
      },
    };

    const res = await cancelAppointmentByToken(validToken, mockDb, mockResend);

    await new Promise((resolve) => setTimeout(resolve, 10));

    assert.equal(res.success, true);
    assert.equal(res.alreadyCancelled, false);
    assert.equal(res.appointment?.status, "cancelled");
    assert.ok(mockDb.wasSelectForUpdateUsed(), "Debe usar FOR UPDATE para prevenir carreras");

    // Verificar que ya no inserta en outbox y despacha directamente vía Resend
    assert.equal(mockDb.getOutbox().length, 0);
    assert.equal(sentEmails.length, 1);
    assert.equal(sentEmails[0].to, "carlos@example.com");
    assert.match(sentEmails[0].subject, /Turno cancelado/i);
  });
});

describe("Server Action: cancelAppointmentAction", () => {
  it("rechaza de forma segura tokens inválidos retornando error amigable", async () => {
    const res = await cancelAppointmentAction("token-invalido");
    assert.equal(res.success, false);
    assert.ok(res.error);
  });
});

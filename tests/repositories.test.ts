import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Service, AvailabilityWindow, Appointment } from "../lib/db/schema";
import type { DbReader } from "../lib/repositories/types";
import {
  getActiveServices,
  getActiveServiceById,
} from "../lib/repositories/services.repository";
import {
  mapAvailabilityWindowRecord,
  mapAppointmentRecord,
  getAvailabilityWindowsInRange,
  getOccupyingAppointmentsInRange,
  getAvailabilityQueryData,
} from "../lib/repositories/availability.repository";
import { calculateAvailableSlots } from "../lib/availability/engine";

/**
 * Crea un lector de base de datos simulado (in-memory) para pruebas unitarias.
 * No reproduce la implementación interna de los repositorios; simplemente provee
 * datos observables o simula fallos de conexión/consulta.
 */
function createMockDbReader(options: {
  services?: Service[];
  availabilityWindows?: AvailabilityWindow[];
  appointments?: Appointment[];
  throwErrorOnQuery?: boolean;
}): DbReader {
  return {
    query: {
      services: {
        findMany: async () => {
          if (options.throwErrorOnQuery) {
            throw new Error("Neon connection failed");
          }
          return options.services ?? [];
        },
        findFirst: async () => {
          if (options.throwErrorOnQuery) {
            throw new Error("Neon connection failed");
          }
          return options.services?.[0];
        },
      },
      availabilityWindows: {
        findMany: async () => {
          if (options.throwErrorOnQuery) {
            throw new Error("Neon connection failed");
          }
          return options.availabilityWindows ?? [];
        },
      },
      appointments: {
        findMany: async () => {
          if (options.throwErrorOnQuery) {
            throw new Error("Neon connection failed");
          }
          return options.appointments ?? [];
        },
      },
    },
  };
}

describe("Capa de Datos — Mapeo y Adaptación de Registros", () => {
  // 1. Conversión correcta de availability_windows
  it("1. mapea correctamente un registro de availability_windows a AvailabilityWindowInput", () => {
    const rawWindow: AvailabilityWindow = {
      id: "win-123",
      startAt: new Date("2026-10-24T12:00:00.000Z"),
      endAt: new Date("2026-10-24T20:00:00.000Z"),
      isBlocked: false,
      reason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mapped = mapAvailabilityWindowRecord(rawWindow);
    assert.equal(mapped.startAt.toISOString(), "2026-10-24T12:00:00.000Z");
    assert.equal(mapped.endAt.toISOString(), "2026-10-24T20:00:00.000Z");
    assert.equal(mapped.isBlocked, false);
    assert.equal(mapped.reason, null);
  });

  // 2. Manejo de fechas en formato string o Date
  it("2. convierte fechas ISO en string a instancias Date válidas", () => {
    // Simula deserialización de timestamps
    const rawWithStrings = {
      id: "win-456",
      startAt: "2026-10-24T13:00:00.000Z" as unknown as Date,
      endAt: "2026-10-24T17:00:00.000Z" as unknown as Date,
      isBlocked: true,
      reason: "Almuerzo",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mapped = mapAvailabilityWindowRecord(rawWithStrings);
    assert.ok(mapped.startAt instanceof Date);
    assert.ok(mapped.endAt instanceof Date);
    assert.equal(mapped.startAt.toISOString(), "2026-10-24T13:00:00.000Z");
    assert.equal(mapped.isBlocked, true);
    assert.equal(mapped.reason, "Almuerzo");
  });

  // 3. Conversión de appointments a AppointmentSlotInput
  it("3. mapea correctamente un registro de appointments a AppointmentSlotInput", () => {
    const rawAppt: Appointment = {
      id: "appt-789",
      serviceId: "srv-1",
      customerName: "Juan Pérez",
      customerEmail: "juan@example.com",
      customerPhone: "+542231234567",
      startAt: new Date("2026-10-24T14:00:00.000Z"),
      endAt: new Date("2026-10-24T14:45:00.000Z"),
      status: "confirmed",
      serviceNameSnapshot: "Corte y Barba",
      serviceDurationSnapshot: 45,
      servicePriceSnapshot: 15000,
      currency: "ARS",
      cancellationTokenHash: "abc",
      createdAt: new Date(),
      updatedAt: new Date(),
      cancelledAt: null,
    };

    const mapped = mapAppointmentRecord(rawAppt);
    assert.equal(mapped.startAt.toISOString(), "2026-10-24T14:00:00.000Z");
    assert.equal(mapped.endAt.toISOString(), "2026-10-24T14:45:00.000Z");
    assert.equal(mapped.status, "confirmed");
  });

  // 4. Rechazo explícito de registros corruptos
  it("4. rechaza registros con fechas inválidas o endAt <= startAt", () => {
    const corruptWindow = {
      id: "corrupt-1",
      startAt: new Date("2026-10-24T15:00:00.000Z"),
      endAt: new Date("2026-10-24T14:00:00.000Z"), // endAt < startAt
      isBlocked: false,
      reason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    assert.throws(() => mapAvailabilityWindowRecord(corruptWindow), {
      message: /endAt .* debe ser estrictamente posterior a startAt/,
    });

    const corruptAppt = {
      id: "corrupt-2",
      startAt: new Date("invalid-date"),
      endAt: new Date("2026-10-24T15:00:00.000Z"),
      status: "confirmed",
      serviceId: "s1",
      customerName: "A",
      customerEmail: "b@c.com",
      customerPhone: "123",
      serviceNameSnapshot: "S",
      serviceDurationSnapshot: 30,
      servicePriceSnapshot: 1000,
      currency: "ARS",
      cancellationTokenHash: "h",
      createdAt: new Date(),
      updatedAt: new Date(),
      cancelledAt: null,
    };

    assert.throws(() => mapAppointmentRecord(corruptAppt), {
      message: /Fecha inválida en campo 'startAt'/,
    });
  });
});

describe("Capa de Datos — Repositorios de Servicios y Disponibilidad", () => {
  const sampleService: Service = {
    id: "srv-corte-clasico",
    name: "Corte Clásico",
    description: "Corte tradicional a tijera y máquina",
    priceAmount: 12000,
    durationMinutes: 30,
    isActive: true,
    sortOrder: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const sampleWindow: AvailabilityWindow = {
    id: "win-1",
    startAt: new Date("2026-10-24T13:00:00.000Z"),
    endAt: new Date("2026-10-24T21:00:00.000Z"),
    isBlocked: false,
    reason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const confirmedAppt: Appointment = {
    id: "appt-confirmed",
    serviceId: sampleService.id,
    customerName: "Carlos Gómez",
    customerEmail: "carlos@example.com",
    customerPhone: "+542235551234",
    startAt: new Date("2026-10-24T15:00:00.000Z"),
    endAt: new Date("2026-10-24T15:30:00.000Z"),
    status: "confirmed",
    serviceNameSnapshot: sampleService.name,
    serviceDurationSnapshot: 30,
    servicePriceSnapshot: 12000,
    currency: "ARS",
    cancellationTokenHash: "hash-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    cancelledAt: null,
  };

  // 5. Consulta de catálogo de servicios activos
  it("5. recupera servicios activos y permite consultar por ID", async () => {
    const mockDb = createMockDbReader({ services: [sampleService] });

    const activeServices = await getActiveServices(mockDb);
    assert.equal(activeServices.length, 1);
    assert.equal(activeServices[0].id, sampleService.id);

    const foundService = await getActiveServiceById(sampleService.id, mockDb);
    assert.ok(foundService);
    assert.equal(foundService.name, "Corte Clásico");
    assert.equal(foundService.durationMinutes, 30);

    const notFound = await getActiveServiceById("no-existe", createMockDbReader({ services: [] }));
    assert.equal(notFound, null);
  });

  // 6. Manejo de errores de base de datos
  it("6. propaga errores explícitos si la consulta a la base de datos falla", async () => {
    const failingDb = createMockDbReader({ throwErrorOnQuery: true });

    await assert.rejects(
      async () => getActiveServices(failingDb),
      { message: /Error al consultar catálogo de servicios activos: Neon connection failed/ }
    );

    await assert.rejects(
      async () =>
        getAvailabilityWindowsInRange(
          new Date("2026-10-24T10:00:00Z"),
          new Date("2026-10-24T20:00:00Z"),
          failingDb
        ),
      { message: /Error al consultar ventanas de disponibilidad: Neon connection failed/ }
    );

    await assert.rejects(
      async () =>
        getOccupyingAppointmentsInRange(
          new Date("2026-10-24T10:00:00Z"),
          new Date("2026-10-24T20:00:00Z"),
          failingDb
        ),
      { message: /Error al consultar turnos ocupados: Neon connection failed/ }
    );
  });

  // 7. Resultados vacíos manejados limpiamente
  it("7. maneja resultados vacíos devolviendo arrays vacíos sin fallar", async () => {
    const emptyDb = createMockDbReader({
      availabilityWindows: [],
      appointments: [],
    });

    const windows = await getAvailabilityWindowsInRange(
      new Date("2026-10-24T10:00:00.000Z"),
      new Date("2026-10-24T20:00:00.000Z"),
      emptyDb
    );
    assert.deepEqual(windows, []);

    const appts = await getOccupyingAppointmentsInRange(
      new Date("2026-10-24T10:00:00.000Z"),
      new Date("2026-10-24T20:00:00.000Z"),
      emptyDb
    );
    assert.deepEqual(appts, []);
  });

  // 8. Rechazo de rangos de fecha inválidos
  it("8. rechaza rangos de consulta donde endDate <= startDate", async () => {
    const mockDb = createMockDbReader({});

    await assert.rejects(
      async () =>
        getAvailabilityWindowsInRange(
          new Date("2026-10-24T20:00:00.000Z"),
          new Date("2026-10-24T10:00:00.000Z"),
          mockDb
        ),
      { message: /endDate debe ser posterior a startDate/ }
    );
  });

  // 9. Adaptador unificado getAvailabilityQueryData y compatibilidad con el motor
  it("9. integra la capa de datos con calculateAvailableSlots de forma compatible", async () => {
    const mockDb = createMockDbReader({
      services: [sampleService],
      availabilityWindows: [sampleWindow],
      appointments: [confirmedAppt],
    });

    const fixedNow = new Date("2026-10-24T12:00:00.000Z");

    const queryData = await getAvailabilityQueryData(
      {
        serviceId: sampleService.id,
        referenceNow: fixedNow,
        horizonDays: 7,
      },
      mockDb
    );

    // Verificar que queryData cumpla con AvailabilityQueryInput
    assert.equal(queryData.serviceDurationMinutes, 30);
    assert.equal(queryData.availabilityWindows.length, 1);
    assert.equal(queryData.existingAppointments.length, 1);
    assert.equal(queryData.existingAppointments[0].status, "confirmed");

    // Alimentar directamente el motor puro con la salida del repositorio
    const slots = calculateAvailableSlots(queryData);

    assert.ok(slots.length > 0);
    // Ningún slot generado puede solapar con el turno confirmado de 15:00 a 15:30
    const startIsos = slots.map((s) => s.startIso);
    assert.equal(startIsos.includes("2026-10-24T15:00:00.000Z"), false);
    // 15:30 a 16:00 debe estar disponible
    assert.ok(startIsos.includes("2026-10-24T15:30:00.000Z"));
  });

  // 10. getAvailabilityQueryData rechaza servicios inexistentes
  it("10. getAvailabilityQueryData lanza error si el servicio no existe", async () => {
    const mockDb = createMockDbReader({ services: [] });

    await assert.rejects(
      async () =>
        getAvailabilityQueryData(
          {
            serviceId: "id-inexistente",
            referenceNow: new Date("2026-10-24T12:00:00.000Z"),
          },
          mockDb
        ),
      { message: /Servicio no encontrado o inactivo: 'id-inexistente'/ }
    );
  });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  mergeIntervals,
  subtractIntervals,
  isValidInterval,
} from "../lib/availability/intervals";
import {
  calculateAvailableSlots,
  getTimeZoneOffsetMs,
} from "../lib/availability/engine";
import type {
  AvailabilityWindowInput,
  AppointmentSlotInput,
} from "../lib/availability/types";

describe("Disponibilidad — Operaciones de Intervalos Semiabiertos", () => {
  // 1. Fusión de franjas solapadas
  it("1. fusiona franjas laborales solapadas en un único intervalo continuo", () => {
    const i1 = {
      startAt: new Date("2026-10-24T12:00:00.000Z"), // 09:00 ART
      endAt: new Date("2026-10-24T16:00:00.000Z"), // 13:00 ART
    };
    const i2 = {
      startAt: new Date("2026-10-24T15:30:00.000Z"), // 12:30 ART
      endAt: new Date("2026-10-24T21:00:00.000Z"), // 18:00 ART
    };

    const merged = mergeIntervals([i1, i2]);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].startAt.toISOString(), "2026-10-24T12:00:00.000Z");
    assert.equal(merged[0].endAt.toISOString(), "2026-10-24T21:00:00.000Z");
  });

  // 2. Fusión de franjas contiguas
  it("2. fusiona franjas laborales contiguas (el fin de una coincide con el inicio de otra)", () => {
    const i1 = {
      startAt: new Date("2026-10-24T12:00:00.000Z"),
      endAt: new Date("2026-10-24T16:00:00.000Z"),
    };
    const i2 = {
      startAt: new Date("2026-10-24T16:00:00.000Z"),
      endAt: new Date("2026-10-24T21:00:00.000Z"),
    };

    const merged = mergeIntervals([i1, i2]);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].startAt.toISOString(), "2026-10-24T12:00:00.000Z");
    assert.equal(merged[0].endAt.toISOString(), "2026-10-24T21:00:00.000Z");
  });

  // 3. Franjas sin solapamiento
  it("3. mantiene separadas las franjas que no se solapan", () => {
    const i1 = {
      startAt: new Date("2026-10-24T12:00:00.000Z"),
      endAt: new Date("2026-10-24T16:00:00.000Z"),
    };
    const i2 = {
      startAt: new Date("2026-10-24T18:00:00.000Z"),
      endAt: new Date("2026-10-24T22:00:00.000Z"),
    };

    const merged = mergeIntervals([i2, i1]); // En orden inverso para probar ordenamiento
    assert.equal(merged.length, 2);
    assert.equal(merged[0].startAt.toISOString(), "2026-10-24T12:00:00.000Z");
    assert.equal(merged[0].endAt.toISOString(), "2026-10-24T16:00:00.000Z");
    assert.equal(merged[1].startAt.toISOString(), "2026-10-24T18:00:00.000Z");
    assert.equal(merged[1].endAt.toISOString(), "2026-10-24T22:00:00.000Z");
  });

  // 4. Resta de un bloqueo interior
  it("4. resta un bloqueo interior dividiendo la jornada en dos tramos", () => {
    const base = [
      {
        startAt: new Date("2026-10-24T12:00:00.000Z"),
        endAt: new Date("2026-10-24T21:00:00.000Z"),
      },
    ];
    const block = [
      {
        startAt: new Date("2026-10-24T16:00:00.000Z"),
        endAt: new Date("2026-10-24T17:00:00.000Z"),
      },
    ];

    const free = subtractIntervals(base, block);
    assert.equal(free.length, 2);
    assert.equal(free[0].startAt.toISOString(), "2026-10-24T12:00:00.000Z");
    assert.equal(free[0].endAt.toISOString(), "2026-10-24T16:00:00.000Z");
    assert.equal(free[1].startAt.toISOString(), "2026-10-24T17:00:00.000Z");
    assert.equal(free[1].endAt.toISOString(), "2026-10-24T21:00:00.000Z");
  });

  // 5. Bloqueo al inicio o final de una franja
  it("5. resta correctamente bloqueos que cortan el inicio o el final de una franja", () => {
    const base = [
      {
        startAt: new Date("2026-10-24T12:00:00.000Z"),
        endAt: new Date("2026-10-24T21:00:00.000Z"),
      },
    ];
    const blocks = [
      {
        startAt: new Date("2026-10-24T12:00:00.000Z"),
        endAt: new Date("2026-10-24T13:00:00.000Z"),
      },
      {
        startAt: new Date("2026-10-24T20:00:00.000Z"),
        endAt: new Date("2026-10-24T21:00:00.000Z"),
      },
    ];

    const free = subtractIntervals(base, blocks);
    assert.equal(free.length, 1);
    assert.equal(free[0].startAt.toISOString(), "2026-10-24T13:00:00.000Z");
    assert.equal(free[0].endAt.toISOString(), "2026-10-24T20:00:00.000Z");
  });

  // 6. Bloqueos superpuestos
  it("6. resta bloqueos superpuestos sin duplicar ni corromper las franjas libres", () => {
    const base = [
      {
        startAt: new Date("2026-10-24T12:00:00.000Z"),
        endAt: new Date("2026-10-24T21:00:00.000Z"),
      },
    ];
    const blocks = [
      {
        startAt: new Date("2026-10-24T15:00:00.000Z"),
        endAt: new Date("2026-10-24T17:00:00.000Z"),
      },
      {
        startAt: new Date("2026-10-24T16:00:00.000Z"),
        endAt: new Date("2026-10-24T18:00:00.000Z"),
      },
    ];

    const free = subtractIntervals(base, blocks);
    assert.equal(free.length, 2);
    assert.equal(free[0].startAt.toISOString(), "2026-10-24T12:00:00.000Z");
    assert.equal(free[0].endAt.toISOString(), "2026-10-24T15:00:00.000Z");
    assert.equal(free[1].startAt.toISOString(), "2026-10-24T18:00:00.000Z");
    assert.equal(free[1].endAt.toISOString(), "2026-10-24T21:00:00.000Z");
  });

  // Robustez de subtractIntervals(): validación de entradas inválidas aún con lista vacía
  it("falla de forma explícita si subtractIntervals recibe sustraendos inválidos con lista base vacía", () => {
    const invalidSubtrahend = {
      startAt: new Date("2026-10-24T16:00:00.000Z"),
      endAt: new Date("2026-10-24T14:00:00.000Z"), // endAt < startAt
    };

    assert.throws(() => subtractIntervals([], [invalidSubtrahend]), {
      message: /Error de validación temporal en subtrahendIntervals\[0\]/,
    });
  });

  it("falla si subtractIntervals recibe listas con elementos nulos o mal formados", () => {
    // @ts-expect-error comprobación de elemento nulo en runtime
    assert.throws(() => subtractIntervals([null], []), {
      message: /Error de validación temporal en sourceIntervals\[0\]/,
    });

    // @ts-expect-error comprobación de elemento nulo en subtrahends
    assert.throws(() => subtractIntervals([], [null]), {
      message: /Error de validación temporal en subtrahendIntervals\[0\]/,
    });

    // @ts-expect-error argumentos no array
    assert.throws(() => subtractIntervals(null, []), {
      message: /sourceIntervals debe ser un array/,
    });

    // @ts-expect-error argumentos no array
    assert.throws(() => subtractIntervals([], null), {
      message: /subtrahendIntervals debe ser un array/,
    });
  });
});

describe("Disponibilidad — Motor Principal y Reglas de Negocio", () => {
  const fixedNow = new Date("2026-10-24T12:00:00.000Z");

  const standardWorkWindow: AvailabilityWindowInput = {
    startAt: new Date("2026-10-24T13:00:00.000Z"),
    endAt: new Date("2026-10-24T21:00:00.000Z"),
    isBlocked: false,
  };

  // 7. Turnos confirmados dentro de la jornada
  it("7. excluye turnos confirmados de los horarios disponibles", () => {
    const confirmedAppt: AppointmentSlotInput = {
      startAt: new Date("2026-10-24T17:00:00.000Z"),
      endAt: new Date("2026-10-24T17:30:00.000Z"),
      status: "confirmed",
    };

    const slots = calculateAvailableSlots({
      availabilityWindows: [standardWorkWindow],
      existingAppointments: [confirmedAppt],
      serviceDurationMinutes: 30,
      referenceNow: fixedNow,
    });

    for (const slot of slots) {
      const s = slot.startAt.getTime();
      const e = slot.endAt.getTime();
      const apptStart = confirmedAppt.startAt.getTime();
      const apptEnd = confirmedAppt.endAt.getTime();

      const overlaps = s < apptEnd && e > apptStart;
      assert.equal(overlaps, false, `Slot ${slot.startIso} solapa con turno confirmado`);
    }
  });

  // 8. Turnos que dividen un intervalo libre en dos
  it("8. un turno confirmado divide la franja en dos y permite turnos adyacentes exactos", () => {
    const window: AvailabilityWindowInput = {
      startAt: new Date("2026-10-24T15:00:00.000Z"),
      endAt: new Date("2026-10-24T17:00:00.000Z"),
      isBlocked: false,
    };
    const appt: AppointmentSlotInput = {
      startAt: new Date("2026-10-24T15:45:00.000Z"),
      endAt: new Date("2026-10-24T16:15:00.000Z"),
      status: "confirmed",
    };

    const slots = calculateAvailableSlots({
      availabilityWindows: [window],
      existingAppointments: [appt],
      serviceDurationMinutes: 30,
      referenceNow: fixedNow,
    });

    const startIsos = slots.map((s) => s.startIso);
    assert.ok(startIsos.includes("2026-10-24T15:15:00.000Z"));
    assert.ok(startIsos.includes("2026-10-24T16:15:00.000Z"));
    assert.equal(startIsos.includes("2026-10-24T15:30:00.000Z"), false);
    assert.equal(startIsos.includes("2026-10-24T15:45:00.000Z"), false);
    assert.equal(startIsos.includes("2026-10-24T16:00:00.000Z"), false);
  });

  // 9. Turnos cancelados que no deben bloquear
  it("9. los turnos cancelados o completados no bloquean la agenda", () => {
    const cancelledAppt: AppointmentSlotInput = {
      startAt: new Date("2026-10-24T16:00:00.000Z"),
      endAt: new Date("2026-10-24T17:00:00.000Z"),
      status: "cancelled",
    };
    const completedAppt: AppointmentSlotInput = {
      startAt: new Date("2026-10-24T17:00:00.000Z"),
      endAt: new Date("2026-10-24T18:00:00.000Z"),
      status: "completed",
    };

    const slots = calculateAvailableSlots({
      availabilityWindows: [standardWorkWindow],
      existingAppointments: [cancelledAppt, completedAppt],
      serviceDurationMinutes: 60,
      referenceNow: fixedNow,
    });

    const startIsos = slots.map((s) => s.startIso);
    assert.ok(startIsos.includes("2026-10-24T16:00:00.000Z"));
    assert.ok(startIsos.includes("2026-10-24T17:00:00.000Z"));
  });

  // 10. Servicios cuya duración no cabe en el intervalo disponible
  it("10. descarta intervalos donde la duración completa del servicio no cabe", () => {
    const window: AvailabilityWindowInput = {
      startAt: new Date("2026-10-24T15:00:00.000Z"),
      endAt: new Date("2026-10-24T15:30:00.000Z"),
      isBlocked: false,
    };

    const slots = calculateAvailableSlots({
      availabilityWindows: [window],
      existingAppointments: [],
      serviceDurationMinutes: 45,
      referenceNow: fixedNow,
    });

    assert.equal(slots.length, 0);
  });

  // 11. Candidato que termina exactamente al comienzo de un bloqueo
  it("11. permite un candidato que termina exactamente al inicio de un bloqueo", () => {
    const window: AvailabilityWindowInput = {
      startAt: new Date("2026-10-24T14:00:00.000Z"),
      endAt: new Date("2026-10-24T18:00:00.000Z"),
      isBlocked: false,
    };
    const block: AvailabilityWindowInput = {
      startAt: new Date("2026-10-24T15:30:00.000Z"),
      endAt: new Date("2026-10-24T16:30:00.000Z"),
      isBlocked: true,
    };

    const slots = calculateAvailableSlots({
      availabilityWindows: [window, block],
      existingAppointments: [],
      serviceDurationMinutes: 30,
      referenceNow: fixedNow,
    });

    const slot1500 = slots.find((s) => s.startIso === "2026-10-24T15:00:00.000Z");
    assert.ok(slot1500);
    assert.equal(slot1500.endIso, "2026-10-24T15:30:00.000Z");
  });

  // 12. Candidato que comienza exactamente cuando termina un bloqueo
  it("12. permite un candidato que comienza exactamente cuando finaliza un bloqueo", () => {
    const window: AvailabilityWindowInput = {
      startAt: new Date("2026-10-24T14:00:00.000Z"),
      endAt: new Date("2026-10-24T18:00:00.000Z"),
      isBlocked: false,
    };
    const block: AvailabilityWindowInput = {
      startAt: new Date("2026-10-24T15:30:00.000Z"),
      endAt: new Date("2026-10-24T16:30:00.000Z"),
      isBlocked: true,
    };

    const slots = calculateAvailableSlots({
      availabilityWindows: [window, block],
      existingAppointments: [],
      serviceDurationMinutes: 30,
      referenceNow: fixedNow,
    });

    const slot1630 = slots.find((s) => s.startIso === "2026-10-24T16:30:00.000Z");
    assert.ok(slot1630);
    assert.equal(slot1630.endIso, "2026-10-24T17:00:00.000Z");
  });

  // 13. Dos turnos consecutivos sin solapamiento
  it("13. genera slots consecutivos donde el fin de uno coincide con el inicio del siguiente", () => {
    const window: AvailabilityWindowInput = {
      startAt: new Date("2026-10-24T15:00:00.000Z"),
      endAt: new Date("2026-10-24T16:00:00.000Z"),
      isBlocked: false,
    };

    const slots = calculateAvailableSlots(
      {
        availabilityWindows: [window],
        existingAppointments: [],
        serviceDurationMinutes: 30,
        referenceNow: fixedNow,
      },
      { slotStepMinutes: 30 }
    );

    assert.equal(slots.length, 2);
    assert.equal(slots[0].startIso, "2026-10-24T15:00:00.000Z");
    assert.equal(slots[0].endIso, "2026-10-24T15:30:00.000Z");
    assert.equal(slots[1].startIso, "2026-10-24T15:30:00.000Z");
    assert.equal(slots[1].endIso, "2026-10-24T16:00:00.000Z");
  });

  // 14. Anticipación mínima exacta de dos horas
  it("14. permite un turno cuyo inicio es exactamente igual a now + 2 horas", () => {
    const window: AvailabilityWindowInput = {
      startAt: new Date("2026-10-24T13:00:00.000Z"),
      endAt: new Date("2026-10-24T16:00:00.000Z"),
      isBlocked: false,
    };

    const slots = calculateAvailableSlots({
      availabilityWindows: [window],
      existingAppointments: [],
      serviceDurationMinutes: 30,
      referenceNow: fixedNow,
    });

    const startIsos = slots.map((s) => s.startIso);
    assert.ok(startIsos.includes("2026-10-24T14:00:00.000Z"));
  });

  // 15. Rechazo de un inicio anterior al límite de anticipación
  it("15. descarta turnos cuyo inicio sea anterior a now + 2 horas", () => {
    const window: AvailabilityWindowInput = {
      startAt: new Date("2026-10-24T12:00:00.000Z"),
      endAt: new Date("2026-10-24T16:00:00.000Z"),
      isBlocked: false,
    };

    const slots = calculateAvailableSlots({
      availabilityWindows: [window],
      existingAppointments: [],
      serviceDurationMinutes: 30,
      referenceNow: fixedNow,
    });

    const startIsos = slots.map((s) => s.startIso);
    assert.equal(startIsos.includes("2026-10-24T12:00:00.000Z"), false);
    assert.equal(startIsos.includes("2026-10-24T13:45:00.000Z"), false);
    assert.ok(startIsos.includes("2026-10-24T14:00:00.000Z"));
  });

  // 16. Límites del horizonte móvil de siete días
  it("16. admite turnos hasta el límite exacto del horizonte de 7 días (7 * 24h)", () => {
    const day7Window: AvailabilityWindowInput = {
      startAt: new Date("2026-10-31T11:00:00.000Z"),
      endAt: new Date("2026-10-31T13:00:00.000Z"),
      isBlocked: false,
    };

    const slots = calculateAvailableSlots({
      availabilityWindows: [day7Window],
      existingAppointments: [],
      serviceDurationMinutes: 30,
      referenceNow: fixedNow,
    });

    const startIsos = slots.map((s) => s.startIso);
    assert.ok(startIsos.includes("2026-10-31T11:30:00.000Z"));
  });

  // 17. Turnos que comienzan dentro del horizonte pero terminan fuera del límite permitido
  it("17. rechaza turnos que inician antes del fin del horizonte pero terminan después del límite", () => {
    const day7Window: AvailabilityWindowInput = {
      startAt: new Date("2026-10-31T11:00:00.000Z"),
      endAt: new Date("2026-10-31T14:00:00.000Z"),
      isBlocked: false,
    };

    const slots = calculateAvailableSlots({
      availabilityWindows: [day7Window],
      existingAppointments: [],
      serviceDurationMinutes: 30,
      referenceNow: fixedNow,
    });

    const startIsos = slots.map((s) => s.startIso);
    assert.equal(startIsos.includes("2026-10-31T11:45:00.000Z"), false);
    assert.equal(startIsos.includes("2026-10-31T12:00:00.000Z"), false);
  });

  // 18. Orden cronológico y ausencia de duplicados
  it("18. retorna los horarios ordenados cronológicamente sin duplicados", () => {
    const window1: AvailabilityWindowInput = {
      startAt: new Date("2026-10-25T14:00:00.000Z"),
      endAt: new Date("2026-10-25T18:00:00.000Z"),
      isBlocked: false,
    };
    const window2: AvailabilityWindowInput = {
      startAt: new Date("2026-10-24T15:00:00.000Z"),
      endAt: new Date("2026-10-24T18:00:00.000Z"),
      isBlocked: false,
    };

    const slots = calculateAvailableSlots({
      availabilityWindows: [window1, window2],
      existingAppointments: [],
      serviceDurationMinutes: 30,
      referenceNow: fixedNow,
    });

    for (let i = 0; i < slots.length - 1; i++) {
      assert.ok(
        slots[i].startAt.getTime() < slots[i + 1].startAt.getTime(),
        "El listado debe estar estrictamente ordenado en forma ascendente"
      );
    }
  });

  // 19. Franjas vacías o sin intervalos libres
  it("19. retorna array vacío si no hay franjas o si los bloqueos cubren toda la jornada", () => {
    assert.deepEqual(
      calculateAvailableSlots({
        availabilityWindows: [],
        existingAppointments: [],
        serviceDurationMinutes: 30,
        referenceNow: fixedNow,
      }),
      []
    );

    const fullBlock: AvailabilityWindowInput = {
      startAt: new Date("2026-10-24T14:00:00.000Z"),
      endAt: new Date("2026-10-24T16:00:00.000Z"),
      isBlocked: true,
    };
    const window: AvailabilityWindowInput = {
      startAt: new Date("2026-10-24T14:00:00.000Z"),
      endAt: new Date("2026-10-24T16:00:00.000Z"),
      isBlocked: false,
    };

    assert.deepEqual(
      calculateAvailableSlots({
        availabilityWindows: [window, fullBlock],
        existingAppointments: [],
        serviceDurationMinutes: 30,
        referenceNow: fixedNow,
      }),
      []
    );
  });

  // 20. Intervalos inválidos y duración de servicio inválida
  it("20. lanza error explícito ante parámetros o intervalos inválidos", () => {
    assert.throws(
      () =>
        calculateAvailableSlots({
          availabilityWindows: [standardWorkWindow],
          existingAppointments: [],
          serviceDurationMinutes: 0,
        }),
      { message: /Duración de servicio inválida/ }
    );

    assert.throws(
      () =>
        calculateAvailableSlots({
          availabilityWindows: [standardWorkWindow],
          existingAppointments: [],
          serviceDurationMinutes: 500,
        }),
      { message: /Duración de servicio inválida/ }
    );

    const invalidWindow: AvailabilityWindowInput = {
      startAt: new Date("2026-10-24T16:00:00.000Z"),
      endAt: new Date("2026-10-24T14:00:00.000Z"),
      isBlocked: false,
    };
    assert.throws(
      () =>
        calculateAvailableSlots({
          availabilityWindows: [invalidWindow],
          existingAppointments: [],
          serviceDurationMinutes: 30,
        }),
      { message: /endAt debe ser estrictamente posterior a startAt/ }
    );

    assert.equal(
      isValidInterval({
        startAt: new Date("invalid"),
        endAt: new Date("2026-10-24T14:00:00.000Z"),
      }),
      false
    );
  });

  // Validaciones numéricas estrictas (Infinity, NaN, rangos y seguros)
  it("rechaza opciones numéricas no finitas o fuera de rango (Infinity, NaN, etc.)", () => {
    // minNoticeHours = Infinity
    assert.throws(
      () =>
        calculateAvailableSlots(
          {
            availabilityWindows: [standardWorkWindow],
            existingAppointments: [],
            serviceDurationMinutes: 30,
            referenceNow: fixedNow,
          },
          { minNoticeHours: Infinity }
        ),
      { message: /Anticipación mínima inválida/ }
    );

    // minNoticeHours = NaN
    assert.throws(
      () =>
        calculateAvailableSlots(
          {
            availabilityWindows: [standardWorkWindow],
            existingAppointments: [],
            serviceDurationMinutes: 30,
            referenceNow: fixedNow,
          },
          { minNoticeHours: NaN }
        ),
      { message: /Anticipación mínima inválida/ }
    );

    // bookingHorizonDays = Infinity
    assert.throws(
      () =>
        calculateAvailableSlots(
          {
            availabilityWindows: [standardWorkWindow],
            existingAppointments: [],
            serviceDurationMinutes: 30,
            referenceNow: fixedNow,
          },
          { bookingHorizonDays: Infinity }
        ),
      { message: /Horizonte de reservas inválido/ }
    );

    // bookingHorizonDays = -Infinity
    assert.throws(
      () =>
        calculateAvailableSlots(
          {
            availabilityWindows: [standardWorkWindow],
            existingAppointments: [],
            serviceDurationMinutes: 30,
            referenceNow: fixedNow,
          },
          { bookingHorizonDays: -Infinity }
        ),
      { message: /Horizonte de reservas inválido/ }
    );

    // slotStepMinutes = 0
    assert.throws(
      () =>
        calculateAvailableSlots(
          {
            availabilityWindows: [standardWorkWindow],
            existingAppointments: [],
            serviceDurationMinutes: 30,
            referenceNow: fixedNow,
          },
          { slotStepMinutes: 0 }
        ),
      { message: /Cadencia de horarios inválida/ }
    );

    // slotStepMinutes > 120
    assert.throws(
      () =>
        calculateAvailableSlots(
          {
            availabilityWindows: [standardWorkWindow],
            existingAppointments: [],
            serviceDurationMinutes: 30,
            referenceNow: fixedNow,
          },
          { slotStepMinutes: 180 }
        ),
      { message: /Cadencia de horarios inválida/ }
    );

    // serviceDurationMinutes = Infinity
    assert.throws(
      () =>
        calculateAvailableSlots({
          availabilityWindows: [standardWorkWindow],
          existingAppointments: [],
          serviceDurationMinutes: Infinity,
          referenceNow: fixedNow,
        }),
      { message: /Duración de servicio inválida/ }
    );
  });

  // Validación de objetos y estados canónicos
  it("rechaza elementos nulos o mal formados en los arrays de entrada y valida estados canónicos", () => {
    // availabilityWindows con null
    assert.throws(
      () =>
        calculateAvailableSlots({
          // @ts-expect-error comprobación de elemento nulo en runtime
          availabilityWindows: [null],
          existingAppointments: [],
          serviceDurationMinutes: 30,
          referenceNow: fixedNow,
        }),
      { message: /availabilityWindows\[0\] inválido/ }
    );

    // existingAppointments con null
    assert.throws(
      () =>
        calculateAvailableSlots({
          availabilityWindows: [standardWorkWindow],
          // @ts-expect-error comprobación de elemento nulo en runtime
          existingAppointments: [null],
          serviceDurationMinutes: 30,
          referenceNow: fixedNow,
        }),
      { message: /existingAppointments\[0\] inválido/ }
    );

    // status no canónico (ej. 'pending' o 'draft')
    const invalidStatusAppt = {
      startAt: new Date("2026-10-24T14:00:00.000Z"),
      endAt: new Date("2026-10-24T15:00:00.000Z"),
      status: "pending",
    };
    assert.throws(
      () =>
        calculateAvailableSlots({
          availabilityWindows: [standardWorkWindow],
          existingAppointments: [invalidStatusAppt],
          serviceDurationMinutes: 30,
          referenceNow: fixedNow,
        }),
      { message: /debe ser uno de los estados canónicos/ }
    );

    // timeZone inválida
    assert.throws(
      () =>
        calculateAvailableSlots(
          {
            availabilityWindows: [standardWorkWindow],
            existingAppointments: [],
            serviceDurationMinutes: 30,
            referenceNow: fixedNow,
          },
          { timeZone: "Invalida/Zona_Horaria" }
        ),
      { message: /Zona horaria inválida/ }
    );
  });

  // 21. Grilla fija uniforme alineada al reloj y no al inicio del hueco
  it("21. alinea los slots a la grilla fija del reloj (15 min) aunque el hueco inicie desalineado", () => {
    const misalignedWindow: AvailabilityWindowInput = {
      startAt: new Date("2026-10-24T14:07:00.000Z"),
      endAt: new Date("2026-10-24T15:00:00.000Z"),
      isBlocked: false,
    };

    const slots = calculateAvailableSlots({
      availabilityWindows: [misalignedWindow],
      existingAppointments: [],
      serviceDurationMinutes: 30,
      referenceNow: fixedNow,
    });

    assert.ok(slots.length > 0);
    assert.equal(slots[0].startIso, "2026-10-24T14:15:00.000Z");
    assert.equal(slots[0].endIso, "2026-10-24T14:45:00.000Z");
  });

  // 22. Comportamiento consistente e independiente de la variable de entorno TZ del servidor
  it("22. produce instantes e ISOs idénticos sin importar la zona horaria TZ del servidor", () => {
    const originalTz = process.env.TZ;

    const windowInput: AvailabilityWindowInput = {
      startAt: new Date("2026-10-24T12:00:00.000Z"), // 09:00 ART
      endAt: new Date("2026-10-24T16:00:00.000Z"), // 13:00 ART
      isBlocked: false,
    };

    const query = {
      availabilityWindows: [windowInput],
      existingAppointments: [],
      serviceDurationMinutes: 30,
      referenceNow: new Date("2026-10-24T10:00:00.000Z"),
    };

    // Ejecutar simulando diferentes variables de entorno TZ del servidor
    process.env.TZ = "UTC";
    const slotsUtc = calculateAvailableSlots(query);

    process.env.TZ = "America/New_York";
    const slotsNy = calculateAvailableSlots(query);

    process.env.TZ = "Asia/Tokyo";
    const slotsTokyo = calculateAvailableSlots(query);

    // Restaurar TZ original
    if (originalTz !== undefined) {
      process.env.TZ = originalTz;
    } else {
      delete process.env.TZ;
    }

    // Todos los instantes absolutos y representaciones ISO deben ser estrictamente iguales
    assert.equal(slotsUtc.length, slotsNy.length);
    assert.equal(slotsUtc.length, slotsTokyo.length);

    for (let i = 0; i < slotsUtc.length; i++) {
      assert.equal(slotsUtc[i].startAt.getTime(), slotsNy[i].startAt.getTime());
      assert.equal(slotsUtc[i].startAt.getTime(), slotsTokyo[i].startAt.getTime());
      assert.equal(slotsUtc[i].startIso, slotsNy[i].startIso);
      assert.equal(slotsUtc[i].startIso, slotsTokyo[i].startIso);
    }
  });

  // Verificación real de la responsabilidad de timeZone (alineación a reloj local)
  it("timeZone ajusta la alineación del reloj local correctamente ante zonas con desplazamiento fraccionario", () => {
    // Asia/Kolkata tiene UTC+5:30 (330 minutos)
    const offsetKolkata = getTimeZoneOffsetMs(fixedNow, "Asia/Kolkata");
    assert.equal(offsetKolkata, 5.5 * 60 * 60 * 1000);

    // America/Argentina/Buenos_Aires tiene UTC-3 (-180 minutos)
    const offsetBa = getTimeZoneOffsetMs(fixedNow, "America/Argentina/Buenos_Aires");
    assert.equal(offsetBa, -3 * 60 * 60 * 1000);
  });
});

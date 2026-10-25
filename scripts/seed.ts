import { db } from "../lib/db";
import { services, availabilityWindows } from "../lib/db/schema";
import { count } from "drizzle-orm";

async function seed() {
  console.log("🌱 Iniciando seed de Rove Barbería...");

  // 1. Seed de Servicios
  const [{ serviceCount }] = await db
    .select({ serviceCount: count() })
    .from(services);

  if (Number(serviceCount) === 0) {
    console.log("📋 Insertando catálogo de servicios iniciales...");
    await db.insert(services).values([
      {
        name: "Corte Clásico",
        description: "Corte a tijera o máquina con degradé preciso, acabado a navaja y peinado con cera mate.",
        durationMinutes: 30,
        priceAmount: 12000,
        isActive: true,
        sortOrder: 1,
      },
      {
        name: "Perfilado y Arreglo de Barba",
        description: "Diseño y rebajado de barba, toalla caliente, rasurado de contornos a navaja y aceites hidratantes.",
        durationMinutes: 30,
        priceAmount: 8000,
        isActive: true,
        sortOrder: 2,
      },
      {
        name: "Combo Rove: Corte + Barba",
        description: "La experiencia completa de Rove: corte de cabello personalizado, tratamiento de barba y toalla caliente.",
        durationMinutes: 50,
        priceAmount: 18000,
        isActive: true,
        sortOrder: 3,
      },
      {
        name: "Corte Infantil",
        description: "Corte de pelo para menores de 12 años con atención paciente y dedicada.",
        durationMinutes: 30,
        priceAmount: 10000,
        isActive: true,
        sortOrder: 4,
      },
    ]);
    console.log("✅ 4 servicios insertados con éxito.");
  } else {
    console.log(`ℹ️ Ya existen ${serviceCount} servicios en la base de datos.`);
  }

  // 2. Seed de Ventanas de Disponibilidad (próximos 14 días laborales)
  console.log("📅 Verificando ventanas de atención para los próximos 14 días...");
  const now = new Date();
  const windowsToInsert = [];

  for (let i = 0; i < 14; i++) {
    const targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const dayOfWeek = targetDate.getDay(); // 0 = Domingo

    if (dayOfWeek === 0) {
      // Domingo cerrado
      continue;
    }

    // Horario laboral: 10:00 a 19:00 (hora local Buenos Aires / UTC-3)
    // 10:00 ART = 13:00 UTC, 19:00 ART = 22:00 UTC
    const windowStart = new Date(Date.UTC(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 13, 0, 0));
    const windowEnd = new Date(Date.UTC(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 22, 0, 0));

    windowsToInsert.push({
      startAt: windowStart,
      endAt: windowEnd,
      isBlocked: false,
      reason: "Horario laboral regular",
    });
  }

  if (windowsToInsert.length > 0) {
    // Insertamos solo las que no solapen
    await db.insert(availabilityWindows).values(windowsToInsert);
    console.log(`✅ ${windowsToInsert.length} ventanas de disponibilidad añadidas.`);
  }

  console.log("✨ Seed completado con éxito.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Error en el seed:", err);
  process.exit(1);
});

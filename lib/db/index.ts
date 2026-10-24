import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "./schema";

// Configuración de constructor de WebSockets para Node.js
if (!neonConfig.webSocketConstructor) {
  neonConfig.webSocketConstructor = ws;
}

export type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;
export type DrizzleTransaction = Parameters<
  Parameters<DrizzleDb["transaction"]>[0]
>[0];

let poolInstance: Pool | null = null;
let dbInstance: DrizzleDb | null = null;

/**
 * Obtiene la instancia de base de datos Drizzle con pool de WebSockets para transacciones ACID completas.
 * Lanza un error explicativo si DATABASE_URL no ha sido configurada en .env.local.
 */
export function getDb(): DrizzleDb {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL no está configurada. Por favor, define esta variable en tu archivo .env.local para conectar con Neon PostgreSQL."
    );
  }

  if (!dbInstance) {
    poolInstance = new Pool({ connectionString: databaseUrl });
    dbInstance = drizzle(poolInstance, { schema });
  }

  return dbInstance;
}

/**
 * Cliente Drizzle exportado para consultas directas y transacciones:
 * ej. await db.query.services.findMany()
 * ej. await db.transaction(async (tx) => { ... })
 */
export const db: DrizzleDb = new Proxy({} as DrizzleDb, {
  get(_target, prop, receiver) {
    const instance = getDb();
    return Reflect.get(instance, prop, receiver);
  },
});

export { schema };

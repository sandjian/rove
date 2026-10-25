import { NextResponse, type NextRequest } from "next/server";
import { processPendingEmails } from "@/lib/services/email-outbox";

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim();

  // Si no hay clave configurada en producción, rechazar por seguridad
  if (!cronSecret) {
    return process.env.NODE_ENV !== "production";
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const bearer = authHeader.slice(7).trim();
    if (bearer === cronSecret) {
      return true;
    }
  }

  const querySecret = request.nextUrl.searchParams.get("secret")?.trim();
  if (querySecret && querySecret === cronSecret) {
    return true;
  }

  return false;
}

async function handleCron(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: "No autorizado. Se requiere CRON_SECRET válido." },
      { status: 401 }
    );
  }

  try {
    const summary = await processPendingEmails({
      batchSize: 20,
      maxAttempts: 5,
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        claimed: summary.claimed,
        sent: summary.sent,
        retried: summary.retried,
        failed: summary.failed,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json(
      {
        success: false,
        error: `Error al procesar lote de outbox: ${message}`,
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return handleCron(request);
}

export async function POST(request: NextRequest) {
  return handleCron(request);
}

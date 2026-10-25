import { notFound } from "next/navigation";
import Link from "next/link";
import { getAppointmentByCancellationToken } from "@/lib/services/appointments/cancel-appointment";
import { CancelButton } from "./cancel-form";

export const instant = false;

const BUENOS_AIRES_TZ = "America/Argentina/Buenos_Aires";

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  timeZone: BUENOS_AIRES_TZ,
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export default async function CancelarReservaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  if (!token || token.trim().length !== 64) {
    notFound();
  }

  const appointment = await getAppointmentByCancellationToken(token.trim());

  if (!appointment) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full p-8 rounded-2xl bg-zinc-900/80 border border-zinc-800 text-center space-y-4 shadow-2xl">
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 flex items-center justify-center mx-auto text-xl font-bold">
            !
          </div>
          <h1 className="text-xl font-bold text-zinc-100 font-serif">Enlace No Válido o Expirado</h1>
          <p className="text-xs text-zinc-400 leading-relaxed">
            No encontramos ninguna reserva activa con este identificador. Por favor verificá que el enlace en tu correo esté completo.
          </p>
          <div className="pt-2">
            <Link
              href="/"
              className="inline-block px-5 py-2.5 rounded-xl bg-amber-400 text-zinc-950 font-bold text-xs hover:bg-amber-300 transition-colors"
            >
              Ir a Rove Barbería
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const formattedDate = dateFormatter.format(appointment.startAt);
  const isCancelled = appointment.status === "cancelled";

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-4 py-12 selection:bg-amber-400 selection:text-zinc-950">
      <div className="mb-6 text-center">
        <Link href="/" className="inline-flex flex-col items-center group">
          <span className="text-2xl font-black tracking-widest text-zinc-100 group-hover:text-amber-400 transition-colors uppercase font-serif">
            ROVE
          </span>
          <span className="text-[9px] tracking-[0.3em] text-amber-400 font-semibold uppercase">
            BARBERÍA
          </span>
        </Link>
      </div>

      <div className="max-w-lg w-full rounded-2xl bg-zinc-900/90 border border-zinc-800/80 shadow-2xl backdrop-blur-xl p-6 sm:p-8 space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-extrabold tracking-tight text-zinc-100 font-serif">
            Gestión de Reserva
          </h1>
          <p className="text-xs text-zinc-400">
            Detalles de tu cita en Rove Barbería
          </p>
        </div>

        {/* Estado actual */}
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800">
          <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Estado</span>
          {isCancelled ? (
            <span className="px-3 py-1 rounded-full bg-red-950/80 border border-red-500/40 text-red-300 text-xs font-semibold">
              Cancelada
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-semibold">
              Confirmada
            </span>
          )}
        </div>

        {/* Datos de la Cita */}
        <div className="p-4 rounded-xl bg-zinc-950/40 border border-zinc-800/80 space-y-3 text-sm">
          <div className="flex justify-between items-start pb-2.5 border-b border-zinc-800/60">
            <span className="text-xs text-zinc-400">Servicio:</span>
            <span className="font-semibold text-zinc-100 text-right">{appointment.serviceNameSnapshot}</span>
          </div>

          <div className="flex justify-between items-start pb-2.5 border-b border-zinc-800/60">
            <span className="text-xs text-zinc-400">Fecha y Hora:</span>
            <span className="font-semibold text-amber-400 text-right capitalize">{formattedDate} hs</span>
          </div>

          <div className="flex justify-between items-start pb-2.5 border-b border-zinc-800/60">
            <span className="text-xs text-zinc-400">Cliente:</span>
            <span className="font-medium text-zinc-200">{appointment.customerName}</span>
          </div>

          <div className="flex justify-between items-start pb-2.5 border-b border-zinc-800/60">
            <span className="text-xs text-zinc-400">Duración:</span>
            <span className="font-medium text-zinc-200">{appointment.serviceDurationSnapshot} min</span>
          </div>

          <div className="flex justify-between items-start">
            <span className="text-xs text-zinc-400">Precio:</span>
            <span className="font-bold text-zinc-100">
              ${appointment.servicePriceSnapshot.toLocaleString("es-AR")} ARS
            </span>
          </div>
        </div>

        {/* Acciones */}
        {isCancelled ? (
          <div className="text-center space-y-3 pt-2">
            <p className="text-xs text-zinc-400">
              Esta reserva ya fue cancelada. Si querés agendar un nuevo turno, podés hacerlo en nuestra web.
            </p>
            <Link
              href="/#reservar"
              className="inline-block px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold text-xs tracking-wide transition-colors"
            >
              Reservar Nuevo Turno
            </Link>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <CancelButton token={token.trim()} />
            <div className="text-center">
              <Link href="/" className="text-xs text-zinc-400 hover:text-zinc-200 underline">
                &larr; Volver al sitio principal
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

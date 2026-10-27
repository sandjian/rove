import { notFound } from "next/navigation";
import Link from "next/link";
import { getAppointmentByCancellationToken } from "@/lib/services/appointments/cancel-appointment";
import { CancelButton } from "./cancel-form";
import { Calendar, Clock, User, Scissors, DollarSign } from "lucide-react";

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
      <main className="min-h-screen bg-gradient-to-br from-[#faf6f0] via-[#f7f3ec] to-[#f2ede4] text-slate-800 flex items-center justify-center p-4 relative selection:bg-[#a9773c]/20 selection:text-slate-900">
        <div className="fixed top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-gradient-to-br from-[#a9773c]/15 via-[#c49257]/10 to-transparent blur-[120px] pointer-events-none -z-10" />
        <div className="fixed bottom-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-[#8d5e2a]/10 via-[#d4a86a]/15 to-transparent blur-[130px] pointer-events-none -z-10" />

        <div className="max-w-md w-full p-8 rounded-[2rem] bg-white/60 backdrop-blur-2xl border border-white/80 shadow-[0_16px_50px_rgba(169,119,60,0.12)] text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center mx-auto text-xl font-bold">
            !
          </div>
          <h1 className="text-xl font-bold text-slate-900">Enlace No Válido o Expirado</h1>
          <p className="text-xs text-slate-600 leading-relaxed">
            No encontramos ninguna reserva activa con este identificador. Por favor verificá que el enlace en tu correo esté completo.
          </p>
          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-gradient-to-r from-[#a9773c] to-[#c49257] hover:from-[#c49257] hover:to-[#a9773c] text-white font-semibold text-xs uppercase tracking-wider transition-all shadow-md shadow-[#a9773c]/30 hover:scale-[1.02] active:scale-95"
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
    <main className="min-h-screen bg-gradient-to-br from-[#faf6f0] via-[#f7f3ec] to-[#f2ede4] text-slate-800 flex flex-col items-center justify-center p-4 py-12 relative selection:bg-[#a9773c]/20 selection:text-slate-900">
      {/* Luces difusas ambiente camel */}
      <div className="fixed top-[-10%] right-[-5%] w-[550px] h-[550px] rounded-full bg-gradient-to-br from-[#a9773c]/15 via-[#c49257]/10 to-transparent blur-[130px] pointer-events-none -z-10" />
      <div className="fixed bottom-[-10%] left-[-5%] w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-[#8d5e2a]/10 via-[#d4a86a]/15 to-transparent blur-[140px] pointer-events-none -z-10" />

      {/* Header Logo */}
      <div className="mb-8 text-center">
        <Link href="/" className="inline-flex flex-col items-center group">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#a9773c] via-[#c49257] to-[#8d5e2a] flex items-center justify-center text-white shadow-sm shadow-[#a9773c]/40 font-bold text-xs group-hover:scale-105 transition-transform">
              R
            </div>
            <span className="font-bold text-lg tracking-[0.2em] text-slate-900 uppercase">
              ROVE
            </span>
          </div>
          <span className="text-[9px] tracking-[0.3em] text-[#a9773c] font-bold uppercase mt-1">
            BARBERÍA DE AUTOR
          </span>
        </Link>
      </div>

      <div className="max-w-lg w-full rounded-[2.5rem] bg-white/60 backdrop-blur-2xl border border-white/80 shadow-[0_20px_50px_rgba(169,119,60,0.12)] p-6 sm:p-10 space-y-6 relative overflow-hidden">
        {/* Brillo superior */}
        <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white to-transparent opacity-80" />

        <div className="text-center space-y-1.5">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Gestión de Reserva
          </h1>
          <p className="text-xs sm:text-sm text-slate-600">
            Detalles de tu turno en Rove Barbería
          </p>
        </div>

        {/* Estado actual */}
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/70 border border-white/80 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</span>
          {isCancelled ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-600 text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              Cancelada
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Confirmada
            </span>
          )}
        </div>

        {/* Datos de la Cita */}
        <div className="p-5 rounded-2xl bg-white/50 border border-white/70 space-y-3.5 text-sm shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-amber-900/10">
            <span className="text-xs text-slate-500 flex items-center gap-1.5">
              <Scissors className="w-3.5 h-3.5 text-[#a9773c]" />
              Servicio:
            </span>
            <span className="font-bold text-slate-900 text-right">{appointment.serviceNameSnapshot}</span>
          </div>

          <div className="flex items-center justify-between pb-3 border-b border-amber-900/10">
            <span className="text-xs text-slate-500 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#a9773c]" />
              Fecha y Hora:
            </span>
            <span className="font-bold text-[#a9773c] text-right capitalize">{formattedDate} hs</span>
          </div>

          <div className="flex items-center justify-between pb-3 border-b border-amber-900/10">
            <span className="text-xs text-slate-500 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-[#a9773c]" />
              Cliente:
            </span>
            <span className="font-medium text-slate-800">{appointment.customerName}</span>
          </div>

          <div className="flex items-center justify-between pb-3 border-b border-amber-900/10">
            <span className="text-xs text-slate-500 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#a9773c]" />
              Duración:
            </span>
            <span className="font-medium text-slate-800">{appointment.serviceDurationSnapshot} min</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-[#a9773c]" />
              Precio:
            </span>
            <span className="font-bold text-slate-900">
              ${appointment.servicePriceSnapshot.toLocaleString("es-AR")} ARS
            </span>
          </div>
        </div>

        {/* Acciones */}
        {isCancelled ? (
          <div className="text-center space-y-4 pt-2">
            <p className="text-xs text-slate-600 max-w-sm mx-auto">
              Esta reserva ya fue cancelada. Si querés agendar un nuevo turno, podés elegir tu próximo servicio en nuestra web.
            </p>
            <div>
              <Link
                href="/#reservar"
                className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-gradient-to-r from-[#a9773c] to-[#c49257] hover:from-[#c49257] hover:to-[#a9773c] text-white font-semibold text-xs uppercase tracking-wider transition-all shadow-md shadow-[#a9773c]/30 hover:scale-[1.02] active:scale-95"
              >
                Reservar Nuevo Turno
              </Link>
            </div>
            <div>
              <Link href="/" className="text-xs font-semibold text-slate-500 hover:text-[#a9773c] transition-colors">
                &larr; Volver al inicio
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <CancelButton token={token.trim()} />
            <div className="text-center">
              <Link href="/" className="text-xs font-semibold text-slate-500 hover:text-[#a9773c] transition-colors">
                &larr; Volver al inicio
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

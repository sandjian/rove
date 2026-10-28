import { getAdminKpisAction, getAdminAppointmentsAction } from "./actions";
import { AppointmentsList } from "./components/appointments-list";
import { RealtimeClock } from "./components/realtime-clock";
import { CapacityDonutChart } from "./components/capacity-donut-chart";
import { Sparkles, TrendingUp } from "lucide-react";

export const instant = false;

export const metadata = {
  title: "Dashboard — ROVE Barbería",
};

export default async function AdminDashboardPage() {
  const [kpisRes, apptsRes] = await Promise.all([
    getAdminKpisAction(),
    getAdminAppointmentsAction(),
  ]);

  const kpis = kpisRes.kpis || {
    completedTodayCount: 0,
    remainingTodayCount: 0,
    futureAppointmentsCount: 0,
    totalWeekCount: 0,
    totalMonthCount: 0,
    recentUnseenCount: 0,
  };

  // Fecha actual formateada en español
  const now = new Date();
  const formattedFullDate = new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now);

  // Capacidad de Reserva estimada: 13 franjas horarias operativas diarias (~26 turnos potenciales)
  const todayTotal = kpis.completedTodayCount + kpis.remainingTodayCount;
  const capacityPercentage = Math.min(100, Math.round((todayTotal / 20) * 100)) || 15;

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* SECCIÓN DE BIENVENIDA ASIMÉTRICA: TARJETA PRINCIPAL + CAPACIDAD DONUT */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-stretch">
        {/* Tarjeta Principal (col-span-3): Bienvenida, fecha y reloj en tiempo real */}
        <div className="lg:col-span-3 rounded-[2rem] bg-white/50 backdrop-blur-2xl border border-white/70 shadow-[0_8px_32px_0_rgba(169,119,60,0.06)] p-6 sm:p-8 flex flex-col justify-between space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#a9773c]">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Panel de Control</span>
              </div>
              <h1 className="font-krona text-2xl sm:text-3xl lg:text-4xl text-slate-900 tracking-tight">
                Buen día, Matías
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-normal capitalize">
                {formattedFullDate}
              </p>
            </div>

            {/* Reloj en tiempo real sin desajustes de hidratación */}
            <div>
              <RealtimeClock />
            </div>
          </div>

          {/* Resumen rápido al pie de la tarjeta */}
          <div className="flex flex-wrap items-center gap-3 pt-2 text-xs text-slate-600 border-t border-amber-900/10">
            <span className="inline-flex items-center gap-1.5 font-semibold text-slate-900">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              {todayTotal} {todayTotal === 1 ? "turno programado" : "turnos programados"} para hoy
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-500">
              {kpis.completedTodayCount} completados
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-500">
              {kpis.remainingTodayCount} pendientes
            </span>
          </div>
        </div>

        {/* Tarjeta de Capacidad (col-span-1): Gráfico tipo Donut con SVG puro */}
        <div className="lg:col-span-1 rounded-[2rem] bg-white/50 backdrop-blur-2xl border border-white/70 shadow-[0_8px_32px_0_rgba(169,119,60,0.06)] p-6 sm:p-8 flex flex-col justify-between items-center text-center space-y-4">
          <div className="w-full text-center">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Capacidad de Reserva
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Demanda de agenda hoy
            </p>
          </div>

          <div className="py-1">
            <CapacityDonutChart percentage={capacityPercentage} size={115} strokeWidth={11} />
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
            <TrendingUp className="w-3.5 h-3.5 text-[#a9773c]" />
            <span>{todayTotal} turnos agendados</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CALENDARIO INTERACTIVO (DAY, WEEK, LIST) */}
      {/* ========================================================================= */}
      <AppointmentsList initialAppointments={apptsRes.appointments || []} />
    </div>
  );
}

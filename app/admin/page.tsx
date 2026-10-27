import { getAdminKpisAction, getAdminAppointmentsAction } from "./actions";
import { AppointmentsList } from "./components/appointments-list";
import { Clock, CalendarCheck, TrendingUp } from "lucide-react";

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

  return (
    <div className="space-y-6">
      {/* ALERTA TIPOGRÁFICA MINIMALISTA (SIN BANNERS INVASIVOS NI FONDOS PESADOS) */}
      {kpis.recentUnseenCount > 0 && (
        <div className="flex items-center gap-2 text-xs text-slate-700 px-2 py-1">
          <span className="w-2 h-2 rounded-full bg-[#a9773c] animate-pulse" />
          <span className="font-semibold text-slate-900">
            {kpis.recentUnseenCount} {kpis.recentUnseenCount === 1 ? "nuevo turno registrado" : "nuevos turnos registrados"}
          </span>
          <span className="text-slate-500">en las últimas 24 horas.</span>
        </div>
      )}

      {/* PANEL DE KPIS DE IMPORTANCIA */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* KPI 1: Progreso del Día (Completados / Restantes) */}
        <div className="rounded-[2rem] bg-white/50 backdrop-blur-2xl border border-white/70 shadow-[0_8px_32px_0_rgba(169,119,60,0.06)] p-6 space-y-3">
          <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-[#a9773c]">
            <Clock className="w-4 h-4 stroke-[1.8]" />
          </div>
          <div>
            <div className="font-sans font-bold text-3xl font-normal text-slate-900 tracking-tight flex items-baseline gap-1.5">
              <span>{kpis.completedTodayCount}</span>
              <span className="text-slate-400 font-normal text-2xl">/</span>
              <span className="text-slate-600 font-semibold text-2xl">{kpis.remainingTodayCount}</span>
            </div>
            <div className="text-xs font-semibold text-slate-800 uppercase tracking-wider mt-1">
              Progreso del Día
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {kpis.completedTodayCount} completados • {kpis.remainingTodayCount} pendientes hoy
            </p>
          </div>
        </div>

        {/* KPI 2: Turnos Futuros (Excluyendo Hoy) */}
        <div className="rounded-[2rem] bg-white/50 backdrop-blur-2xl border border-white/70 shadow-[0_8px_32px_0_rgba(169,119,60,0.06)] p-6 space-y-3">
          <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-[#a9773c]">
            <CalendarCheck className="w-4 h-4 stroke-[1.8]" />
          </div>
          <div>
            <div className="font-sans font-bold text-3xl font-normal text-slate-900 tracking-tight">
              {kpis.futureAppointmentsCount}
            </div>
            <div className="text-xs font-semibold text-slate-800 uppercase tracking-wider mt-1">
              Turnos Futuros
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Agendados a partir de mañana
            </p>
          </div>
        </div>

        {/* KPI 3: Volumen (Semana y Mes) */}
        <div className="rounded-[2rem] bg-white/50 backdrop-blur-2xl border border-white/70 shadow-[0_8px_32px_0_rgba(169,119,60,0.06)] p-6 space-y-3">
          <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-[#a9773c]">
            <TrendingUp className="w-4 h-4 stroke-[1.8]" />
          </div>
          <div>
            <div className="font-sans font-bold text-3xl font-normal text-slate-900 tracking-tight flex items-baseline gap-2">
              <span>{kpis.totalWeekCount}</span>
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">sem</span>
              <span className="text-slate-300 font-light mx-0.5">•</span>
              <span className="text-slate-700 text-2xl font-bold">{kpis.totalMonthCount}</span>
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">mes</span>
            </div>
            <div className="text-xs font-semibold text-slate-800 uppercase tracking-wider mt-1">
              Volumen Registrado
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Total de reservas en la semana y el mes
            </p>
          </div>
        </div>
      </div>

      {/* LISTADO DE TURNOS / CRONOGRAMA */}
      <div className="rounded-[2rem] bg-white/50 backdrop-blur-2xl border border-white/70 shadow-[0_8px_32px_0_rgba(169,119,60,0.06)] p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
            <span className="w-2 h-2 rounded-full bg-[#a9773c]" />
            Próximos Turnos
          </div>
        </div>
        <AppointmentsList initialAppointments={apptsRes.appointments || []} />
      </div>
    </div>
  );
}

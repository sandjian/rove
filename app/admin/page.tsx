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
    todayAppointmentsCount: 0,
    todayProjectedRevenue: 0,
    weeklyOccupancyRate: 0,
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
        {/* KPI 1: Turnos para Hoy */}
        <div className="rounded-[2rem] bg-white/50 backdrop-blur-2xl border border-white/70 shadow-[0_8px_32px_0_rgba(169,119,60,0.06)] p-6 space-y-3">
          <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-[#a9773c]">
            <Clock className="w-4 h-4 stroke-[1.8]" />
          </div>
          <div>
            <div className="font-['Krona_One',sans-serif] text-3xl font-normal text-slate-900 tracking-tight">
              {kpis.todayAppointmentsCount}
            </div>
            <div className="text-xs font-semibold text-slate-800 uppercase tracking-wider mt-1">
              Turnos para Hoy
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Agenda activa en tiempo real
            </p>
          </div>
        </div>

        {/* KPI 2: Ingresos Proyectados */}
        <div className="rounded-[2rem] bg-white/50 backdrop-blur-2xl border border-white/70 shadow-[0_8px_32px_0_rgba(169,119,60,0.06)] p-6 space-y-3">
          <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-[#a9773c]">
            <TrendingUp className="w-4 h-4 stroke-[1.8]" />
          </div>
          <div>
            <div className="font-['Krona_One',sans-serif] text-3xl font-normal text-slate-900 tracking-tight">
              ${kpis.todayProjectedRevenue.toLocaleString("es-AR")}
            </div>
            <div className="text-xs font-semibold text-slate-800 uppercase tracking-wider mt-1">
              Ingresos del Día
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Cálculo sobre turnos confirmados
            </p>
          </div>
        </div>

        {/* KPI 3: Tasa de Ocupación Semanal */}
        <div className="rounded-[2rem] bg-white/50 backdrop-blur-2xl border border-white/70 shadow-[0_8px_32px_0_rgba(169,119,60,0.06)] p-6 space-y-3">
          <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-[#a9773c]">
            <CalendarCheck className="w-4 h-4 stroke-[1.8]" />
          </div>
          <div>
            <div className="font-['Krona_One',sans-serif] text-3xl font-normal text-slate-900 tracking-tight">
              {kpis.weeklyOccupancyRate}%
            </div>
            <div className="text-xs font-semibold text-slate-800 uppercase tracking-wider mt-1">
              Ocupación Semanal
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Capacidad ocupada en franjas
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

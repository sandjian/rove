import { getAdminWindowsAction } from "@/app/admin/actions";
import { AvailabilityManager } from "./availability-manager";

export const instant = false;

export const metadata = {
  title: "Agenda — ROVE Barbería",
};

export default async function AdminAgendaPage() {
  const windowsRes = await getAdminWindowsAction();

  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] bg-white/50 backdrop-blur-2xl border border-white/70 shadow-[0_8px_32px_0_rgba(169,119,60,0.06)] p-6 sm:p-8 space-y-6">
        <div>
          <h1 className="font-sans font-bold text-xl sm:text-2xl uppercase text-slate-900 tracking-tight">
            Configuración de Agenda
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 font-normal mt-1">
            Configurá los días habilitados, horarios de atención y bloqueos extraordinarios (almuerzos, capacitaciones, feriados).
          </p>
        </div>

        <AvailabilityManager initialWindows={windowsRes.windows || []} />
      </div>
    </div>
  );
}

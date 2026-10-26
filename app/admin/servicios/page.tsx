import { getAdminServicesAction } from "../actions";
import { ServicesEditor } from "./services-editor";

export const instant = false;

export const metadata = {
  title: "Servicios — ROVE Barbería",
};

export default async function AdminServiciosPage() {
  const res = await getAdminServicesAction();

  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] bg-white/50 backdrop-blur-2xl border border-white/70 shadow-[0_8px_32px_0_rgba(169,119,60,0.06)] p-6 sm:p-8 space-y-6">
        <div>
          <h1 className="font-['Krona_One',sans-serif] text-xl sm:text-2xl font-normal uppercase text-slate-900 tracking-tight">
            Catálogo de Servicios
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 font-normal mt-1">
            Ajustá los precios, duraciones en minutos y visibilidad de cada servicio en la página pública.
          </p>
        </div>

        <ServicesEditor initialServices={res.services || []} />
      </div>
    </div>
  );
}

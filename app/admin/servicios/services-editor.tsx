"use client";

import { useState } from "react";
import { ServiceItemDto, updateServiceAction } from "../actions";
import { Scissors, Clock, DollarSign, Check, AlertCircle, Eye, EyeOff } from "lucide-react";

interface ServicesEditorProps {
  initialServices: ServiceItemDto[];
}

interface ServiceFormState {
  id: string;
  name: string;
  priceAmount: number;
  durationMinutes: number;
  isActive: boolean;
  status: "idle" | "saving" | "saved" | "error";
  errorMessage?: string;
}

export function ServicesEditor({ initialServices }: ServicesEditorProps) {
  const [servicesState, setServicesState] = useState<ServiceFormState[]>(() =>
    initialServices.map((srv) => ({
      id: srv.id,
      name: srv.name,
      priceAmount: srv.priceAmount,
      durationMinutes: srv.durationMinutes,
      isActive: srv.isActive,
      status: "idle",
    }))
  );

  const handleFieldChange = (
    id: string,
    field: "name" | "priceAmount" | "durationMinutes" | "isActive",
    value: string | number | boolean
  ) => {
    setServicesState((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        return {
          ...item,
          [field]: value,
          status: "idle",
        };
      })
    );
  };

  const handleSave = async (service: ServiceFormState) => {
    // Validaciones básicas de cliente
    if (!service.name.trim()) {
      setServicesState((prev) =>
        prev.map((s) => (s.id === service.id ? { ...s, status: "error", errorMessage: "El nombre no puede estar vacío." } : s))
      );
      return;
    }

    if (service.priceAmount < 0) {
      setServicesState((prev) =>
        prev.map((s) => (s.id === service.id ? { ...s, status: "error", errorMessage: "El precio debe ser positivo." } : s))
      );
      return;
    }

    if (service.durationMinutes <= 0 || service.durationMinutes > 480) {
      setServicesState((prev) =>
        prev.map((s) => (s.id === service.id ? { ...s, status: "error", errorMessage: "Duración entre 1 y 480 min." } : s))
      );
      return;
    }

    setServicesState((prev) =>
      prev.map((s) => (s.id === service.id ? { ...s, status: "saving", errorMessage: undefined } : s))
    );

    const res = await updateServiceAction({
      id: service.id,
      name: service.name.trim(),
      priceAmount: Number(service.priceAmount),
      durationMinutes: Number(service.durationMinutes),
      isActive: service.isActive,
    });

    if (res.success) {
      setServicesState((prev) =>
        prev.map((s) => (s.id === service.id ? { ...s, status: "saved" } : s))
      );
      setTimeout(() => {
        setServicesState((prev) =>
          prev.map((s) => (s.id === service.id && s.status === "saved" ? { ...s, status: "idle" } : s))
        );
      }, 3000);
    } else {
      setServicesState((prev) =>
        prev.map((s) => (s.id === service.id ? { ...s, status: "error", errorMessage: res.error || "Error al guardar." } : s))
      );
    }
  };

  return (
    <div className="space-y-4">
      {/* Encabezado descriptivo con tipografía limpia */}
      <div className="flex items-center justify-between pb-3 border-b border-amber-900/10 text-xs text-slate-500 font-medium">
        <span>Catálogo Oficial ({servicesState.length} servicios disponibles)</span>
        <span className="hidden sm:inline">Los cambios impactan en tiempo real en la página pública</span>
      </div>

      <div className="space-y-3">
        {servicesState.map((service, index) => {
          return (
            <div
              key={service.id}
              className={`rounded-2xl border transition-all duration-300 p-5 ${
                service.isActive
                  ? "bg-white/60 backdrop-blur-xl border-white/80 shadow-[0_4px_20px_0_rgba(169,119,60,0.04)] hover:shadow-[0_8px_30px_0_rgba(169,119,60,0.08)]"
                  : "bg-white/30 backdrop-blur-md border-slate-200/50 opacity-60"
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Columna Izquierda: Identificador & Nombre */}
                <div className="flex-1 flex items-center gap-3.5">
                  <span className="font-['Krona_One',sans-serif] text-xs text-slate-400 select-none">
                    0{index + 1}
                  </span>

                  <div className="flex-1">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Nombre del Servicio
                    </label>
                    <input
                      type="text"
                      value={service.name}
                      onChange={(e) => handleFieldChange(service.id, "name", e.target.value)}
                      placeholder="Ej. Corte Clásico"
                      className="w-full bg-white/80 border border-amber-900/10 focus:border-[#a9773c]/50 focus:ring-2 focus:ring-[#a9773c]/10 rounded-xl px-3.5 py-2 text-sm font-semibold text-slate-800 transition-all outline-none"
                    />
                  </div>
                </div>

                {/* Columna Central: Duración y Precio */}
                <div className="grid grid-cols-2 sm:grid-cols-2 gap-3 lg:w-80">
                  {/* Duración */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Duración (min)
                    </label>
                    <div className="relative">
                      <Clock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="number"
                        min={1}
                        max={480}
                        step={5}
                        value={service.durationMinutes}
                        onChange={(e) =>
                          handleFieldChange(service.id, "durationMinutes", parseInt(e.target.value) || 0)
                        }
                        className="w-full bg-white/80 border border-amber-900/10 focus:border-[#a9773c]/50 focus:ring-2 focus:ring-[#a9773c]/10 rounded-xl pl-8 pr-3 py-2 text-sm font-medium text-slate-800 transition-all outline-none"
                      />
                    </div>
                  </div>

                  {/* Precio */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Precio (ARS $)
                    </label>
                    <div className="relative">
                      <span className="text-xs text-slate-400 font-semibold absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        $
                      </span>
                      <input
                        type="number"
                        min={0}
                        step={100}
                        value={service.priceAmount}
                        onChange={(e) =>
                          handleFieldChange(service.id, "priceAmount", parseInt(e.target.value) || 0)
                        }
                        className="w-full bg-white/80 border border-amber-900/10 focus:border-[#a9773c]/50 focus:ring-2 focus:ring-[#a9773c]/10 rounded-xl pl-7 pr-3 py-2 text-sm font-['Krona_One',sans-serif] text-slate-900 transition-all outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Columna Derecha: Toggle de Activo, Estado Guardado & Botón Guardar */}
                <div className="flex items-center justify-between lg:justify-end gap-3 pt-2 lg:pt-0 border-t lg:border-t-0 border-amber-900/5">
                  {/* Switch Sutil de Visibilidad */}
                  <button
                    type="button"
                    onClick={() => handleFieldChange(service.id, "isActive", !service.isActive)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-white/80 transition-all"
                    title={service.isActive ? "Desactivar servicio" : "Activar servicio"}
                  >
                    {service.isActive ? (
                      <>
                        <Eye className="w-3.5 h-3.5 text-[#a9773c]" />
                        <span className="text-[11px] font-semibold text-slate-700">Activo</span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-[11px] text-slate-400">Oculto</span>
                      </>
                    )}
                  </button>

                  {/* Estado Visual Tipográfico (ZERO-BADGE POLICY) */}
                  <div className="w-24 text-right">
                    {service.status === "saving" && (
                      <span className="text-xs font-medium text-[#a9773c] animate-pulse flex items-center justify-end gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#a9773c] animate-ping" />
                        Guardando...
                      </span>
                    )}
                    {service.status === "saved" && (
                      <span className="text-xs font-semibold text-emerald-600 flex items-center justify-end gap-1">
                        <Check className="w-3.5 h-3.5" />
                        Guardado
                      </span>
                    )}
                    {service.status === "error" && (
                      <span className="text-[11px] font-medium text-rose-600 flex items-center justify-end gap-1" title={service.errorMessage}>
                        <AlertCircle className="w-3.5 h-3.5" />
                        Error
                      </span>
                    )}
                  </div>

                  {/* Botón Guardar */}
                  <button
                    type="button"
                    disabled={service.status === "saving"}
                    onClick={() => handleSave(service)}
                    className="rounded-xl bg-gradient-to-r from-[#a9773c] via-[#c49257] to-[#8d5e2a] text-white font-semibold text-xs tracking-wider uppercase px-4 py-2 shadow-sm shadow-[#a9773c]/30 hover:scale-[1.02] active:scale-95 transition-all duration-200 disabled:opacity-50"
                  >
                    Guardar
                  </button>
                </div>
              </div>

              {/* Mensaje de error expandido si existe */}
              {service.errorMessage && service.status === "error" && (
                <p className="text-[11px] text-rose-600 mt-2 font-medium">
                  {service.errorMessage}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

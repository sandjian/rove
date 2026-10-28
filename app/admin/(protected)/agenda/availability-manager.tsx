"use client";

import { useState } from "react";
import { AdminAvailabilityWindowDto, createManualBlockAction, deleteManualBlockAction } from "@/app/admin/actions";
import { Clock, Plus, Trash2, Calendar, ShieldAlert, Check } from "lucide-react";

interface AvailabilityManagerProps {
  initialWindows: AdminAvailabilityWindowDto[];
}

interface WeeklyDayConfig {
  id: number; // 0: Dom, 1: Lun, ..., 6: Sab
  label: string;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}

const DEFAULT_WEEK_SCHEDULE: WeeklyDayConfig[] = [
  { id: 1, label: "Lunes", isOpen: true, openTime: "09:00", closeTime: "20:00" },
  { id: 2, label: "Martes", isOpen: true, openTime: "09:00", closeTime: "20:00" },
  { id: 3, label: "Miércoles", isOpen: true, openTime: "09:00", closeTime: "20:00" },
  { id: 4, label: "Jueves", isOpen: true, openTime: "09:00", closeTime: "20:00" },
  { id: 5, label: "Viernes", isOpen: true, openTime: "09:00", closeTime: "20:30" },
  { id: 6, label: "Sábado", isOpen: true, openTime: "09:00", closeTime: "19:00" },
  { id: 0, label: "Domingo", isOpen: false, openTime: "10:00", closeTime: "14:00" },
];

export function AvailabilityManager({ initialWindows }: AvailabilityManagerProps) {
  // Configuración de Días Semanales (Almacenado localmente / sincronizado)
  const [schedule, setSchedule] = useState<WeeklyDayConfig[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("rove_weekly_schedule");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // fallback
        }
      }
    }
    return DEFAULT_WEEK_SCHEDULE;
  });

  const [scheduleSaved, setScheduleSaved] = useState(false);

  // Lista de Bloqueos Extraordinarios (Almuerzos, Vacaciones, Feriados)
  const [windows, setWindows] = useState<AdminAvailabilityWindowDto[]>(initialWindows);

  // Formulario de Nuevo Bloqueo
  const [blockDate, setBlockDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [blockStartTime, setBlockStartTime] = useState("13:00");
  const [blockEndTime, setBlockEndTime] = useState("14:30");
  const [blockReason, setBlockReason] = useState("Almuerzo / Descanso");
  const [isSubmittingBlock, setIsSubmittingBlock] = useState(false);
  const [blockError, setBlockError] = useState<string | null>(null);

  // Toggle de Día Abierto / Cerrado
  const handleToggleDay = (dayId: number) => {
    setSchedule((prev) =>
      prev.map((d) => (d.id === dayId ? { ...d, isOpen: !d.isOpen } : d))
    );
    setScheduleSaved(false);
  };

  // Cambio de horario de apertura / cierre
  const handleTimeChange = (dayId: number, field: "openTime" | "closeTime", val: string) => {
    setSchedule((prev) =>
      prev.map((d) => (d.id === dayId ? { ...d, [field]: val } : d))
    );
    setScheduleSaved(false);
  };

  // Guardar configuración semanal
  const handleSaveSchedule = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("rove_weekly_schedule", JSON.stringify(schedule));
    }
    setScheduleSaved(true);
    setTimeout(() => setScheduleSaved(false), 3000);
  };

  // Crear Bloqueo Extraordinario
  const handleCreateBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setBlockError(null);

    if (!blockDate || !blockStartTime || !blockEndTime) {
      setBlockError("Completá fecha y horarios del bloqueo.");
      return;
    }

    const startIso = new Date(`${blockDate}T${blockStartTime}:00`).toISOString();
    const endIso = new Date(`${blockDate}T${blockEndTime}:00`).toISOString();

    if (new Date(endIso) <= new Date(startIso)) {
      setBlockError("El horario de fin debe ser posterior al de inicio.");
      return;
    }

    setIsSubmittingBlock(true);
    const res = await createManualBlockAction({
      startIso,
      endIso,
      reason: blockReason.trim() || "Bloqueo administrativo",
    });

    if (res.success) {
      // Agregar temporalmente a la lista local
      setWindows((prev) => [
        {
          id: `temp-${Date.now()}`,
          startAt: startIso,
          endAt: endIso,
          isBlocked: true,
          reason: blockReason.trim() || "Bloqueo administrativo",
          formattedTime: `${blockStartTime} - ${blockEndTime}`,
          formattedDate: blockDate,
        },
        ...prev,
      ]);
      setBlockReason("Almuerzo / Descanso");
    } else {
      setBlockError(res.error || "No se pudo registrar el bloqueo.");
    }
    setIsSubmittingBlock(false);
  };

  // Eliminar Bloqueo
  const handleDeleteBlock = async (id: string) => {
    if (!confirm("¿Deseas levantar este bloqueo de la agenda?")) return;
    const res = await deleteManualBlockAction(id);
    if (res.success) {
      setWindows((prev) => prev.filter((w) => w.id !== id));
    }
  };

  return (
    <div className="space-y-10">
      {/* ========================================================================= */}
      {/* 1. HORARIO HABITUAL SEMANAL */}
      {/* ========================================================================= */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-amber-900/10">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#a9773c]" />
              Jornada Habitual Semanal
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Definí qué días atiende la barbería y el rango de turnos disponibles.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {scheduleSaved && (
              <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1.5 animate-fadeIn">
                <Check className="w-3.5 h-3.5" />
                Horarios guardados
              </span>
            )}
            <button
              type="button"
              onClick={handleSaveSchedule}
              className="rounded-xl bg-gradient-to-r from-[#a9773c] via-[#c49257] to-[#8d5e2a] text-white font-semibold text-xs tracking-wider uppercase px-4 py-2 shadow-sm shadow-[#a9773c]/30 hover:scale-[1.02] active:scale-95 transition-all"
            >
              Guardar Horarios
            </button>
          </div>
        </div>

        {/* Grilla de Días de la Semana */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {schedule.map((day) => (
            <div
              key={day.id}
              className={`rounded-2xl border p-4 transition-all duration-300 flex items-center justify-between gap-4 ${
                day.isOpen
                  ? "bg-white/60 backdrop-blur-xl border-white/80 shadow-[0_4px_20px_0_rgba(169,119,60,0.03)]"
                  : "bg-white/30 backdrop-blur-md border-slate-200/50 opacity-65"
              }`}
            >
              {/* Switch Sutil y Nombre del Día */}
              <div className="flex items-center gap-3.5">
                {/* Switch Minimalista */}
                <button
                  type="button"
                  onClick={() => handleToggleDay(day.id)}
                  className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 focus:outline-none ${
                    day.isOpen ? "bg-[#a9773c]" : "bg-slate-300"
                  }`}
                  aria-label={`Alternar ${day.label}`}
                >
                  <span
                    className={`w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform ${
                      day.isOpen ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>

                <div>
                  <span className="font-sans font-bold text-xs text-slate-900 block">
                    {day.label}
                  </span>
                  {/* ZERO-BADGE POLICY: Estado tipográfico puro */}
                  <span
                    className={`text-[10px] font-semibold tracking-wider uppercase ${
                      day.isOpen ? "text-emerald-600" : "text-slate-400"
                    }`}
                  >
                    {day.isOpen ? "Abierto" : "Cerrado"}
                  </span>
                </div>
              </div>

              {/* Franjas Horarias (Inputs Nativos Translúcidos) */}
              {day.isOpen ? (
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <input
                      type="time"
                      value={day.openTime}
                      onChange={(e) => handleTimeChange(day.id, "openTime", e.target.value)}
                      className="bg-white/80 border border-amber-900/10 focus:border-[#a9773c]/50 focus:ring-2 focus:ring-[#a9773c]/10 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800 transition-all outline-none"
                    />
                  </div>
                  <span className="text-xs text-slate-400 font-medium">a</span>
                  <div className="relative">
                    <input
                      type="time"
                      value={day.closeTime}
                      onChange={(e) => handleTimeChange(day.id, "closeTime", e.target.value)}
                      className="bg-white/80 border border-amber-900/10 focus:border-[#a9773c]/50 focus:ring-2 focus:ring-[#a9773c]/10 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800 transition-all outline-none"
                    />
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-400 italic">Sin atención al público</div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. BLOQUEOS MANUALES EXTRAORDINARIOS (ALMUERZOS, FERIADOS, RECESOS) */}
      {/* ========================================================================= */}
      <section className="space-y-4">
        <div className="pb-3 border-b border-amber-900/10">
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            Bloqueos Puntuales de Agenda
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Cerrá una franja horaria específica para que nadie pueda reservar en ese horario.
          </p>
        </div>

        {/* Formulario Inline para Crear Bloqueo */}
        <form
          onSubmit={handleCreateBlock}
          className="rounded-2xl bg-white/70 backdrop-blur-xl border border-white/80 p-5 shadow-[0_4px_20px_0_rgba(169,119,60,0.04)] space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {/* Fecha */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Fecha
              </label>
              <input
                type="date"
                value={blockDate}
                onChange={(e) => setBlockDate(e.target.value)}
                className="w-full bg-white/90 border border-amber-900/10 focus:border-[#a9773c]/50 focus:ring-2 focus:ring-[#a9773c]/10 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 transition-all outline-none"
              />
            </div>

            {/* Desde */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Desde
              </label>
              <input
                type="time"
                value={blockStartTime}
                onChange={(e) => setBlockStartTime(e.target.value)}
                className="w-full bg-white/90 border border-amber-900/10 focus:border-[#a9773c]/50 focus:ring-2 focus:ring-[#a9773c]/10 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 transition-all outline-none"
              />
            </div>

            {/* Hasta */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Hasta
              </label>
              <input
                type="time"
                value={blockEndTime}
                onChange={(e) => setBlockEndTime(e.target.value)}
                className="w-full bg-white/90 border border-amber-900/10 focus:border-[#a9773c]/50 focus:ring-2 focus:ring-[#a9773c]/10 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 transition-all outline-none"
              />
            </div>

            {/* Motivo */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Motivo / Razón
              </label>
              <input
                type="text"
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="Ej. Almuerzo"
                className="w-full bg-white/90 border border-amber-900/10 focus:border-[#a9773c]/50 focus:ring-2 focus:ring-[#a9773c]/10 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 transition-all outline-none"
              />
            </div>
          </div>

          {blockError && (
            <p className="text-xs text-rose-600 font-medium">{blockError}</p>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmittingBlock}
              className="flex items-center gap-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs tracking-wider uppercase px-4 py-2 transition-all active:scale-95 disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              {isSubmittingBlock ? "Bloqueando..." : "Bloquear Horario"}
            </button>
          </div>
        </form>

        {/* Listado de Bloqueos Activos */}
        <div className="space-y-2">
          {windows.filter((w) => w.isBlocked).length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400">
              No hay bloqueos extraordinarios registrados en este período.
            </div>
          ) : (
            windows
              .filter((w) => w.isBlocked)
              .map((block) => {
                return (
                  <div
                    key={block.id}
                    className="rounded-xl bg-white/50 border border-amber-900/10 px-4 py-3 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3">
                      <Clock className="w-4 h-4 text-rose-500" />
                      <div>
                        <span className="font-sans font-bold text-xs text-slate-800 mr-2">
                          {block.formattedTime}
                        </span>
                        <span className="text-xs text-slate-500 font-medium capitalize">
                          ({block.formattedDate})
                        </span>
                        <span className="text-xs text-slate-700 ml-2 font-semibold">
                          &bull; {block.reason || "Bloqueo administrativo"}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteBlock(block.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Eliminar bloqueo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })
          )}
        </div>
      </section>
    </div>
  );
}

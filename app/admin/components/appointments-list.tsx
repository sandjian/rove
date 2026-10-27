"use client";

import { useState, useMemo } from "react";
import { AdminAppointmentDto, completeAppointmentAdminAction, cancelAppointmentAdminAction } from "../actions";
import { Phone, Check, X, AlertTriangle, List, LayoutGrid, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock } from "lucide-react";

export function AppointmentsList({ initialAppointments }: { initialAppointments: AdminAppointmentDto[] }) {
  const [appointments, setAppointments] = useState(initialAppointments);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [appointmentToCancel, setAppointmentToCancel] = useState<AdminAppointmentDto | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "timeline">("list");

  // Fecha seleccionada para la Línea de Tiempo (por defecto hoy en Buenos Aires)
  const [selectedTimelineDate, setSelectedTimelineDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });

  const handleComplete = async (id: string) => {
    setLoadingId(id);
    const res = await completeAppointmentAdminAction(id);
    if (res.success) {
      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: "completed" as const } : a))
      );
    }
    setLoadingId(null);
  };

  const handleConfirmCancel = async () => {
    if (!appointmentToCancel) return;
    const id = appointmentToCancel.id;
    setLoadingId(id);
    const res = await cancelAppointmentAdminAction(id);
    if (res.success) {
      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: "cancelled" as const } : a))
      );
      setAppointmentToCancel(null);
    }
    setLoadingId(null);
  };

  // Franjas de horas de la barbería: 09:00 a 20:00 (11 horas operativas)
  const timelineHours = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => 9 + i); // 9 a 20 inclusive
  }, []);

  // Filtrar y proyectar citas correspondientes a la fecha seleccionada en la timeline
  const timelineAppointments = useMemo(() => {
    return appointments.filter((appt) => {
      // Comparar YYYY-MM-DD
      const apptDate = appt.startAt.slice(0, 10);
      return apptDate === selectedTimelineDate && appt.status !== "cancelled";
    });
  }, [appointments, selectedTimelineDate]);

  // Navegar días en la timeline
  const changeTimelineDate = (deltaDays: number) => {
    const [y, m, d] = selectedTimelineDate.split("-").map(Number);
    const current = new Date(y, m - 1, d);
    current.setDate(current.getDate() + deltaDays);
    const nextIso = current.toISOString().split("T")[0];
    setSelectedTimelineDate(nextIso);
  };

  const formattedSelectedDate = useMemo(() => {
    const [y, m, d] = selectedTimelineDate.split("-").map(Number);
    const dateObj = new Date(y, m - 1, d);
    return new Intl.DateTimeFormat("es-AR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(dateObj);
  }, [selectedTimelineDate]);

  return (
    <div className="space-y-6">
      {/* CABECERA CON CONTROLES Y TOGGLE MINIMALISTA LISTA / LÍNEA DE TIEMPO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-amber-900/10">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
            Vista del Cronograma
          </span>
          <span className="text-slate-300">•</span>
          <span className="text-xs text-slate-500 font-medium">
            {appointments.length} {appointments.length === 1 ? "turno cargado" : "turnos cargados"}
          </span>
        </div>

        {/* Switch Minimalista */}
        <div className="inline-flex items-center p-1 rounded-xl bg-slate-200/50 backdrop-blur-md border border-slate-200/70 shadow-inner">
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
              viewMode === "list"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <List className="w-3.5 h-3.5" />
            <span>Lista</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode("timeline")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
              viewMode === "timeline"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Línea de Tiempo</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VISTA 1: LISTADO HABITUAL CON ZERO-BADGE */}
      {/* ========================================================================= */}
      {viewMode === "list" && (
        <div className="divide-y divide-amber-900/10">
          {appointments.length === 0 ? (
            <div className="text-center py-12 text-xs text-slate-500">
              No hay turnos registrados en este período.
            </div>
          ) : (
            appointments.map((appt) => {
              return (
                <div key={appt.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* Horario y Servicio */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="font-sans font-bold text-sm text-slate-900">
                        {appt.formattedTime} hs
                      </span>
                      <span className="text-xs text-slate-500 font-medium capitalize">
                        {appt.formattedDate}
                      </span>

                      {/* ZERO-BADGE POLICY: Estado tipográfico puro sin componentes Badge */}
                      {appt.status === "confirmed" && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Confirmado
                        </span>
                      )}

                      {appt.status === "cancelled" && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-500">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                          Cancelado
                        </span>
                      )}

                      {appt.status === "completed" && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                          Completado
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <span className="font-medium text-slate-800">{appt.serviceName}</span>
                      <span>•</span>
                      <span>{appt.durationMinutes} min</span>
                      <span>•</span>
                      <span className="font-semibold text-slate-900">
                        ${appt.priceAmount.toLocaleString("es-AR")}
                      </span>
                    </div>
                  </div>

                  {/* Cliente y Acciones Rápidas */}
                  <div className="flex items-center justify-between sm:justify-end gap-6">
                    <div className="text-right">
                      <div className="text-xs font-semibold text-slate-900">{appt.customerName}</div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2 justify-end">
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" /> {appt.customerPhone}
                        </span>
                      </div>
                    </div>

                    {/* Acciones */}
                    {appt.status === "confirmed" && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={loadingId === appt.id}
                          onClick={() => handleComplete(appt.id)}
                          className="p-2 rounded-xl text-emerald-600 hover:bg-emerald-50 transition-colors"
                          title="Marcar como Completado"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          disabled={loadingId === appt.id}
                          onClick={() => setAppointmentToCancel(appt)}
                          className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Cancelar Turno"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VISTA 2: DAILY TIMELINE / GANTT DIARIO CON HORAS KRONA ONE */}
      {/* ========================================================================= */}
      {viewMode === "timeline" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Selector de día para la timeline */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/60 border border-white/80 shadow-xs">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-[#a9773c]" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800 capitalize">
                {formattedSelectedDate}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => changeTimelineDate(-1)}
                className="w-8 h-8 rounded-xl bg-white/80 hover:bg-white border border-slate-200 text-slate-600 flex items-center justify-center transition-all shadow-xs"
                title="Día anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  const today = new Date().toISOString().split("T")[0];
                  setSelectedTimelineDate(today);
                }}
                className="px-3 py-1.5 rounded-xl bg-white/80 hover:bg-white border border-slate-200 text-[11px] font-semibold text-slate-700 transition-all shadow-xs"
              >
                Hoy
              </button>

              <button
                type="button"
                onClick={() => changeTimelineDate(1)}
                className="w-8 h-8 rounded-xl bg-white/80 hover:bg-white border border-slate-200 text-slate-600 flex items-center justify-center transition-all shadow-xs"
                title="Día siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Grilla Gantt Diaria Glassmorphism */}
          <div className="rounded-[2rem] bg-white/40 backdrop-blur-xl border border-white/70 shadow-sm p-4 sm:p-6 overflow-x-auto">
            <div className="min-w-[700px] space-y-3">
              {/* Encabezado de Horas en tipografía destacada */}
              <div className="grid grid-cols-12 gap-1 pb-3 border-b border-amber-900/10 text-center select-none">
                {timelineHours.map((hour) => (
                  <div key={hour} className="text-center">
                    <span className="font-sans font-bold text-xs text-slate-700 tracking-wide">
                      {hour.toString().padStart(2, "0")}:00
                    </span>
                  </div>
                ))}
              </div>

              {/* Pista de tiempo / Contenedor de bloques proporcionales */}
              <div className="relative min-h-[300px] rounded-2xl bg-white/30 border border-slate-200/50 p-2 overflow-hidden">
                {/* Líneas guía verticales horarias de fondo */}
                <div className="absolute inset-0 grid grid-cols-12 pointer-events-none">
                  {timelineHours.map((hour) => (
                    <div
                      key={hour}
                      className="border-r border-slate-200/30 h-full first:border-l-0 last:border-r-0"
                    />
                  ))}
                </div>

                {/* Render de Bloques de Turnos */}
                {timelineAppointments.length === 0 ? (
                  <div className="relative z-10 flex flex-col items-center justify-center h-48 text-center text-slate-400 space-y-1">
                    <Clock className="w-6 h-6 stroke-[1.5] text-slate-300" />
                    <p className="text-xs font-medium">No hay turnos activos para este día.</p>
                  </div>
                ) : (
                  <div className="relative z-10 space-y-2 py-2">
                    {timelineAppointments.map((appt) => {
                      const startDate = new Date(appt.startAt);
                      const startHour = startDate.getHours();
                      const startMinutes = startDate.getMinutes();

                      // Convertir hora a porcentaje relativo sobre el rango 09:00 - 21:00 (12 horas = 720 minutos)
                      const timelineStartMinutes = 9 * 60; // 540 min
                      const apptStartMinutes = startHour * 60 + startMinutes;
                      const offsetMinutes = Math.max(0, apptStartMinutes - timelineStartMinutes);

                      const leftPercent = Math.max(0, Math.min(100, (offsetMinutes / 720) * 100));
                      const widthPercent = Math.max(6, Math.min(100 - leftPercent, (appt.durationMinutes / 720) * 100));

                      const isCompleted = appt.status === "completed";

                      return (
                        <div
                          key={appt.id}
                          style={{
                            marginLeft: `${leftPercent}%`,
                            width: `${widthPercent}%`,
                          }}
                          className={`group relative rounded-xl p-2.5 transition-all duration-300 backdrop-blur-md border shadow-sm hover:shadow-md hover:scale-[1.01] ${
                            isCompleted
                              ? "bg-slate-100/90 border-slate-300 text-slate-600"
                              : "bg-gradient-to-r from-amber-500/15 via-[#a9773c]/20 to-amber-600/15 border-[#a9773c]/40 text-slate-900"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-sans font-bold text-[11px] truncate">
                              {appt.formattedTime} hs • {appt.customerName}
                            </span>
                            {appt.status === "confirmed" && (
                              <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 shrink-0">
                                <button
                                  type="button"
                                  disabled={loadingId === appt.id}
                                  onClick={() => handleComplete(appt.id)}
                                  className="w-5 h-5 rounded-md bg-white/80 hover:bg-white text-emerald-600 flex items-center justify-center shadow-xs"
                                  title="Completar"
                                >
                                  <Check className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  disabled={loadingId === appt.id}
                                  onClick={() => setAppointmentToCancel(appt)}
                                  className="w-5 h-5 rounded-md bg-white/80 hover:bg-white text-rose-600 flex items-center justify-center shadow-xs"
                                  title="Cancelar"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>

                          <div className="text-[10px] text-slate-600 truncate mt-0.5 flex items-center gap-1.5">
                            <span className="font-medium">{appt.serviceName}</span>
                            <span>•</span>
                            <span>{appt.durationMinutes}m</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Leyenda al pie de la línea de tiempo */}
              <div className="flex items-center justify-end gap-5 pt-1 text-[11px] text-slate-500 font-medium">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#a9773c]/40 border border-[#a9773c]" />
                  Turno Confirmado
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-slate-200 border border-slate-300" />
                  Turno Completado
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN DE CANCELACIÓN (ADMIN) */}
      {appointmentToCancel && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-admin-cancel-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          {/* Backdrop con blur orgánico camel */}
          <div
            onClick={() => !loadingId && setAppointmentToCancel(null)}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-md transition-opacity duration-300 animate-in fade-in"
          />

          {/* Tarjeta glassmorphism */}
          <div className="relative w-full max-w-md rounded-[2rem] bg-white/95 backdrop-blur-2xl border border-white/90 shadow-[0_20px_60px_-15px_rgba(169,119,60,0.25)] p-6 sm:p-8 space-y-6 animate-in zoom-in-95 fade-in duration-200 z-10 text-slate-800">
            <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white to-transparent opacity-80" />

            <button
              type="button"
              onClick={() => setAppointmentToCancel(null)}
              disabled={Boolean(loadingId)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors disabled:opacity-50"
              aria-label="Cerrar modal"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex flex-col items-center text-center space-y-3 pt-2">
              <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 flex items-center justify-center shadow-inner">
                <AlertTriangle className="w-7 h-7 text-rose-500" />
              </div>
              <div className="space-y-1">
                <h3 id="modal-admin-cancel-title" className="text-xl font-bold tracking-tight text-slate-900">
                  ¿Cancelar este turno?
                </h3>
                <p className="text-xs sm:text-[13px] text-slate-600 leading-relaxed max-w-xs mx-auto">
                  Se cancelará el turno de <strong className="text-slate-900">{appointmentToCancel.customerName}</strong> ({appointmentToCancel.serviceName}) y se liberará la agenda.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-900/10 text-xs text-slate-600 space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Horario:</span>
                <span className="font-semibold text-slate-900 capitalize">{appointmentToCancel.formattedDate} a las {appointmentToCancel.formattedTime} hs</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Teléfono:</span>
                <span className="font-semibold text-slate-900">{appointmentToCancel.customerPhone}</span>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => setAppointmentToCancel(null)}
                disabled={Boolean(loadingId)}
                className="w-full sm:w-1/2 py-3 px-4 rounded-xl bg-slate-100/80 hover:bg-slate-200/80 text-slate-700 font-semibold text-xs uppercase tracking-wider transition-all duration-200 border border-slate-200/60 active:scale-95 disabled:opacity-50"
              >
                Volver
              </button>

              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={Boolean(loadingId)}
                className="w-full sm:w-1/2 py-3 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-600 text-white font-semibold text-xs uppercase tracking-wider transition-all duration-200 shadow-md shadow-rose-600/30 hover:scale-[1.02] active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loadingId ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Cancelando...</span>
                  </>
                ) : (
                  <span>Confirmar Cancelación</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

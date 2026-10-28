"use client";

import { useState, useMemo, useCallback } from "react";
import { AdminAppointmentDto, completeAppointmentAdminAction, cancelAppointmentAdminAction } from "@/app/admin/actions";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  List,
  Grid3x3,
  Phone,
  Check,
  X,
  AlertTriangle,
  Scissors,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Horas operativas de la barbería: 08:00 a 21:00 inclusive (14 horas)
const OPERATIONAL_HOURS = Array.from({ length: 14 }, (_, i) => 8 + i);

export function AppointmentsList({ initialAppointments }: { initialAppointments: AdminAppointmentDto[] }) {
  const [appointments, setAppointments] = useState<AdminAppointmentDto[]>(initialAppointments);
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [view, setView] = useState<"day" | "week" | "list">("day");

  // Estado para modal de detalles / visualización
  const [selectedAppointment, setSelectedAppointment] = useState<AdminAppointmentDto | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Estado para modal de confirmación de cancelación
  const [appointmentToCancel, setAppointmentToCancel] = useState<AdminAppointmentDto | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Completar cita
  const handleComplete = async (id: string) => {
    setLoadingId(id);
    const res = await completeAppointmentAdminAction(id);
    if (res.success) {
      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: "completed" as const } : a))
      );
      if (selectedAppointment?.id === id) {
        setSelectedAppointment((prev) => (prev ? { ...prev, status: "completed" } : null));
      }
    }
    setLoadingId(null);
  };

  // Confirmar cancelación
  const handleConfirmCancel = async () => {
    if (!appointmentToCancel) return;
    const id = appointmentToCancel.id;
    setLoadingId(id);
    const res = await cancelAppointmentAdminAction(id);
    if (res.success) {
      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: "cancelled" as const } : a))
      );
      if (selectedAppointment?.id === id) {
        setSelectedAppointment((prev) => (prev ? { ...prev, status: "cancelled" } : null));
      }
      setAppointmentToCancel(null);
    }
    setLoadingId(null);
  };

  // Navegación de fecha según vista
  const navigateDate = useCallback(
    (direction: "prev" | "next") => {
      setCurrentDate((prev) => {
        const next = new Date(prev);
        if (view === "week") {
          next.setDate(prev.getDate() + (direction === "next" ? 7 : -7));
        } else {
          // day o list
          next.setDate(prev.getDate() + (direction === "next" ? 1 : -1));
        }
        return next;
      });
    },
    [view]
  );

  const goToToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  const openAppointmentDetail = useCallback((appt: AdminAppointmentDto) => {
    setSelectedAppointment(appt);
    setIsDetailOpen(true);
  }, []);

  // Formato de cabecera de fecha
  const headerDateLabel = useMemo(() => {
    if (view === "day") {
      return currentDate.toLocaleDateString("es-AR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    }
    if (view === "week") {
      const start = new Date(currentDate);
      const dayOfWeek = start.getDay();
      start.setDate(start.getDate() - dayOfWeek);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);

      const startFmt = start.toLocaleDateString("es-AR", { day: "numeric", month: "short" });
      const endFmt = end.toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });
      return `Semana del ${startFmt} al ${endFmt}`;
    }
    return "Todos los Turnos";
  }, [view, currentDate]);

  return (
    <div className="rounded-[2rem] bg-white/50 backdrop-blur-2xl border border-white/70 shadow-[0_8px_32px_0_rgba(169,119,60,0.06)] p-5 sm:p-7 space-y-6">
      {/* ========================================================================= */}
      {/* 1. BARRA SUPERIOR: TITULO, CONTROLES DE FECHA Y SELECTOR DE VISTAS */}
      {/* ========================================================================= */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between pb-4 border-b border-amber-900/10">
        {/* Lado izquierdo: Fecha activa con fuente Krona One y flechas */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#a9773c]" />
            <h2 className="font-krona text-sm sm:text-base tracking-tight text-slate-900 capitalize select-none">
              {headerDateLabel}
            </h2>
          </div>

          <div className="flex items-center gap-1.5 ml-auto sm:ml-0">
            <button
              type="button"
              onClick={() => navigateDate("prev")}
              className="w-8 h-8 rounded-xl bg-white/80 hover:bg-white border border-slate-200/80 text-slate-700 flex items-center justify-center transition-all shadow-xs hover:border-[#a9773c]/40"
              title="Anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={goToToday}
              className="px-3 py-1.5 rounded-xl bg-white/80 hover:bg-white border border-slate-200/80 text-xs font-semibold text-slate-700 transition-all shadow-xs hover:border-[#a9773c]/40 hover:text-[#a9773c]"
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => navigateDate("next")}
              className="w-8 h-8 rounded-xl bg-white/80 hover:bg-white border border-slate-200/80 text-slate-700 flex items-center justify-center transition-all shadow-xs hover:border-[#a9773c]/40"
              title="Siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Lado derecho: Selector de vistas (Día, Semana, Lista) */}
        <div className="inline-flex items-center p-1 rounded-xl bg-slate-200/60 backdrop-blur-md border border-slate-200/80 shadow-inner self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setView("day")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200",
              view === "day"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Clock className="w-3.5 h-3.5 text-[#a9773c]" />
            <span>Día</span>
          </button>

          <button
            type="button"
            onClick={() => setView("week")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200",
              view === "week"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Grid3x3 className="w-3.5 h-3.5 text-[#a9773c]" />
            <span>Semana</span>
          </button>

          <button
            type="button"
            onClick={() => setView("list")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200",
              view === "list"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <List className="w-3.5 h-3.5 text-[#a9773c]" />
            <span>Lista</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. CONTENIDO PRINCIPAL SEGÚN LA VISTA SELECCIONADA */}
      {/* ========================================================================= */}
      {view === "day" && (
        <DayView
          currentDate={currentDate}
          appointments={appointments}
          onAppointmentClick={openAppointmentDetail}
          onComplete={handleComplete}
          onCancel={(appt) => setAppointmentToCancel(appt)}
          loadingId={loadingId}
        />
      )}

      {view === "week" && (
        <WeekView
          currentDate={currentDate}
          appointments={appointments}
          onAppointmentClick={openAppointmentDetail}
        />
      )}

      {view === "list" && (
        <ListView
          appointments={appointments}
          onAppointmentClick={openAppointmentDetail}
          onComplete={handleComplete}
          onCancel={(appt) => setAppointmentToCancel(appt)}
          loadingId={loadingId}
        />
      )}

      {/* ========================================================================= */}
      {/* 3. MODAL DE DETALLES DEL TURNO (ESTILO ROVE & ZERO-BADGE) */}
      {/* ========================================================================= */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-md rounded-[2rem] bg-white/95 backdrop-blur-2xl border border-white/90 shadow-[0_20px_60px_-15px_rgba(169,119,60,0.25)] p-6 sm:p-7 space-y-4">
          <DialogHeader className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#a9773c]" />
              <span className="text-[10px] uppercase font-bold tracking-widest text-[#a9773c]">
                Detalle del Turno
              </span>
            </div>
            <DialogTitle className="font-sans font-bold text-lg text-slate-900 tracking-tight flex items-center justify-between">
              <span>{selectedAppointment?.customerName}</span>
              {selectedAppointment && (
                <StatusIndicator status={selectedAppointment.status} />
              )}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Información de la cita y datos de contacto del cliente
            </DialogDescription>
          </DialogHeader>

          {selectedAppointment && (
            <div className="space-y-3.5 text-xs text-slate-700">
              <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-900/10 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Servicio:</span>
                  <span className="font-semibold text-slate-900">{selectedAppointment.serviceName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Duración:</span>
                  <span className="font-medium text-slate-800">{selectedAppointment.durationMinutes} minutos</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Precio Total:</span>
                  <span className="font-bold text-slate-900">
                    ${selectedAppointment.priceAmount.toLocaleString("es-AR")} {selectedAppointment.currency}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Fecha y Hora:</span>
                  <span className="font-semibold text-slate-900 capitalize">
                    {selectedAppointment.formattedDate} • {selectedAppointment.formattedTime} hs
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/70 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Teléfono:</span>
                  <a
                    href={`tel:${selectedAppointment.customerPhone}`}
                    className="font-semibold text-slate-900 hover:text-[#a9773c] flex items-center gap-1.5 transition-colors"
                  >
                    <Phone className="w-3 h-3 text-[#a9773c]" />
                    {selectedAppointment.customerPhone}
                  </a>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Email:</span>
                  <span className="font-medium text-slate-800">{selectedAppointment.customerEmail}</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex flex-col-reverse sm:flex-row items-center gap-2 pt-2">
            {selectedAppointment?.status === "confirmed" && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setIsDetailOpen(false);
                    setAppointmentToCancel(selectedAppointment);
                  }}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs transition-colors"
                >
                  Cancelar Turno
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleComplete(selectedAppointment.id);
                    setIsDetailOpen(false);
                  }}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#a9773c] to-[#c49257] hover:opacity-95 text-white font-semibold text-xs transition-all shadow-sm shadow-[#a9773c]/30"
                >
                  Marcar Completado
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setIsDetailOpen(false)}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors"
            >
              Cerrar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* 4. MODAL DE CONFIRMACIÓN DE CANCELACIÓN (ZERO-COMPROMISE) */}
      {/* ========================================================================= */}
      {appointmentToCancel && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-admin-cancel-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div
            onClick={() => !loadingId && setAppointmentToCancel(null)}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-md transition-opacity duration-300 animate-in fade-in"
          />

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
                <span className="font-semibold text-slate-900 capitalize">
                  {appointmentToCancel.formattedDate} a las {appointmentToCancel.formattedTime} hs
                </span>
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

// =========================================================================
// ZERO-BADGE STATUS INDICATOR
// =========================================================================
function StatusIndicator({ status }: { status: "confirmed" | "cancelled" | "completed" }) {
  if (status === "confirmed") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        Confirmado
      </span>
    );
  }
  if (status === "cancelled") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-500">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
        Cancelado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500">
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
      Completado
    </span>
  );
}

// =========================================================================
// VISTA DIARIA (DAY VIEW): Horas en columna izquierda Krona One + Grilla
// =========================================================================
function DayView({
  currentDate,
  appointments,
  onAppointmentClick,
  onComplete,
  onCancel,
  loadingId,
}: {
  currentDate: Date;
  appointments: AdminAppointmentDto[];
  onAppointmentClick: (appt: AdminAppointmentDto) => void;
  onComplete: (id: string) => void;
  onCancel: (appt: AdminAppointmentDto) => void;
  loadingId: string | null;
}) {
  const currentIsoDate = currentDate.toISOString().slice(0, 10);

  // Turnos del día
  const dayAppointments = useMemo(() => {
    return appointments.filter((a) => {
      const aDate = a.startAt.slice(0, 10);
      return aDate === currentIsoDate && a.status !== "cancelled";
    });
  }, [appointments, currentIsoDate]);

  // Agrupar por hora de inicio para la grilla
  const getAppointmentsForHour = (hour: number) => {
    return dayAppointments.filter((a) => {
      const d = new Date(a.startAt);
      return d.getHours() === hour;
    });
  };

  return (
    <div className="rounded-[1.7rem] bg-white/40 backdrop-blur-xl border border-white/70 shadow-sm overflow-hidden animate-in fade-in duration-200">
      <div className="divide-y divide-amber-900/10">
        {OPERATIONAL_HOURS.map((hour) => {
          const hourAppts = getAppointmentsForHour(hour);

          return (
            <div key={hour} className="flex min-h-[5rem] group hover:bg-amber-50/20 transition-colors">
              {/* Columna de Hora Krona One */}
              <div className="w-20 sm:w-24 shrink-0 p-3 sm:p-4 border-r border-amber-900/10 flex items-start justify-center select-none bg-white/20">
                <span className="font-krona text-[11px] sm:text-xs text-slate-700 tracking-wider">
                  {hour.toString().padStart(2, "0")}:00
                </span>
              </div>

              {/* Contenedor de Turnos de esta hora */}
              <div className="flex-1 p-2 sm:p-3 flex flex-wrap gap-2.5 items-start">
                {hourAppts.length === 0 ? (
                  <div className="h-full flex items-center text-[11px] text-slate-400 font-normal pl-2 opacity-0 group-hover:opacity-60 transition-opacity">
                    Sin turnos asignados
                  </div>
                ) : (
                  hourAppts.map((appt) => {
                    const isCompleted = appt.status === "completed";

                    return (
                      <div
                        key={appt.id}
                        onClick={() => onAppointmentClick(appt)}
                        className={cn(
                          "cursor-pointer group/card rounded-xl p-3 border transition-all duration-200 backdrop-blur-md shadow-xs hover:shadow-md hover:scale-[1.01] w-full sm:max-w-md",
                          isCompleted
                            ? "bg-slate-100/90 border-slate-200 text-slate-600"
                            : "bg-white/85 hover:bg-white border-[#a9773c]/30 text-slate-900"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-0.5 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-krona text-xs text-[#a9773c] font-semibold">
                                {appt.formattedTime} hs
                              </span>
                              <span className="text-slate-300">•</span>
                              <span className="font-semibold text-xs text-slate-900 truncate">
                                {appt.customerName}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-600 flex items-center gap-1.5 truncate">
                              <Scissors className="w-3 h-3 text-[#a9773c]/70 shrink-0" />
                              <span className="truncate">{appt.serviceName}</span>
                              <span>•</span>
                              <span>{appt.durationMinutes}m</span>
                            </div>
                          </div>

                          {/* Zero-Badge Status & Quick Actions */}
                          <div className="flex items-center gap-2 shrink-0">
                            <StatusIndicator status={appt.status} />

                            {appt.status === "confirmed" && (
                              <div
                                className="flex items-center gap-1 opacity-80 group-hover/card:opacity-100 transition-opacity ml-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  disabled={loadingId === appt.id}
                                  onClick={() => onComplete(appt.id)}
                                  className="w-6 h-6 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 flex items-center justify-center transition-colors shadow-xs"
                                  title="Marcar completado"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={loadingId === appt.id}
                                  onClick={() => onCancel(appt)}
                                  className="w-6 h-6 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition-colors shadow-xs"
                                  title="Cancelar turno"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =========================================================================
// VISTA SEMANAL (WEEK VIEW): Grilla 7 columnas con horas Krona One
// =========================================================================
function WeekView({
  currentDate,
  appointments,
  onAppointmentClick,
}: {
  currentDate: Date;
  appointments: AdminAppointmentDto[];
  onAppointmentClick: (appt: AdminAppointmentDto) => void;
}) {
  // Calcular los 7 días de la semana activa (empezando domingo)
  const weekDays = useMemo(() => {
    const start = new Date(currentDate);
    const dayIndex = start.getDay();
    start.setDate(start.getDate() - dayIndex);

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [currentDate]);

  const getAppointmentsForDayAndHour = (date: Date, hour: number) => {
    const dateIso = date.toISOString().slice(0, 10);
    return appointments.filter((a) => {
      const aDate = a.startAt.slice(0, 10);
      const aHour = new Date(a.startAt).getHours();
      return aDate === dateIso && aHour === hour && a.status !== "cancelled";
    });
  };

  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <div className="rounded-[1.7rem] bg-white/40 backdrop-blur-xl border border-white/70 shadow-sm overflow-x-auto animate-in fade-in duration-200">
      <div className="min-w-[850px]">
        {/* Cabecera de Días de la semana con fuente Krona One */}
        <div className="grid grid-cols-8 border-b border-amber-900/10 bg-white/30 sticky top-0 z-10 backdrop-blur-md">
          <div className="p-3 text-center border-r border-amber-900/10 flex items-center justify-center">
            <Clock className="w-4 h-4 text-[#a9773c]" />
          </div>
          {weekDays.map((day) => {
            const isToday = day.toISOString().slice(0, 10) === todayIso;

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "p-2.5 sm:p-3 text-center border-r border-amber-900/10 last:border-r-0 select-none",
                  isToday && "bg-amber-500/10"
                )}
              >
                <div className="font-krona text-[10px] sm:text-xs text-slate-800 uppercase tracking-wider">
                  {day.toLocaleDateString("es-AR", { weekday: "short" })}
                </div>
                <div
                  className={cn(
                    "text-xs sm:text-sm font-bold mt-0.5",
                    isToday ? "text-[#a9773c]" : "text-slate-600"
                  )}
                >
                  {day.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Grilla de Horas y Días */}
        <div className="divide-y divide-amber-900/10">
          {OPERATIONAL_HOURS.map((hour) => (
            <div key={hour} className="grid grid-cols-8 min-h-[4.2rem]">
              {/* Columna Horas Krona One */}
              <div className="p-2 border-r border-amber-900/10 text-center flex items-center justify-center bg-white/20 select-none">
                <span className="font-krona text-[10px] text-slate-700">
                  {hour.toString().padStart(2, "0")}:00
                </span>
              </div>

              {/* 7 Celdas por día */}
              {weekDays.map((day) => {
                const cellAppts = getAppointmentsForDayAndHour(day, hour);
                const isToday = day.toISOString().slice(0, 10) === todayIso;

                return (
                  <div
                    key={`${day.toISOString()}-${hour}`}
                    className={cn(
                      "p-1 border-r border-amber-900/10 last:border-r-0 hover:bg-amber-50/20 transition-colors flex flex-col gap-1 overflow-hidden",
                      isToday && "bg-amber-500/5"
                    )}
                  >
                    {cellAppts.map((appt) => {
                      const isCompleted = appt.status === "completed";

                      return (
                        <div
                          key={appt.id}
                          onClick={() => onAppointmentClick(appt)}
                          className={cn(
                            "cursor-pointer rounded-lg p-1.5 transition-all duration-200 border text-left shadow-xs hover:shadow-md hover:scale-[1.02]",
                            isCompleted
                              ? "bg-slate-100/90 border-slate-200 text-slate-600"
                              : "bg-white/90 hover:bg-white border-[#a9773c]/40 text-slate-900"
                          )}
                          title={`${appt.customerName} - ${appt.serviceName} (${appt.durationMinutes}m)`}
                        >
                          <div className="font-krona text-[9px] text-[#a9773c] truncate">
                            {appt.formattedTime} hs
                          </div>
                          <div className="font-semibold text-[10px] text-slate-800 truncate">
                            {appt.customerName}
                          </div>
                          <div className="text-[9px] text-slate-500 truncate">
                            {appt.durationMinutes}m
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// VISTA LISTA (LIST VIEW): Agrupación cronológica con Zero-Badge
// =========================================================================
function ListView({
  appointments,
  onAppointmentClick,
  onComplete,
  onCancel,
  loadingId,
}: {
  appointments: AdminAppointmentDto[];
  onAppointmentClick: (appt: AdminAppointmentDto) => void;
  onComplete: (id: string) => void;
  onCancel: (appt: AdminAppointmentDto) => void;
  loadingId: string | null;
}) {
  const sortedAppointments = useMemo(() => {
    return [...appointments].sort(
      (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
    );
  }, [appointments]);

  if (sortedAppointments.length === 0) {
    return (
      <div className="rounded-[1.7rem] bg-white/40 border border-white/70 p-12 text-center text-xs text-slate-500">
        No hay turnos registrados en este período.
      </div>
    );
  }

  return (
    <div className="divide-y divide-amber-900/10">
      {sortedAppointments.map((appt) => (
        <div
          key={appt.id}
          onClick={() => onAppointmentClick(appt)}
          className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-white/40 -mx-2 px-2 rounded-xl transition-colors"
        >
          {/* Horario y Servicio */}
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="font-krona text-xs text-slate-900">
                {appt.formattedTime} hs
              </span>
              <span className="text-xs text-slate-500 font-medium capitalize">
                {appt.formattedDate}
              </span>

              {/* Zero-Badge Status */}
              <StatusIndicator status={appt.status} />
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
              <div
                className="flex items-center gap-2"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  disabled={loadingId === appt.id}
                  onClick={() => onComplete(appt.id)}
                  className="p-2 rounded-xl text-emerald-600 hover:bg-emerald-50 transition-colors"
                  title="Marcar como Completado"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={loadingId === appt.id}
                  onClick={() => onCancel(appt)}
                  className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 transition-colors"
                  title="Cancelar Turno"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

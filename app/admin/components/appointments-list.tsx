"use client";

import { useState } from "react";
import { AdminAppointmentDto, completeAppointmentAdminAction, cancelAppointmentAdminAction } from "../actions";
import { Phone, Check, X, AlertTriangle } from "lucide-react";

export function AppointmentsList({ initialAppointments }: { initialAppointments: AdminAppointmentDto[] }) {
  const [appointments, setAppointments] = useState(initialAppointments);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [appointmentToCancel, setAppointmentToCancel] = useState<AdminAppointmentDto | null>(null);

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

  return (
    <>
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
                    <span>{appt.serviceDuration} min</span>
                    <span>•</span>
                    <span className="font-semibold text-slate-900">
                      ${appt.servicePrice.toLocaleString("es-AR")}
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
    </>
  );
}

"use client";

import { useState } from "react";
import { AdminAppointmentDto, completeAppointmentAdminAction, cancelAppointmentAdminAction } from "../actions";
import { Phone, Check, X, Calendar } from "lucide-react";

export function AppointmentsList({ initialAppointments }: { initialAppointments: AdminAppointmentDto[] }) {
  const [appointments, setAppointments] = useState(initialAppointments);
  const [loadingId, setLoadingId] = useState<string | null>(null);

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

  const handleCancel = async (id: string) => {
    if (!confirm("¿Deseas cancelar este turno? Se enviará una notificación al cliente.")) return;
    setLoadingId(id);
    const res = await cancelAppointmentAdminAction(id);
    if (res.success) {
      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: "cancelled" as const } : a))
      );
    }
    setLoadingId(null);
  };

  return (
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
                  {appt.status === "completed" && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                      Completado
                    </span>
                  )}
                  {appt.status === "cancelled" && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                      Cancelado
                    </span>
                  )}
                </div>

                <div className="text-xs font-semibold text-slate-800">
                  {appt.serviceName} &bull;{" "}
                  <span className="font-normal text-slate-500">
                    ${appt.priceAmount.toLocaleString("es-AR")} ({appt.durationMinutes} min)
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
                      onClick={() => handleCancel(appt.id)}
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
  );
}

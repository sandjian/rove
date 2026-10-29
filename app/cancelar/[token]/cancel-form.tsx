"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { cancelAppointmentAction } from "@/app/actions";
import { AlertTriangle, X, CheckCircle2 } from "lucide-react";

interface CancelButtonProps {
  token: string;
}

export function CancelButton({ token }: CancelButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [cancelled, setCancelled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleConfirmCancel = () => {
    setError(null);
    startTransition(async () => {
      const res = await cancelAppointmentAction(token);
      if (res.success) {
        setCancelled(true);
        setIsModalOpen(false);
      } else {
        setError(res.error ?? "No se pudo cancelar el turno. Por favor contactanos.");
        setIsModalOpen(false);
      }
    });
  };

  if (cancelled) {
    return (
      <div className="p-6 rounded-2xl bg-white/70 backdrop-blur-xl border border-white/80 shadow-[0_10px_30px_rgba(169,119,60,0.08)] text-center space-y-3 animate-in fade-in zoom-in-95 duration-200">
        <div className="w-12 h-12 rounded-2xl bg-linear-to-tr from-[#a9773c] to-[#c49257] text-white flex items-center justify-center mx-auto shadow-md shadow-[#a9773c]/30">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <div className="text-slate-900 font-bold text-lg">
          Reserva Cancelada con Éxito
        </div>
        <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
          Tu turno ha sido liberado en la agenda de la barbería. Si cambiás de opinión, podés agendar un nuevo horario cuando quieras.
        </p>
        <div className="pt-2">
          <Link
            href="/#reservar"
            className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-linear-to-r from-[#a9773c] to-[#c49257] hover:from-[#c49257] hover:to-[#a9773c] text-white font-semibold text-xs tracking-wider uppercase transition-all shadow-md shadow-[#a9773c]/30 hover:scale-[1.02] active:scale-95"
          >
            Agendar Nuevo Turno
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-700 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        disabled={isPending}
        className="w-full py-3.5 px-5 rounded-2xl bg-white/80 hover:bg-red-50/80 border border-red-200/80 hover:border-red-300 text-red-700 font-semibold text-xs uppercase tracking-wider transition-all duration-200 shadow-sm hover:shadow-md hover:scale-[1.01] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 backdrop-blur-md"
      >
        <AlertTriangle className="w-4 h-4 text-red-500" />
        <span>Cancelar Esta Reserva</span>
      </button>

      <p className="text-[11px] text-slate-500 text-center font-normal">
        Al cancelar, el horario quedará disponible inmediatamente para otros clientes.
      </p>

      {/* MODAL DE CONFIRMACIÓN CUSTOM ROVE */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-cancel-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          {/* Backdrop con blur orgánico camel cálido */}
          <div
            onClick={() => !isPending && setIsModalOpen(false)}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-md transition-opacity duration-300 animate-in fade-in"
          />

          {/* Tarjeta del modal glassmorphism */}
          <div className="relative w-full max-w-md rounded-[2rem] bg-white/95 backdrop-blur-2xl border border-white/90 shadow-[0_20px_60px_-15px_rgba(169,119,60,0.25)] p-6 sm:p-8 space-y-6 animate-in zoom-in-95 fade-in duration-200 z-10 text-slate-800">
            {/* Brillo especular superior */}
            <div className="absolute top-0 inset-x-0 h-px bg-linear-to-r from-transparent via-white to-transparent opacity-80" />

            {/* Botón de cierre */}
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              disabled={isPending}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors disabled:opacity-50"
              aria-label="Cerrar modal"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Icono de advertencia */}
            <div className="flex flex-col items-center text-center space-y-3 pt-2">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-[#a9773c]/30 text-[#a9773c] flex items-center justify-center shadow-inner">
                <AlertTriangle className="w-7 h-7 text-[#a9773c]" />
              </div>
              <div className="space-y-1">
                <h3 id="modal-cancel-title" className="text-xl font-bold tracking-tight text-slate-900">
                  ¿Cancelar esta reserva?
                </h3>
                <p className="text-xs sm:text-[13px] text-slate-600 leading-relaxed max-w-xs mx-auto">
                  Esta acción liberará tu turno en la barbería de forma inmediata. Si querés volver a atenderte, deberás seleccionar un nuevo horario disponible.
                </p>
              </div>
            </div>

            {/* Botones de acción */}
            <div className="flex flex-col-reverse sm:flex-row items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                disabled={isPending}
                className="w-full sm:w-1/2 py-3 px-4 rounded-xl bg-slate-100/80 hover:bg-slate-200/80 text-slate-700 font-semibold text-xs uppercase tracking-wider transition-all duration-200 border border-slate-200/60 active:scale-95 disabled:opacity-50"
              >
                Mantener Turno
              </button>

              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={isPending}
                className="w-full sm:w-1/2 py-3 px-4 rounded-xl bg-linear-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-600 text-white font-semibold text-xs uppercase tracking-wider transition-all duration-200 shadow-md shadow-red-600/30 hover:scale-[1.02] active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {isPending ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Cancelando...</span>
                  </>
                ) : (
                  <span>Sí, Cancelar</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

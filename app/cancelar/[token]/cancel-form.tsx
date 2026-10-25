"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { cancelAppointmentAction } from "@/app/actions";

interface CancelButtonProps {
  token: string;
}

export function CancelButton({ token }: CancelButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [cancelled, setCancelled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCancel = () => {
    if (!window.confirm("¿Estás seguro de que deseás cancelar este turno? Esta acción no se puede deshacer.")) {
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await cancelAppointmentAction(token);
      if (res.success) {
        setCancelled(true);
      } else {
        setError(res.error ?? "No se pudo cancelar el turno. Por favor contactanos.");
      }
    });
  };

  if (cancelled) {
    return (
      <div className="p-4 rounded-xl bg-amber-400/10 border border-amber-400/40 text-center space-y-2">
        <div className="text-amber-400 font-bold text-base flex items-center justify-center gap-1.5">
          <span>✓</span>
          <span>Reserva Cancelada con Éxito</span>
        </div>
        <p className="text-xs text-zinc-300">
          El turno ha sido liberado en la agenda de la barbería.
        </p>
        <div className="pt-2">
          <Link
            href="/#reservar"
            className="inline-block px-4 py-2 rounded-lg bg-amber-400 text-zinc-950 font-bold text-xs hover:bg-amber-300 transition-colors"
          >
            Agendar un Nuevo Turno
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="p-3 rounded-lg bg-red-950/60 border border-red-500/50 text-red-200 text-xs">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleCancel}
        disabled={isPending}
        className="w-full py-3 px-4 rounded-xl bg-red-600/90 hover:bg-red-500 text-white font-bold text-sm transition-all shadow-md shadow-red-900/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isPending ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>Cancelando reserva...</span>
          </>
        ) : (
          <span>Cancelar Esta Reserva</span>
        )}
      </button>

      <p className="text-[11px] text-zinc-400 text-center">
        Al cancelar, el horario quedará disponible inmediatamente para otros clientes.
      </p>
    </div>
  );
}

"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, CheckCheck, Trash2, Scissors, Clock } from "lucide-react";
import { getAdminNotificationsAction, AdminNotificationDto } from "@/app/admin/actions";

const STORAGE_KEY_SEEN = "rove_admin_notifications_seen";
const STORAGE_KEY_CLEARED = "rove_admin_notifications_cleared";

export function NotificationPopover() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AdminNotificationDto[]>([]);
  const [seenIds, setSeenIds] = useState<string[]>([]);
  const [clearedIds, setClearedIds] = useState<string[]>([]);
  const [hasNewUnseen, setHasNewUnseen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Cargar estado persistente de vistas/limpiadas en localStorage
  useEffect(() => {
    try {
      const storedSeen = localStorage.getItem(STORAGE_KEY_SEEN);
      if (storedSeen) setSeenIds(JSON.parse(storedSeen));

      const storedCleared = localStorage.getItem(STORAGE_KEY_CLEARED);
      if (storedCleared) setClearedIds(JSON.parse(storedCleared));
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Fetch de notificaciones
  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const res = await getAdminNotificationsAction();
      if (res.success && res.notifications) {
        setNotifications(res.notifications);
      }
    } catch {
      // Ignorar error de red puntual
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Polling ligero cada 45 segundos para detectar turnos nuevos en tiempo real
    const interval = setInterval(fetchNotifications, 45000);
    return () => clearInterval(interval);
  }, []);

  // Calcular si hay turnos nuevos no vistos y no limpiados
  useEffect(() => {
    const activeNotifications = notifications.filter(
      (n) => !clearedIds.includes(n.id) && !n.isObsolete
    );
    const hasUnseen = activeNotifications.some((n) => !seenIds.includes(n.id));
    setHasNewUnseen(hasUnseen);
  }, [notifications, seenIds, clearedIds]);

  // Cerrar al hacer clic afuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Al abrir el popover: marcar todas las actuales como vistas y apagar el indicador
  const handleToggle = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);

    if (nextState) {
      // Marcar todas las notificaciones actuales como vistas
      const allCurrentIds = notifications.map((n) => n.id);
      const updatedSeen = Array.from(new Set([...seenIds, ...allCurrentIds]));
      setSeenIds(updatedSeen);
      setHasNewUnseen(false);
      try {
        localStorage.setItem(STORAGE_KEY_SEEN, JSON.stringify(updatedSeen));
      } catch {
        // Ignore
      }
    }
  };

  // Botón para limpiar todas las notificaciones
  const handleClearAll = () => {
    const allIds = notifications.map((n) => n.id);
    const updatedCleared = Array.from(new Set([...clearedIds, ...allIds]));
    setClearedIds(updatedCleared);
    setHasNewUnseen(false);
    try {
      localStorage.setItem(STORAGE_KEY_CLEARED, JSON.stringify(updatedCleared));
    } catch {
      // Ignore
    }
  };

  // Filtrar notificaciones visibles (las que no fueron borradas)
  const visibleNotifications = notifications.filter((n) => !clearedIds.includes(n.id));

  return (
    <div className="relative" ref={popoverRef}>
      {/* Botón de campana */}
      <button
        type="button"
        onClick={handleToggle}
        className={`relative p-2.5 rounded-xl transition-all duration-200 ${
          isOpen
            ? "bg-white text-slate-900 shadow-sm border border-amber-900/10"
            : "text-slate-500 hover:text-slate-800 hover:bg-white/60"
        }`}
        title="Notificaciones de turnos"
        aria-label="Notificaciones de turnos"
        aria-expanded={isOpen}
      >
        <Bell className="w-4 h-4" />
        {/* Punto indicador de nuevos turnos (se desvanece al abrir) */}
        {hasNewUnseen && (
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#a9773c] ring-2 ring-white animate-pulse" />
        )}
      </button>

      {/* Popover desplegable */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 sm:w-96 rounded-2xl bg-white/95 backdrop-blur-2xl border border-white shadow-[0_20px_50px_rgba(169,119,60,0.22)] z-100 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Header del panel */}
          <div className="px-4 py-3.5 border-b border-amber-900/5 bg-linear-to-r from-white via-[#faf6f0] to-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#a9773c]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Notificaciones
              </h3>
            </div>
            {visibleNotifications.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-rose-600 transition-colors"
                title="Limpiar todas las notificaciones"
              >
                <Trash2 className="w-3 h-3" />
                <span>Limpiar</span>
              </button>
            )}
          </div>

          {/* Listado de notificaciones */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100/80">
            {isLoading && notifications.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                Cargando notificaciones...
              </div>
            ) : visibleNotifications.length === 0 ? (
              <div className="py-10 px-4 text-center space-y-2">
                <div className="w-9 h-9 mx-auto rounded-full bg-[#a9773c]/10 text-[#a9773c] flex items-center justify-center">
                  <CheckCheck className="w-4 h-4" />
                </div>
                <p className="text-xs font-semibold text-slate-700">
                  Todo al día
                </p>
                <p className="text-[11px] text-slate-400">
                  No tenés notificaciones pendientes de nuevos turnos.
                </p>
              </div>
            ) : (
              visibleNotifications.map((n) => {
                const isObsolete = n.isObsolete;
                return (
                  <div
                    key={n.id}
                    className={`p-3.5 transition-colors text-left flex items-center justify-between gap-3 ${
                      isObsolete
                        ? "bg-slate-50/60 opacity-60"
                        : "hover:bg-[#faf6f0]/50"
                    }`}
                  >
                    {/* Datos del cliente y servicio */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            isObsolete
                              ? "bg-slate-300"
                              : n.status === "cancelled"
                              ? "bg-rose-500"
                              : "bg-[#a9773c]"
                          }`}
                        />
                        <span className="font-bold text-xs text-slate-800 truncate">
                          {n.customerName}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] text-slate-600 truncate">
                        <Scissors className="w-3 h-3 text-[#a9773c] shrink-0" />
                        <span className="truncate">{n.serviceName}</span>
                      </div>

                      <div className="text-[10px] text-slate-400 font-medium">
                        {n.formattedDate}
                        {isObsolete && (
                          <span className="ml-1.5 italic text-rose-500/80">
                            • {n.status === "cancelled" ? "Cancelado" : "Concluido"}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bloque destacado para la HORA (bastante más grande) */}
                    <div className="shrink-0 text-right bg-white/80 border border-amber-900/10 rounded-xl px-2.5 py-1.5 shadow-sm">
                      <div className="font-krona text-base sm:text-lg text-slate-900 font-semibold tracking-tight">
                        {n.formattedTime}
                      </div>
                      <div className="text-[9px] font-semibold uppercase tracking-wider text-[#a9773c] text-center">
                        HORA
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

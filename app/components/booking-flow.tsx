"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import {
  getServicesAction,
  getAvailableSlotsAction,
  bookAppointmentAction,
  type ServiceDto,
  type DaySlotsDto,
  type SlotDto,
  type BookingActionResult,
} from "@/app/actions";

interface BookingFlowProps {
  initialServices?: ServiceDto[];
}

export function BookingFlow({ initialServices }: BookingFlowProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Datos
  const [services, setServices] = useState<ServiceDto[]>(initialServices ?? []);
  const [loadingServices, setLoadingServices] = useState(!initialServices || initialServices.length === 0);
  const [selectedService, setSelectedService] = useState<ServiceDto | null>(null);

  const [days, setDays] = useState<DaySlotsDto[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<SlotDto | null>(null);

  // Formulario
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  // Estado de confirmación
  const [isPending, startTransition] = useTransition();
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<BookingActionResult["appointment"] | null>(null);
  const [cancellationToken, setCancellationToken] = useState<string | null>(null);

  // Cargar servicios si no vinieron precargados
  useEffect(() => {
    if (!initialServices || initialServices.length === 0) {
      let active = true;
      getServicesAction().then((res) => {
        if (!active) return;
        if (res.success && res.services) {
          setServices(res.services);
        }
        setLoadingServices(false);
      });
      return () => {
        active = false;
      };
    }
  }, [initialServices]);

  const handleSelectService = (service: ServiceDto) => {
    setSelectedService(service);
    setSelectedSlot(null);
    setSelectedDayKey(null);
    setBookingError(null);
    setLoadingSlots(true);
    setStep(2);

    getAvailableSlotsAction(service.id).then((res) => {
      setLoadingSlots(false);
      if (res.success && res.days.length > 0) {
        setDays(res.days);
        setSelectedDayKey(res.days[0].dateKey);
      } else {
        setDays([]);
        setSelectedDayKey(null);
      }
    });
  };

  const handleSelectSlot = (slot: SlotDto) => {
    setSelectedSlot(slot);
    setBookingError(null);
    setStep(3);
  };

  const handleSubmitBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService || !selectedSlot) return;

    if (!customerName.trim() || !customerEmail.trim() || !customerPhone.trim()) {
      setBookingError("Por favor completá tu nombre, email y teléfono.");
      return;
    }

    setBookingError(null);

    startTransition(async () => {
      const res = await bookAppointmentAction({
        serviceId: selectedService.id,
        startIso: selectedSlot.startIso,
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim(),
        customerPhone: customerPhone.trim(),
      });

      if (res.success && res.appointment && res.cancellationToken) {
        setConfirmedBooking(res.appointment);
        setCancellationToken(res.cancellationToken);
        setStep(4);
      } else {
        setBookingError(res.error ?? "Ocurrió un error al reservar. Por favor probá de nuevo.");
      }
    });
  };

  const handleReset = () => {
    setStep(1);
    setSelectedService(null);
    setSelectedSlot(null);
    setSelectedDayKey(null);
    setConfirmedBooking(null);
    setCancellationToken(null);
    setBookingError(null);
    setCustomerName("");
    setCustomerEmail("");
    setCustomerPhone("");
  };

  const activeDay = days.find((d) => d.dateKey === selectedDayKey);

  return (
    <div className="w-full max-w-4xl mx-auto rounded-3xl bg-white/70 border border-white/80 shadow-[0_8px_32px_0_rgba(31,38,135,0.06)] backdrop-blur-2xl p-6 sm:p-10 text-slate-800 transition-all">
      {/* Indicador de pasos */}
      <div className="flex items-center justify-between border-b border-slate-200/70 pb-6 mb-8">
        <div className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm font-medium">
          <button
            type="button"
            onClick={() => setStep(1)}
            disabled={step === 4}
            className={`flex items-center gap-2 transition-all ${
              step === 1
                ? "text-blue-600 font-bold"
                : step > 1
                ? "text-slate-600 hover:text-slate-900"
                : "text-slate-400 cursor-not-allowed"
            }`}
          >
            <span
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                step === 1
                  ? "bg-gradient-to-r from-blue-500 to-sky-400 text-white shadow-md shadow-blue-500/20"
                  : step > 1
                  ? "bg-blue-50 text-blue-600 border border-blue-200/60"
                  : "bg-slate-100 text-slate-400"
              }`}
            >
              1
            </span>
            <span>Servicio</span>
          </button>

          <span className="text-slate-300">/</span>

          <button
            type="button"
            onClick={() => selectedService && setStep(2)}
            disabled={!selectedService || step === 4}
            className={`flex items-center gap-2 transition-all ${
              step === 2
                ? "text-blue-600 font-bold"
                : step > 2
                ? "text-slate-600 hover:text-slate-900"
                : "text-slate-400 cursor-not-allowed"
            }`}
          >
            <span
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                step === 2
                  ? "bg-gradient-to-r from-blue-500 to-sky-400 text-white shadow-md shadow-blue-500/20"
                  : step > 2
                  ? "bg-blue-50 text-blue-600 border border-blue-200/60"
                  : "bg-slate-100 text-slate-400"
              }`}
            >
              2
            </span>
            <span>Horario</span>
          </button>

          <span className="text-slate-300">/</span>

          <button
            type="button"
            onClick={() => selectedSlot && setStep(3)}
            disabled={!selectedSlot || step === 4}
            className={`flex items-center gap-2 transition-all ${
              step === 3
                ? "text-blue-600 font-bold"
                : step > 3
                ? "text-slate-600 hover:text-slate-900"
                : "text-slate-400 cursor-not-allowed"
            }`}
          >
            <span
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                step === 3
                  ? "bg-gradient-to-r from-blue-500 to-sky-400 text-white shadow-md shadow-blue-500/20"
                  : step > 3
                  ? "bg-blue-50 text-blue-600 border border-blue-200/60"
                  : "bg-slate-100 text-slate-400"
              }`}
            >
              3
            </span>
            <span>Tus Datos</span>
          </button>
        </div>

        {selectedService && step < 4 && (
          <div className="hidden md:flex items-center gap-2 text-xs text-slate-600 bg-white/80 px-3.5 py-1.5 rounded-full border border-slate-200/70 shadow-sm">
            <span className="font-semibold text-slate-800">{selectedService.name}</span>
            <span className="text-slate-300">•</span>
            <span className="text-blue-600 font-bold">
              ${selectedService.priceAmount.toLocaleString("es-AR")} ARS
            </span>
          </div>
        )}
      </div>

      {/* PASO 1: SELECCIONAR SERVICIO */}
      {step === 1 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">Elegí tu Servicio</h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Todos los turnos son individuales con atención exclusiva de autor.
            </p>
          </div>

          {loadingServices ? (
            <div className="grid sm:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-32 rounded-2xl bg-white/40 animate-pulse border border-slate-200/50" />
              ))}
            </div>
          ) : services.length === 0 ? (
            <div className="text-center py-12 border border-slate-200/60 rounded-2xl bg-white/40">
              <p className="text-slate-500 text-sm">No hay servicios disponibles en este momento.</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {services.map((service) => {
                const isSelected = selectedService?.id === service.id;
                return (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => handleSelectService(service)}
                    className={`group text-left p-6 rounded-2xl border transition-all duration-200 flex flex-col justify-between shadow-sm hover:shadow-md ${
                      isSelected
                        ? "bg-blue-50/70 border-blue-400 ring-2 ring-blue-300/40"
                        : "bg-white/80 border-slate-200/70 hover:bg-white hover:border-blue-300"
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-semibold text-base sm:text-lg text-slate-900 group-hover:text-blue-600 transition-colors">
                          {service.name}
                        </h3>
                        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 whitespace-nowrap border border-slate-200/70">
                          {service.durationMinutes} min
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                        {service.description}
                      </p>
                    </div>

                    <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-lg font-bold text-slate-900">
                        ${service.priceAmount.toLocaleString("es-AR")}{" "}
                        <span className="text-xs font-normal text-slate-500">ARS</span>
                      </span>
                      <span className="text-xs font-bold text-blue-600 group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                        Seleccionar &rarr;
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* PASO 2: SELECCIONAR FECHA Y HORA */}
      {step === 2 && selectedService && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">Elegí Fecha y Horario</h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Servicio: <strong className="text-slate-800 font-semibold">{selectedService.name}</strong> ({selectedService.durationMinutes} min)
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 underline underline-offset-2"
            >
              Cambiar servicio
            </button>
          </div>

          {loadingSlots ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs sm:text-sm text-slate-500">Calculando horarios disponibles en tiempo real...</p>
            </div>
          ) : days.length === 0 ? (
            <div className="text-center py-12 border border-slate-200/60 rounded-2xl bg-white/40 space-y-3 p-6">
              <p className="text-slate-800 font-semibold text-sm">No hay turnos libres en los próximos 7 días para este servicio.</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                Los turnos se habilitan con un mínimo de 2 horas de anticipación. Por favor consultá más tarde o contactanos por WhatsApp.
              </p>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="mt-2 text-xs font-semibold text-blue-600 hover:text-blue-700 underline underline-offset-2"
              >
                Volver al catálogo de servicios
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Tira horizontal de selección de día */}
              <div>
                <label className="text-[11px] font-bold tracking-wider uppercase text-slate-500 mb-2.5 block">
                  Días Disponibles
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5">
                  {days.map((day) => {
                    const isDaySelected = selectedDayKey === day.dateKey;
                    return (
                      <button
                        key={day.dateKey}
                        type="button"
                        onClick={() => setSelectedDayKey(day.dateKey)}
                        className={`p-3 rounded-2xl border text-center transition-all duration-150 ${
                          isDaySelected
                            ? "bg-gradient-to-r from-blue-500 via-sky-400 to-blue-400 text-white font-bold border-transparent shadow-md shadow-blue-400/25"
                            : "bg-white/80 border-slate-200/70 text-slate-700 hover:bg-white hover:border-blue-200 shadow-sm"
                        }`}
                      >
                        <div className={`text-[11px] uppercase tracking-wide font-medium ${isDaySelected ? "text-white/90" : "text-slate-400"}`}>
                          {day.dayLabel.split(" ")[0]}
                        </div>
                        <div className="text-lg font-bold mt-0.5">{day.dayLabel.split(" ")[1] ?? ""}</div>
                        <div className={`text-[10px] mt-1 font-medium ${isDaySelected ? "text-white/80" : "text-slate-500"}`}>
                          {day.slots.length} {day.slots.length === 1 ? "turno" : "turnos"}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Grilla de horarios para el día seleccionado */}
              {activeDay && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Horarios para el <strong className="text-slate-800 font-semibold">{activeDay.dayLabel}</strong>:</span>
                    <span className="text-[11px] text-slate-400">Hora local Buenos Aires (ART)</span>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5 max-h-64 overflow-y-auto pr-1">
                    {activeDay.slots.map((slot) => {
                      const isSlotSelected = selectedSlot?.startIso === slot.startIso;
                      return (
                        <button
                          key={slot.startIso}
                          type="button"
                          onClick={() => handleSelectSlot(slot)}
                          className={`py-2.5 px-3 rounded-xl border text-sm font-semibold transition-all ${
                            isSlotSelected
                              ? "bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/25"
                              : "bg-white/90 border-slate-200/80 text-slate-800 hover:border-blue-400 hover:text-blue-600 shadow-sm hover:bg-white"
                          }`}
                        >
                          {slot.timeLabel}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* PASO 3: FORMULARIO DE CLIENTE Y CONFIRMACIÓN */}
      {step === 3 && selectedService && selectedSlot && (
        <form onSubmit={handleSubmitBooking} className="space-y-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">Completá tus Datos</h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Te enviaremos los datos de confirmación y el enlace para gestionar o cancelar tu turno.
            </p>
          </div>

          {/* Resumen del turno seleccionado */}
          <div className="p-5 rounded-2xl bg-blue-50/50 border border-blue-100/80 grid sm:grid-cols-3 gap-4">
            <div>
              <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold block">Servicio</span>
              <span className="font-bold text-slate-900 text-sm">{selectedService.name}</span>
              <span className="text-xs text-slate-500 block">{selectedService.durationMinutes} minutos</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold block">Fecha y Hora</span>
              <span className="font-bold text-blue-600 text-sm">
                {selectedSlot.dayLabel} a las {selectedSlot.timeLabel} hs
              </span>
              <span className="text-xs text-slate-500 block">Hora local de Argentina</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold block">Total a Abonar</span>
              <span className="font-bold text-slate-900 text-sm">
                ${selectedService.priceAmount.toLocaleString("es-AR")} ARS
              </span>
              <span className="text-xs text-slate-500 block">Pago en la barbería</span>
            </div>
          </div>

          {/* Campos del formulario */}
          <div className="space-y-4">
            <div>
              <label htmlFor="customerName" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Nombre y Apellido <span className="text-blue-500">*</span>
              </label>
              <input
                id="customerName"
                type="text"
                required
                maxLength={120}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="ej. Agustín Rossi"
                className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-400/20 text-sm shadow-sm transition-all"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="customerEmail" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Correo Electrónico <span className="text-blue-500">*</span>
                </label>
                <input
                  id="customerEmail"
                  type="email"
                  required
                  maxLength={255}
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="ej. agustin@gmail.com"
                  className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-400/20 text-sm shadow-sm transition-all"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">Recibirás la confirmación de tu turno aquí.</span>
              </div>

              <div>
                <label htmlFor="customerPhone" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Teléfono / WhatsApp <span className="text-blue-500">*</span>
                </label>
                <input
                  id="customerPhone"
                  type="tel"
                  required
                  maxLength={50}
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="ej. +54 9 11 4455-6677"
                  className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-400/20 text-sm shadow-sm transition-all"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">Para avisos sobre tu turno.</span>
              </div>
            </div>
          </div>

          {bookingError && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm flex items-start gap-2.5">
              <span className="text-red-500 font-bold">✕</span>
              <span>{bookingError}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-slate-200/70">
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={isPending}
              className="text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
            >
              &larr; Volver a horarios
            </button>

            <button
              type="submit"
              disabled={isPending}
              className="px-6 py-3 rounded-full bg-gradient-to-r from-blue-500 via-sky-400 to-blue-400 hover:opacity-95 text-white font-bold text-xs sm:text-sm transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-[0_8px_20px_-4px_rgba(59,130,246,0.4)]"
            >
              {isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Confirmando reserva...</span>
                </>
              ) : (
                <span>Confirmar Turno</span>
              )}
            </button>
          </div>
        </form>
      )}

      {/* PASO 4: CONFIRMACIÓN EXITOSA */}
      {step === 4 && confirmedBooking && (
        <div className="text-center py-6 space-y-6">
          <div className="w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-400 text-emerald-500 flex items-center justify-center mx-auto text-2xl font-bold shadow-lg shadow-emerald-400/20">
            ✓
          </div>

          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">¡Turno Confirmado!</h2>
            <p className="text-slate-600 text-xs sm:text-sm mt-1">
              Gracias <strong className="text-slate-900 font-semibold">{confirmedBooking.customerName}</strong>. Te esperamos en Rove Barbería.
            </p>
          </div>

          {/* Tarjeta de resumen del turno */}
          <div className="max-w-md mx-auto p-6 rounded-2xl bg-white/90 border border-slate-200/70 shadow-sm text-left space-y-3">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Servicio</span>
              <span className="text-sm font-bold text-slate-900">{confirmedBooking.serviceName}</span>
            </div>

            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Fecha y Hora</span>
              <span className="text-sm font-bold text-blue-600">
                {selectedSlot?.dayLabel} a las {selectedSlot?.timeLabel} hs
              </span>
            </div>

            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Duración</span>
              <span className="text-sm font-medium text-slate-700">{confirmedBooking.durationMinutes} minutos</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Precio Total</span>
              <span className="text-base font-bold text-slate-900">
                ${confirmedBooking.priceAmount.toLocaleString("es-AR")} ARS
              </span>
            </div>
          </div>

          <div className="max-w-md mx-auto text-xs text-slate-600 space-y-2 bg-blue-50/50 p-4 rounded-xl border border-blue-100/70">
            <p>
              📧 Se ha emitido un correo de confirmación a <strong className="text-slate-900 font-semibold">{confirmedBooking.customerEmail}</strong>.
            </p>
            <p>
              Si necesitás cancelar tu reserva en el futuro, podés hacerlo con un clic desde el correo o guardando este enlace:
            </p>
            {cancellationToken && (
              <Link
                href={`/cancelar/${cancellationToken}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-blue-600 hover:text-blue-700 underline font-mono text-[11px] break-all pt-1 font-semibold"
              >
                Ver enlace de cancelación
              </Link>
            )}
          </div>

          <div className="pt-4">
            <button
              type="button"
              onClick={handleReset}
              className="px-6 py-2.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold transition-all shadow-sm"
            >
              Agendar otro turno
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

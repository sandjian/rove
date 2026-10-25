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
    <div className="w-full max-w-4xl mx-auto rounded-2xl bg-zinc-950/80 border border-zinc-800/80 shadow-2xl backdrop-blur-xl p-6 sm:p-8 text-zinc-100">
      {/* Indicador de pasos */}
      <div className="flex items-center justify-between border-b border-zinc-800/70 pb-6 mb-8">
        <div className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm font-medium">
          <button
            type="button"
            onClick={() => setStep(1)}
            disabled={step === 4}
            className={`flex items-center gap-2 transition-colors ${
              step === 1
                ? "text-amber-400 font-semibold"
                : step > 1
                ? "text-zinc-400 hover:text-zinc-200"
                : "text-zinc-600 cursor-not-allowed"
            }`}
          >
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                step === 1
                  ? "bg-amber-400 text-zinc-950 font-bold"
                  : step > 1
                  ? "bg-zinc-800 text-amber-400"
                  : "bg-zinc-900 text-zinc-600"
              }`}
            >
              1
            </span>
            <span>Servicio</span>
          </button>

          <span className="text-zinc-700">/</span>

          <button
            type="button"
            onClick={() => selectedService && setStep(2)}
            disabled={!selectedService || step === 4}
            className={`flex items-center gap-2 transition-colors ${
              step === 2
                ? "text-amber-400 font-semibold"
                : step > 2
                ? "text-zinc-400 hover:text-zinc-200"
                : "text-zinc-600 cursor-not-allowed"
            }`}
          >
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                step === 2
                  ? "bg-amber-400 text-zinc-950 font-bold"
                  : step > 2
                  ? "bg-zinc-800 text-amber-400"
                  : "bg-zinc-900 text-zinc-600"
              }`}
            >
              2
            </span>
            <span>Horario</span>
          </button>

          <span className="text-zinc-700">/</span>

          <button
            type="button"
            onClick={() => selectedSlot && setStep(3)}
            disabled={!selectedSlot || step === 4}
            className={`flex items-center gap-2 transition-colors ${
              step === 3
                ? "text-amber-400 font-semibold"
                : step > 3
                ? "text-zinc-400 hover:text-zinc-200"
                : "text-zinc-600 cursor-not-allowed"
            }`}
          >
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                step === 3
                  ? "bg-amber-400 text-zinc-950 font-bold"
                  : step > 3
                  ? "bg-zinc-800 text-amber-400"
                  : "bg-zinc-900 text-zinc-600"
              }`}
            >
              3
            </span>
            <span>Tus Datos</span>
          </button>
        </div>

        {selectedService && step < 4 && (
          <div className="hidden md:flex items-center gap-2 text-xs text-zinc-400 bg-zinc-900/90 px-3 py-1.5 rounded-full border border-zinc-800">
            <span className="font-medium text-zinc-200">{selectedService.name}</span>
            <span className="text-zinc-600">•</span>
            <span className="text-amber-400 font-semibold">
              ${selectedService.priceAmount.toLocaleString("es-AR")} ARS
            </span>
          </div>
        )}
      </div>

      {/* PASO 1: SELECCIONAR SERVICIO */}
      {step === 1 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-zinc-100">Elegí tu Servicio</h2>
            <p className="text-sm text-zinc-400 mt-1">
              Todos los turnos son individuales con atención exclusiva de autor.
            </p>
          </div>

          {loadingServices ? (
            <div className="grid sm:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-32 rounded-xl bg-zinc-900/60 animate-pulse border border-zinc-800" />
              ))}
            </div>
          ) : services.length === 0 ? (
            <div className="text-center py-12 border border-zinc-800 rounded-xl bg-zinc-900/30">
              <p className="text-zinc-400">No hay servicios disponibles en este momento.</p>
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
                    className={`group text-left p-5 rounded-xl border transition-all duration-200 flex flex-col justify-between ${
                      isSelected
                        ? "bg-amber-950/20 border-amber-500/70 ring-1 ring-amber-500/50"
                        : "bg-zinc-900/40 border-zinc-800/90 hover:bg-zinc-900/80 hover:border-zinc-700"
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-semibold text-lg text-zinc-100 group-hover:text-amber-300 transition-colors">
                          {service.name}
                        </h3>
                        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-zinc-800/90 text-zinc-300 whitespace-nowrap border border-zinc-700/60">
                          {service.durationMinutes} min
                        </span>
                      </div>
                      <p className="text-sm text-zinc-400 mt-2 line-clamp-2 leading-relaxed">
                        {service.description}
                      </p>
                    </div>

                    <div className="mt-5 pt-3 border-t border-zinc-800/60 flex items-center justify-between">
                      <span className="text-lg font-bold text-amber-400">
                        ${service.priceAmount.toLocaleString("es-AR")}{" "}
                        <span className="text-xs font-normal text-zinc-400">ARS</span>
                      </span>
                      <span className="text-xs font-medium text-zinc-400 group-hover:text-zinc-100 flex items-center gap-1">
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
              <h2 className="text-2xl font-bold tracking-tight text-zinc-100">Elegí Fecha y Horario</h2>
              <p className="text-sm text-zinc-400 mt-1">
                Servicio: <span className="text-zinc-200 font-medium">{selectedService.name}</span> ({selectedService.durationMinutes} min)
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-xs text-zinc-400 hover:text-zinc-200 underline"
            >
              Cambiar servicio
            </button>
          </div>

          {loadingSlots ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-zinc-400">Calculando horarios disponibles en tiempo real...</p>
            </div>
          ) : days.length === 0 ? (
            <div className="text-center py-12 border border-zinc-800 rounded-xl bg-zinc-900/30 space-y-3">
              <p className="text-zinc-300 font-medium">No hay turnos libres en los próximos 7 días para este servicio.</p>
              <p className="text-sm text-zinc-400 max-w-md mx-auto">
                Los turnos se habilitan con un mínimo de 2 horas de anticipación. Por favor consultá más tarde o contactanos.
              </p>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="mt-2 text-xs text-amber-400 hover:text-amber-300 underline"
              >
                Volver al catálogo de servicios
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Tira horizontal de selección de día */}
              <div>
                <label className="text-xs font-semibold tracking-wider uppercase text-zinc-400 mb-2 block">
                  Días Disponibles
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                  {days.map((day) => {
                    const isDaySelected = selectedDayKey === day.dateKey;
                    return (
                      <button
                        key={day.dateKey}
                        type="button"
                        onClick={() => setSelectedDayKey(day.dateKey)}
                        className={`p-3 rounded-xl border text-center transition-all ${
                          isDaySelected
                            ? "bg-amber-400 text-zinc-950 font-bold border-amber-300 shadow-md shadow-amber-400/10"
                            : "bg-zinc-900/50 border-zinc-800 text-zinc-300 hover:bg-zinc-900 hover:border-zinc-700"
                        }`}
                      >
                        <div className="text-xs uppercase tracking-wide opacity-80">{day.dayLabel.split(" ")[0]}</div>
                        <div className="text-lg font-bold mt-0.5">{day.dayLabel.split(" ")[1] ?? ""}</div>
                        <div className="text-[10px] mt-1 opacity-70">
                          {day.slots.length} {day.slots.length === 1 ? "turno" : "turnos"}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Grilla de horarios para el día seleccionado */}
              {activeDay && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span>Horarios para el <strong className="text-zinc-200">{activeDay.dayLabel}</strong>:</span>
                    <span className="text-[11px] text-zinc-400">Hora local Buenos Aires (ART)</span>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5 max-h-64 overflow-y-auto pr-1">
                    {activeDay.slots.map((slot) => {
                      const isSlotSelected = selectedSlot?.startIso === slot.startIso;
                      return (
                        <button
                          key={slot.startIso}
                          type="button"
                          onClick={() => handleSelectSlot(slot)}
                          className={`py-2.5 px-3 rounded-lg border text-sm font-semibold transition-all ${
                            isSlotSelected
                              ? "bg-amber-400 text-zinc-950 border-amber-300 shadow"
                              : "bg-zinc-900/80 border-zinc-800 text-zinc-200 hover:border-amber-500/60 hover:text-amber-300"
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
            <h2 className="text-2xl font-bold tracking-tight text-zinc-100">Completá tus Datos</h2>
            <p className="text-sm text-zinc-400 mt-1">
              Te enviaremos los datos de confirmación y el enlace para gestionar o cancelar tu turno.
            </p>
          </div>

          {/* Resumen del turno seleccionado */}
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 grid sm:grid-cols-3 gap-4">
            <div>
              <span className="text-xs text-zinc-400 uppercase tracking-wider block">Servicio</span>
              <span className="font-semibold text-zinc-100 text-sm">{selectedService.name}</span>
              <span className="text-xs text-zinc-400 block">{selectedService.durationMinutes} minutos</span>
            </div>
            <div>
              <span className="text-xs text-zinc-400 uppercase tracking-wider block">Fecha y Hora</span>
              <span className="font-semibold text-amber-400 text-sm">
                {selectedSlot.dayLabel} a las {selectedSlot.timeLabel} hs
              </span>
              <span className="text-xs text-zinc-400 block">Hora local de Argentina</span>
            </div>
            <div>
              <span className="text-xs text-zinc-400 uppercase tracking-wider block">Total a Abonar</span>
              <span className="font-semibold text-zinc-100 text-sm">
                ${selectedService.priceAmount.toLocaleString("es-AR")} ARS
              </span>
              <span className="text-xs text-zinc-400 block">Pago en la barbería</span>
            </div>
          </div>

          {/* Campos del formulario */}
          <div className="space-y-4">
            <div>
              <label htmlFor="customerName" className="block text-xs font-semibold uppercase tracking-wider text-zinc-300 mb-1.5">
                Nombre y Apellido <span className="text-amber-400">*</span>
              </label>
              <input
                id="customerName"
                type="text"
                required
                maxLength={120}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="ej. Agustín Rossi"
                className="w-full px-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 text-sm"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="customerEmail" className="block text-xs font-semibold uppercase tracking-wider text-zinc-300 mb-1.5">
                  Correo Electrónico <span className="text-amber-400">*</span>
                </label>
                <input
                  id="customerEmail"
                  type="email"
                  required
                  maxLength={255}
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="ej. agustin@gmail.com"
                  className="w-full px-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 text-sm"
                />
                <span className="text-[11px] text-zinc-400 mt-1 block">Recibirás la confirmación de tu turno aquí.</span>
              </div>

              <div>
                <label htmlFor="customerPhone" className="block text-xs font-semibold uppercase tracking-wider text-zinc-300 mb-1.5">
                  Teléfono / WhatsApp <span className="text-amber-400">*</span>
                </label>
                <input
                  id="customerPhone"
                  type="tel"
                  required
                  maxLength={50}
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="ej. +54 9 11 4455-6677"
                  className="w-full px-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 text-sm"
                />
                <span className="text-[11px] text-zinc-400 mt-1 block">Para avisos sobre tu turno.</span>
              </div>
            </div>
          </div>

          {bookingError && (
            <div className="p-3.5 rounded-lg bg-red-950/50 border border-red-500/50 text-red-200 text-sm flex items-start gap-2">
              <span className="text-red-400 font-bold">✕</span>
              <span>{bookingError}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={isPending}
              className="text-sm text-zinc-400 hover:text-zinc-200"
            >
              &larr; Volver a horarios
            </button>

            <button
              type="submit"
              disabled={isPending}
              className="px-6 py-3 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold text-sm transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-amber-500/10"
            >
              {isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
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
          <div className="w-16 h-16 rounded-full bg-amber-400/10 border-2 border-amber-400 text-amber-400 flex items-center justify-center mx-auto text-2xl font-bold shadow-lg shadow-amber-400/20">
            ✓
          </div>

          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-zinc-100">¡Turno Confirmado!</h2>
            <p className="text-zinc-400 text-sm mt-1">
              Gracias <strong className="text-zinc-200">{confirmedBooking.customerName}</strong>. Te esperamos en Rove Barbería.
            </p>
          </div>

          {/* Tarjeta de resumen del turno */}
          <div className="max-w-md mx-auto p-5 rounded-xl bg-zinc-900/60 border border-zinc-800 text-left space-y-3">
            <div className="flex justify-between items-center pb-3 border-b border-zinc-800/80">
              <span className="text-xs text-zinc-400 uppercase tracking-wider">Servicio</span>
              <span className="text-sm font-semibold text-zinc-100">{confirmedBooking.serviceName}</span>
            </div>

            <div className="flex justify-between items-center pb-3 border-b border-zinc-800/80">
              <span className="text-xs text-zinc-400 uppercase tracking-wider">Fecha y Hora</span>
              <span className="text-sm font-semibold text-amber-400">
                {selectedSlot?.dayLabel} a las {selectedSlot?.timeLabel} hs
              </span>
            </div>

            <div className="flex justify-between items-center pb-3 border-b border-zinc-800/80">
              <span className="text-xs text-zinc-400 uppercase tracking-wider">Duración</span>
              <span className="text-sm font-medium text-zinc-200">{confirmedBooking.durationMinutes} minutos</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-xs text-zinc-400 uppercase tracking-wider">Precio Total</span>
              <span className="text-base font-bold text-zinc-100">
                ${confirmedBooking.priceAmount.toLocaleString("es-AR")} ARS
              </span>
            </div>
          </div>

          <div className="max-w-md mx-auto text-xs text-zinc-400 space-y-2 bg-zinc-900/30 p-4 rounded-lg border border-zinc-800/60">
            <p>
              📧 Se ha emitido un correo de confirmación a <strong className="text-zinc-300">{confirmedBooking.customerEmail}</strong>.
            </p>
            <p>
              Si necesitás cancelar tu reserva en el futuro, podés hacerlo con un clic desde el correo o guardando este enlace:
            </p>
            {cancellationToken && (
              <Link
                href={`/cancelar/${cancellationToken}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-amber-400 hover:text-amber-300 underline font-mono text-[11px] break-all pt-1"
              >
                Ver enlace de cancelación
              </Link>
            )}
          </div>

          <div className="pt-4">
            <button
              type="button"
              onClick={handleReset}
              className="px-6 py-2.5 rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-sm font-medium transition-colors"
            >
              Agendar otro turno
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

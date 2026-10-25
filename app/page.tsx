import { DEFAULT_SERVICES } from "@/lib/constants/services";
import { BookingFlow } from "@/app/components/booking-flow";

export default function HomePage() {

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-amber-400 selection:text-zinc-950">
      {/* Barra de navegación */}
      <header className="sticky top-0 z-40 w-full border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="#" className="flex flex-col group">
              <span className="text-2xl font-black tracking-widest text-zinc-100 group-hover:text-amber-400 transition-colors uppercase font-serif">
                ROVE
              </span>
              <span className="text-[10px] tracking-[0.3em] text-amber-400 font-semibold uppercase">
                BARBERÍA
              </span>
            </a>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-400">
            <a href="#servicios" className="hover:text-zinc-100 transition-colors">
              Servicios
            </a>
            <a href="#experiencia" className="hover:text-zinc-100 transition-colors">
              Experiencia
            </a>
            <a href="#horarios" className="hover:text-zinc-100 transition-colors">
              Horarios & Ubicación
            </a>
          </nav>

          <a
            href="#reservar"
            className="px-5 py-2.5 rounded-full bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold text-xs sm:text-sm tracking-wide transition-all shadow-md shadow-amber-500/20"
          >
            Reservar Turno
          </a>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 pb-28 border-b border-zinc-800/60">
        {/* Glow de fondo */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs font-medium tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Sistema de Turnos Oficial — Buenos Aires
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-zinc-100 font-serif leading-[1.1]">
            El arte del corte clásico y la{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500">
              barbería contemporánea
            </span>
          </h1>

          <p className="max-w-2xl mx-auto text-base sm:text-lg text-zinc-400 leading-relaxed font-normal">
            Atención personalizada, toallas calientes, perfilado a navaja y puntualidad inglesa.
            Elegí tu servicio y asegurá tu turno en tiempo real.
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="#reservar"
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold text-sm tracking-wide transition-all shadow-lg shadow-amber-400/20"
            >
              Agendar Turno Online
            </a>
            <a
              href="#servicios"
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900 text-zinc-300 font-medium text-sm transition-colors"
            >
              Ver Servicios y Tarifas
            </a>
          </div>

          {/* Estadísticas / Sellos de confianza */}
          <div className="pt-12 grid grid-cols-2 sm:grid-cols-3 gap-6 max-w-3xl mx-auto border-t border-zinc-800/80 mt-12">
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-amber-400 font-serif">100%</div>
              <div className="text-xs sm:text-sm text-zinc-400 mt-0.5">Puntualidad y Sin Esperas</div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-amber-400 font-serif">4.9 / 5</div>
              <div className="text-xs sm:text-sm text-zinc-400 mt-0.5">Satisfacción de Clientes</div>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <div className="text-2xl sm:text-3xl font-extrabold text-amber-400 font-serif">1 a 1</div>
              <div className="text-xs sm:text-sm text-zinc-400 mt-0.5">Atención Exclusiva</div>
            </div>
          </div>
        </div>
      </section>

      {/* Sección del Agendador de Turnos */}
      <section id="reservar" className="py-20 px-4 sm:px-6 relative">
        <div className="max-w-4xl mx-auto mb-10 text-center space-y-2">
          <div className="text-xs font-bold tracking-[0.2em] text-amber-400 uppercase">
            Agenda Online
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-100 font-serif">
            Reservá tu Lugar
          </h2>
          <p className="text-sm text-zinc-400 max-w-md mx-auto">
            Seleccioná tu servicio, elegí el horario que más te convenga y recibí tu confirmación inmediata por email.
          </p>
        </div>

        {/* Componente Interactivo de Reserva */}
        <BookingFlow />
      </section>

      {/* Catálogo de Servicios Detallado */}
      <section id="servicios" className="py-20 px-4 sm:px-6 border-t border-zinc-800/80 bg-zinc-900/30">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center space-y-2">
            <div className="text-xs font-bold tracking-[0.2em] text-amber-400 uppercase">
              Catálogo de Servicios
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-100 font-serif">
              Cortes, Barba y Estilo
            </h2>
            <p className="text-sm text-zinc-400 max-w-md mx-auto">
              Precios transparentes en pesos argentinos. Incluye asesoramiento y productos de terminación.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {DEFAULT_SERVICES.map((service) => (
              <div
                key={service.id}
                className="p-6 rounded-2xl bg-zinc-950/60 border border-zinc-800/80 hover:border-zinc-700 transition-all space-y-4"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-bold text-zinc-100">{service.name}</h3>
                    <span className="text-xs text-zinc-400 mt-1 block">
                      Duración estimada: {service.durationMinutes} minutos
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-extrabold text-amber-400">
                      ${service.priceAmount.toLocaleString("es-AR")}
                    </span>
                    <span className="text-xs text-zinc-400 block">ARS</span>
                  </div>
                </div>

                <p className="text-sm text-zinc-400 leading-relaxed">
                  {service.description}
                </p>

                <div className="pt-2">
                  <a
                    href="#reservar"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:text-amber-300"
                  >
                    Agendar este servicio &rarr;
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Experiencia Rove */}
      <section id="experiencia" className="py-20 px-4 sm:px-6 border-t border-zinc-800/80">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center space-y-2">
            <div className="text-xs font-bold tracking-[0.2em] text-amber-400 uppercase">
              La Experiencia
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-100 font-serif">
              El Ritual Rove
            </h2>
            <p className="text-sm text-zinc-400 max-w-md mx-auto">
              Más que un corte de pelo, un momento de pausa y cuidado exclusivo para vos.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-8 text-center sm:text-left">
            <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/60 space-y-3">
              <div className="w-10 h-10 rounded-lg bg-amber-400/10 text-amber-400 flex items-center justify-center font-bold font-serif text-lg">
                01
              </div>
              <h3 className="text-lg font-bold text-zinc-100">Diagnóstico de Estilo</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Analizamos tus facciones, tipo de cabello y preferencias antes de la primera pasada de tijera para un resultado a medida.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/60 space-y-3">
              <div className="w-10 h-10 rounded-lg bg-amber-400/10 text-amber-400 flex items-center justify-center font-bold font-serif text-lg">
                02
              </div>
              <h3 className="text-lg font-bold text-zinc-100">Navaja y Toalla Caliente</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                El afeitado clásico como debe ser: preparación con vapor y toalla tibia, jabón batido a brocha y rasurado impecable.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/60 space-y-3">
              <div className="w-10 h-10 rounded-lg bg-amber-400/10 text-amber-400 flex items-center justify-center font-bold font-serif text-lg">
                03
              </div>
              <h3 className="text-lg font-bold text-zinc-100">Productos Seleccionados</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Utilizamos ceras mate, pomadas al agua y aceites hidratantes premium de absorción rápida para que salgas listo para el día.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Horarios y Ubicación */}
      <section id="horarios" className="py-20 px-4 sm:px-6 border-t border-zinc-800/80 bg-zinc-900/30">
        <div className="max-w-4xl mx-auto grid sm:grid-cols-2 gap-8 items-center">
          <div className="space-y-4">
            <div className="text-xs font-bold tracking-[0.2em] text-amber-400 uppercase">
              Ubicación & Horarios
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight text-zinc-100 font-serif">
              Te Esperamos en el Local
            </h2>
            <div className="space-y-3 text-sm text-zinc-400">
              <p className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">📍</span>
                <span>
                  <strong className="text-zinc-200">Palermo, Buenos Aires</strong>
                  <br />
                  Zona céntrica, de fácil acceso en transporte público.
                </span>
              </p>
              <p className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">🕒</span>
                <span>
                  <strong className="text-zinc-200">Lunes a Sábado:</strong> 10:00 a 19:00 hs
                  <br />
                  <span className="text-xs text-zinc-400">Domingos y feriados cerrado.</span>
                </span>
              </p>
              <p className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">💬</span>
                <span>
                  <strong className="text-zinc-200">WhatsApp:</strong> Atención y consultas directas.
                </span>
              </p>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 text-center space-y-4">
            <h3 className="text-lg font-bold text-zinc-100">¿Tenés alguna duda antes de venir?</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Los turnos se coordinan exclusivamente a través de nuestra plataforma online para garantizar tu lugar sin demoras.
            </p>
            <a
              href="#reservar"
              className="inline-block w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold text-sm transition-colors"
            >
              Ver Horarios Libres de Hoy
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800/80 bg-zinc-950 py-12 px-4 sm:px-6 text-zinc-400 text-xs">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-col items-center sm:items-start">
            <span className="text-base font-black tracking-widest text-zinc-100 uppercase font-serif">
              ROVE
            </span>
            <span className="text-[10px] tracking-wider text-amber-400 uppercase">
              BARBERÍA &bull; BUENOS AIRES
            </span>
          </div>

          <p className="text-center sm:text-right">
            &copy; 2026 Rove Barbería. Todos los derechos reservados.
            <br />
            Plataforma autónoma de reservas.
          </p>
        </div>
      </footer>
    </div>
  );
}

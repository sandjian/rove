import Link from "next/link";
import {
  Scissors,
  Sparkles,
  Award,
  Users,
  MapPin,
  Calendar,
  Clock,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
  Phone,
  Mail,
  Compass,
  Zap,
  Star,
  ExternalLink,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookingFlow } from "@/app/components/booking-flow";
import { MotionFade, MotionStaggerContainer, MotionStaggerItem } from "@/app/components/motion-fade";
import { AnimatedCounter } from "@/app/components/animated-counter";

export default function HomePage() {
  const stats = [
    {
      numericValue: 5,
      suffix: "+",
      label: "Trayectoria",
      icon: Award,
    },
    {
      numericValue: 12000,
      suffix: "+",
      label: "Cortes",
      icon: Scissors,
    },
    {
      numericValue: 2,
      suffix: "",
      label: "Locales",
      icon: Sparkles,
    },
  ];

  const services = [
    {
      number: "01",
      title: "Corte Clásico & Fade",
      description: "Corte a tijera o máquina con degradé artesanal milimétrico, textura precisa, lavado profundo y peinado con cera mate.",
      image: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=800&q=80",
      tags: ["Corte Clásico", "Skin Fade", "Tijera"],
    },
    {
      number: "02",
      title: "Perfilado & Barba",
      description: "Ritual completo con toalla caliente aromatizada, esculpido simétrico a navaja y tratamiento nutritivo con aceites orgánicos.",
      image: "https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=800&q=80",
      tags: ["Perfilado", "Toalla Térmica", "Navaja"],
    },
    {
      number: "03",
      title: "Eventos Especiales",
      description: "Servicio exclusivo in-situ o en salón para novios, graduaciones, fiestas de egresados y producciones con estilismo integral.",
      image: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=80",
      tags: ["Casamientos", "Egresados", "Producciones"],
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-taupe-800 via-taupe-400/40 to-[#f2ede4] text-slate-800 font-sans antialiased relative overflow-x-hidden selection:bg-[#a9773c]/20 selection:text-slate-900">
      {/* Fondo de esferas y reflejos luminosos (Glass ambient lighting camel cálido) */}
      <div className="fixed top-[-10%] right-[-5%] w-[600px] h-[600px] rounded-full bg-gradient-to-br from-[#a9773c]/15 via-[#c49257]/10 to-transparent blur-[130px] pointer-events-none -z-10" />
      <div className="fixed bottom-[-10%] left-[-5%] w-[650px] h-[650px] rounded-full bg-gradient-to-tr from-[#8d5e2a]/10 via-[#d4a86a]/15 to-transparent blur-[140px] pointer-events-none -z-10" />
      <div className="fixed top-[40%] left-[20%] w-[500px] h-[500px] rounded-full bg-gradient-to-r from-white/70 to-amber-50/40 blur-[100px] pointer-events-none -z-10" />

      {/* BOTÓN FLOTANTE CON EL LOGO OFICIAL DE WHATSAPP */}
      <a
        href="https://wa.me/5491148920091?text=Hola%20Rove%20Barbería,%20quisiera%20consultar%20por%20un%20turno"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Contactar por WhatsApp"
        className="fixed bottom-6 right-6 z-50 group flex items-center justify-center w-14 h-14 rounded-full bg-[#25D366] text-white shadow-[0_10px_25px_-4px_rgba(37,211,102,0.6)] hover:shadow-[0_15px_35px_-4px_rgba(37,211,102,0.8)] hover:scale-110 active:scale-95 transition-all duration-300 border-2 border-white/80"
      >
        {/* Anillo de pulso sutil */}
        <span className="absolute -inset-1 rounded-full bg-[#25D366] opacity-35 animate-ping pointer-events-none" />

        {/* Logo auténtico de WhatsApp: Burbuja de conversación y auricular telefónico nítido en blanco */}
        <svg
          className="w-8 h-8 relative z-10 drop-shadow-sm transition-transform duration-300 group-hover:scale-105"
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Contorno de la burbuja */}
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M16 3C8.82 3 3 8.82 3 16c0 2.45.68 4.75 1.87 6.72L3 29l6.47-1.83A12.93 12.93 0 0016 29c7.18 0 13-5.82 13-13S23.18 3 16 3zm0 23.82c-2.14 0-4.14-.59-5.86-1.62l-.42-.25-4.35 1.23 1.25-4.22-.27-.44A10.74 10.74 0 015.18 16c0-5.97 4.85-10.82 10.82-10.82S26.82 10.03 26.82 16 21.97 26.82 16 26.82z"
            fill="#ffffff"
          />
          {/* Teléfono / auricular interno relleno */}
          <path
            d="M21.72 19.34c-.31-.16-1.84-.91-2.12-1.01-.28-.1-.49-.16-.7.16-.21.31-.8 1.01-.98 1.22-.18.21-.36.23-.67.08-.31-.16-1.32-.49-2.52-1.56-.93-.83-1.56-1.86-1.74-2.17-.18-.31-.02-.48.14-.63.14-.14.31-.36.47-.55.16-.18.21-.31.31-.52.1-.21.05-.39-.03-.55-.08-.16-.7-1.69-.96-2.31-.25-.6-.51-.52-.7-.53l-.6-.01c-.21 0-.55.08-.83.39-.28.31-1.09 1.07-1.09 2.61s1.11 3.03 1.27 3.24c.16.21 2.19 3.34 5.31 4.69.74.32 1.32.51 1.77.66.75.24 1.43.21 1.97.13.6-.09 1.84-.75 2.1-1.48.26-.73.26-1.35.18-1.48-.08-.13-.28-.21-.59-.36z"
            fill="#ffffff"
          />
        </svg>
      </a>

      {/* CONTENEDOR PRINCIPAL */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8 sm:space-y-12">
        {/* ========================================================================= */}
        {/* 1. HERO SECTION & NAVBAR REPLICADA EN CONTENEDOR GLASSMORFISMO */}
        {/* ========================================================================= */}
        <section className="relative rounded-[2rem] sm:rounded-[2.5rem] bg-white/45 backdrop-blur-2xl border border-white/70 shadow-[0_12px_40px_0_rgba(169,119,60,0.06)] p-6 sm:p-10 lg:p-12 overflow-hidden">
          {/* Brillo especular superior */}
          <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white to-transparent opacity-80" />

          {/* BARRA DE NAVEGACIÓN SUPERIOR */}
          <header className="relative z-10 flex items-center justify-between pb-8 sm:pb-12 border-b border-amber-900/10">
            {/* Logo a la izquierda */}
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#a9773c] via-[#c49257] to-[#8d5e2a] flex items-center justify-center text-white shadow-sm shadow-[#a9773c]/40 font-bold text-xs group-hover:scale-105 transition-transform">
                R
              </div>
              <span className="font-sans font-bold text-sm sm:text-base tracking-[0.2em] text-slate-900 uppercase">
                ROVE GLASS
              </span>
            </Link>

            {/* Enlaces a la derecha */}
            <nav className="flex items-center gap-5 sm:gap-7 text-xs font-semibold uppercase tracking-wider text-slate-600">
              <a href="#servicios" className="hover:text-[#a9773c] transition-colors">
                Servicios
              </a>
              <a href="#reservar" className="hover:text-[#a9773c] transition-colors hidden md:inline-block">
                Reservas
              </a>
              <a href="#eventos" className="hover:text-[#a9773c] transition-colors">
                Eventos
              </a>
            </nav>
          </header>

          {/* CONTENIDO DEL HERO */}
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center pt-10 sm:pt-14 pb-4">
            {/* LADO IZQUIERDO: TÍTULO GIGANTE CRISTALINO, SUBTÍTULO Y BOTONES */}
            <div className="lg:col-span-7 space-y-6 sm:space-y-8">
              <MotionFade delay={0.1}>
                {/* Título estilo 3D cromo/cristal de NOVA GLASS */}
                <h1 className="font-sans font-bold text-4xl sm:text-6xl md:text-7xl lg:text-8xl tracking-[0.04em] uppercase leading-[0.95] select-none text-transparent bg-clip-text bg-gradient-to-b from-slate-900 via-slate-700 to-slate-400 drop-shadow-[0_4px_12px_rgba(255,255,255,0.9)]">
                  ROVE <br />
                  <span className="tracking-[0.08em] bg-clip-text text-transparent bg-gradient-to-r from-slate-800 via-amber-950 to-slate-600">
                    BARBER
                  </span>
                </h1>
              </MotionFade>

              <MotionFade delay={0.2}>
                <div className="text-base sm:text-lg font-semibold tracking-wide text-slate-800 uppercase font-sans">
                  Barbería de Autor &amp; Asesoría de Estilo
                </div>
              </MotionFade>

              <MotionFade delay={0.3}>
                <p className="text-sm sm:text-base text-slate-600 max-w-lg font-normal leading-relaxed">
                  Desde cortes clásicos hasta degradados modernos bajo una atmósfera de calma y confort.
                </p>
              </MotionFade>

              <MotionFade delay={0.4}>
                <div className="flex flex-wrap items-center gap-4 pt-2">
                  {/* Botón primario degradé camel con hover elevado */}
                  <Button
                    size="lg"
                    render={
                      <a
                        href="#reservar"
                        className="group relative rounded-2xl bg-gradient-to-r from-[#a9773c] via-[#c49257] to-[#8d5e2a] text-white font-semibold text-xs tracking-wider uppercase px-8 py-5 h-auto transition-all duration-300 hover:scale-[1.03] active:scale-95 shadow-[0_10px_25px_-5px_rgba(169,119,60,0.4)] hover:shadow-[0_16px_35px_-5px_rgba(169,119,60,0.6)] flex items-center gap-2 border border-white/10 overflow-hidden"
                      >
                        <span className="relative z-10 flex items-center gap-2">
                          Reservar Turno ↓
                        </span>
                        {/* Brillo dinámico en hover */}
                        <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none" />
                      </a>
                    }
                  />

                  {/* Botón secundario contorno translúcido */}
                  <Button
                    variant="outline"
                    size="lg"
                    render={
                      <a
                        href="#servicios"
                        className="rounded-2xl border-white/80 bg-white/70 hover:bg-white text-slate-700 hover:text-[#a9773c] font-semibold text-xs tracking-wider uppercase px-7 py-5 h-auto backdrop-blur-md transition-all duration-200 shadow-sm hover:shadow-md hover:scale-[1.02] flex items-center gap-1.5"
                      >
                        Ver Servicios <ArrowUpRight className="w-3.5 h-3.5" />
                      </a>
                    }
                  />
                </div>
              </MotionFade>
            </div>

            {/* LADO DERECHO: IMAGEN DEL BARBERO CON MINIMAPA GLASSMORFICO DESFASADO (oculto en pantallas menores a lg) Y SELLO 360 */}
            <div className="lg:col-span-5 relative flex justify-center pt-6 lg:pt-0">
              <MotionFade delay={0.3} direction="left">
                <div className="relative w-full max-w-sm sm:max-w-md aspect-[4/5] rounded-[2rem] p-2.5 bg-white/40 border border-white/80 shadow-[0_20px_50px_rgba(169,119,60,0.08)] backdrop-blur-xl">
                  {/* Contenedor de la foto */}
                  <div className="relative w-full h-full rounded-[1.6rem] overflow-hidden bg-slate-100">
                    <img
                      src="https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=1000&q=80"
                      alt="Barbero Rove"
                      className="w-full h-full object-cover object-center filter contrast-[1.05] brightness-[1.02]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-slate-950/10 to-transparent pointer-events-none" />
                  </div>

                  {/* MINI MAPA GLASSMÓRFICO DESFASADO (Oculto para pantallas menores a lg: hidden lg:block) */}
                  <div className="hidden lg:block absolute -top-6 -left-4 sm:-top-24 sm:-left-48 z-20 w-72 sm:w-80 rounded-[1.7rem] bg-white backdrop-blur-2xl border border-white shadow-[0_16px_40px_rgba(169,119,60,0.15)] p-2 space-y-3 transition-all hover:scale-[1.02] group">
                    {/* Contenedor Cartográfico de Autor estilo Uber / Mapbox Light */}
                    <div className="relative w-full h-36 rounded-2xl overflow-hidden bg-[#ededf2] border border-slate-200/80 shadow-inner select-none">
                      {/* Cuadrícula Cartográfica Vectorial 1:1 estilo Uber / Apple Maps Minimalista */}
                      <svg
                        className="w-full h-full object-cover"
                        viewBox="0 0 340 160"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        {/* 1. Tierra / Manzanas urbanas base */}
                        <rect width="340" height="160" fill="#ededf2" />

                        {/* 2. Parques y Espacios Verdes Geométricos estilo Uber */}
                        <path
                          d="M135 0 L168 0 L158 12 L130 12 Z"
                          fill="#b2e2c2"
                        />
                        <path
                          d="M205 0 L235 0 L250 20 L250 50 L238 60 L188 60 L188 18 Z"
                          fill="#b2e2c2"
                        />
                        <path
                          d="M110 32 L122 32 L122 98 L104 98 L94 86 L100 52 L110 46 Z"
                          fill="#b2e2c2"
                        />
                        <path
                          d="M198 70 L210 70 L210 108 L194 128 L178 112 L178 84 L188 74 Z"
                          fill="#b2e2c2"
                        />
                        <path
                          d="M230 135 L252 135 L252 160 L230 160 Z"
                          fill="#b2e2c2"
                        />
                        {/* Costanera / Agua en la esquina este */}
                        <path d="M0 135 L12 135 L12 160 L0 160 Z" fill="#a8cbf5" />

                        {/* 3. Calles y Avenidas en blanco nítido */}
                        {/* Avenidas verticales */}
                        <rect x="0" y="0" width="12" height="160" fill="#ffffff" />
                        <rect x="60" y="0" width="9" height="160" fill="#ffffff" />
                        {/* Calle San Juan (Avenida destacada) */}
                        <rect x="125" y="0" width="12" height="160" fill="#ffffff" />
                        <rect x="185" y="0" width="10" height="160" fill="#ffffff" />
                        <rect x="250" y="0" width="11" height="160" fill="#ffffff" />

                        {/* Diagonales de intersección */}
                        <path d="M80 160 L185 65 L196 73 L100 160 Z" fill="#ffffff" />
                        <path d="M185 65 L250 125 L242 133 L178 73 Z" fill="#ffffff" />

                        {/* Calles horizontales (Av. Luro, San Martín, Rivadavia) */}
                        <rect x="0" y="20" width="340" height="9" fill="#ffffff" />
                        <rect x="0" y="55" width="340" height="10" fill="#ffffff" />
                        <rect x="125" y="90" width="215" height="9" fill="#ffffff" />
                        <rect x="0" y="122" width="340" height="9" fill="#ffffff" />

                        {/* Separadores de manzanas */}
                        <rect x="152" y="20" width="8" height="35" fill="#ffffff" />

                        {/* Trazado de ruta GPS camel/ámbar con destino en la barbería */}
                        <path
                          d="M64 126 L64 60 L131 60 L131 35"
                          stroke="#c49257"
                          strokeWidth="3.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />

                        {/* Etiquetas tipográficas ultra-finas de calles */}
                        <text x="131" y="12" fill="#94a3b8" fontSize="6.5" fontWeight="700" letterSpacing="0.8">
                          SAN JUAN
                        </text>
                        <text x="16" y="52" fill="#94a3b8" fontSize="6" fontWeight="600" letterSpacing="0.5">
                          AV. PEDRO LURO
                        </text>
                        <text x="16" y="119" fill="#94a3b8" fontSize="6" fontWeight="600" letterSpacing="0.5">
                          RIVADAVIA
                        </text>
                      </svg>

                      {/* Sombra viñeta interna de vidrio suave */}
                      <div className="absolute inset-0 ring-1 ring-inset ring-slate-900/5 rounded-2xl pointer-events-none" />

                      {/* Marcador GPS / Pin con estilo de autor camel */}
                      <div className="absolute top-[10%] left-[38.5%] -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none">
                        <span className="absolute w-12 h-12 rounded-full bg-[#a9773c]/30 animate-ping" />
                        <span className="absolute w-7 h-7 rounded-full bg-[#c49257]/30 animate-pulse" />

                        {/* Pin elegante estilo Uber */}
                        <div className="relative flex flex-col items-center">
                          <div className="w-7 h-7 rounded-full bg-slate-900 border-2 border-white shadow-xl flex items-center justify-center text-white">
                            <Scissors className="w-3.5 h-3.5 text-amber-300 -rotate-45" />
                          </div>
                          <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[5px] border-t-slate-900 -mt-[1px]" />
                        </div>
                      </div>
                    </div>

                    {/* Información de dirección y llamado a la acción */}
                    <div className="flex items-center justify-between gap-3 pt-0.5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 px-1">
                          <h4 className="text-xs font-bold text-slate-900 tracking-tight truncate">San Juan 910</h4>
                          <span className="text-[10px] text-amber-500 font-bold shrink-0">
                            ★ 4.9
                          </span>
                        </div>
                        <p className="text-[11px] p-1 text-slate-500 truncate">Mar del Plata &bull; Buenos Aires</p>
                      </div>

                      {/* Botón interactivo a Google Maps */}
                      <a
                        href="https://www.google.com/maps/search/?api=1&query=Rove+barbería+y+peluquería,+San+Juan+910,+Mar+del+Plata"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#a9773c] to-[#c49257] hover:from-[#c49257] hover:to-[#a9773c] text-white font-semibold text-[11px] transition-all shadow-sm shadow-[#a9773c]/30 flex items-center gap-1 hover:scale-105"
                      >
                        <span>Cómo llegar</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>

                  {/* Sello circular flotante giratorio en la esquina inferior derecha con texto 100% circunferencia */}
                  <div className="absolute -bottom-3 -right-3 sm:-bottom-4 sm:-right-4 w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-white/90 border border-white shadow-[0_12px_36px_rgba(169,119,60,0.18)] backdrop-blur-2xl flex items-center justify-center p-2 group cursor-pointer hover:scale-105 transition-transform z-20">
                    <div className="relative w-full h-full flex items-center justify-center">
                      {/* Texto circular giratorio que abarca el 100% exacto de la circunferencia */}
                      <svg className="w-full h-full animate-[spin_14s_linear_infinite]" viewBox="0 0 100 100">
                        <path
                          id="circlePath360"
                          d="M 50, 50 m -37, 0 a 37,37 0 1,1 74,0 a 37,37 0 1,1 -74,0"
                          fill="none"
                        />
                        <text className="text-[7.6px] uppercase font-bold tracking-[0.16em] fill-slate-700">
                          <textPath href="#circlePath360">
                            ROVE BARBERIA &bull; EST. 2026 &bull; BUENOS AIRES &bull;
                          </textPath>
                        </text>
                      </svg>
                      {/* Ícono central brillante con degradé camel */}
                      <div className="absolute inset-0 flex items-center justify-center text-[#a9773c]">
                        <div className="w-9 h-9 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center shadow-inner">
                          <Sparkles className="w-4 h-4 text-[#a9773c] animate-pulse" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </MotionFade>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 2. STATS (CINTA DE ESTADÍSTICAS BREVE: 3 MÉTRICAS + FILOSOFÍA) */}
        {/* ========================================================================= */}
        <section className="relative">
          <MotionFade delay={0.2}>
            <div className="rounded-[2rem] sm:rounded-[2.2rem] bg-white/50 backdrop-blur-2xl border border-white/70 shadow-[0_8px_32px_0_rgba(169,119,60,0.06)] p-8 sm:p-10">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-6 items-center">
                {/* 3 columnas de estadísticas con AnimatedCounter */}
                <div className="md:col-span-7 grid grid-cols-3 gap-4 sm:gap-6 divide-x divide-amber-900/10">
                  {stats.map((item, idx) => {
                    const Icon = item.icon;
                    return (
                      <div key={idx} className={idx !== 0 ? "pl-4 sm:pl-6" : ""}>
                        <div className="w-8 h-8 rounded-xl bg-amber-50/90 border border-amber-200/60 flex items-center justify-center text-[#a9773c] mb-3 shadow-inner">
                          <Icon className="w-4 h-4 stroke-[1.8]" />
                        </div>
                        <div className="font-sans font-bold text-2xl sm:text-3xl text-slate-900 tracking-tight">
                          <AnimatedCounter value={item.numericValue} suffix={item.suffix} />
                        </div>
                        <div className="text-xs font-semibold text-slate-800 uppercase tracking-wider mt-1.5">
                          {item.label}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Bloque de filosofía Rove renovado a la derecha */}
                <div className="md:col-span-5 border-t md:border-t-0 md:border-l border-amber-900/10 pt-6 md:pt-0 md:pl-8 space-y-2">
                  <p className="text-xs sm:text-sm text-slate-700 font-medium italic leading-relaxed">
                    &ldquo;El corte que se adapta a tu cara y estilo.&rdquo;
                  </p>
                  <div className="text-[11px] font-bold text-[#a9773c] uppercase tracking-widest">
                    — Filosofía Rove
                  </div>
                </div>
              </div>
            </div>
          </MotionFade>
        </section>

        {/* ========================================================================= */}
        {/* 3. SERVICIOS DESTACADOS (FEATURED CASE STUDIES EN 3 COLUMNAS) */}
        {/* ========================================================================= */}
        <section id="servicios" className="space-y-6">
          {/* Header de sección */}
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
              <span className="w-2 h-2 rounded-full bg-[#a9773c]" />
              Servicios Destacados
            </div>
            <div className="hidden sm:flex items-center gap-2 text-slate-400 text-xs">
              <span className="cursor-pointer hover:text-slate-800">&larr;</span>
              <span className="cursor-pointer hover:text-slate-800">&rarr;</span>
            </div>
          </div>

          <MotionStaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {services.map((srv, idx) => (
              <MotionStaggerItem key={idx}>
                <div className="group rounded-[2rem] bg-white/45 backdrop-blur-2xl border border-white/70 shadow-[0_8px_32px_0_rgba(169,119,60,0.06)] hover:shadow-[0_16px_40px_0_rgba(169,119,60,0.12)] p-6 sm:p-7 transition-all duration-300 flex flex-col justify-between space-y-6 hover:-translate-y-1">
                  {/* Imagen superior con número indicador */}
                  <div className="relative aspect-[16/10] rounded-[1.4rem] overflow-hidden bg-slate-100 shadow-inner">
                    <img
                      src={srv.image}
                      alt={srv.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute top-3 left-3 px-2.5 py-1 rounded-xl bg-black/50 backdrop-blur-md text-white text-[10px] font-bold tracking-widest uppercase">
                      {srv.number}
                    </div>
                  </div>

                  {/* Título y descripción */}
                  <div className="space-y-2">
                    <h3 className="font-sans font-bold text-lg text-slate-900 group-hover:text-[#a9773c] transition-colors">
                      {srv.title}
                    </h3>
                    <p className="text-xs sm:text-[13px] text-slate-600 font-normal leading-relaxed h-20">
                      {srv.description}
                    </p>
                  </div>

                  {/* Etiquetas estilo píldora inferiores (Pills) */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-amber-900/10">
                    {srv.tags.map((tag, tIdx) => (
                      <span
                        key={tIdx}
                        className="px-3 py-1 rounded-full bg-white/80 border border-amber-100/70 shadow-sm text-[10px] font-medium text-slate-700 uppercase tracking-wider"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </MotionStaggerItem>
            ))}
          </MotionStaggerContainer>
        </section>

        {/* ========================================================================= */}
        {/* 4. FORMULARIO DE RESERVA / TURNERO (ESPACIO OPTIMIZADO - SIN DOBLE CONTENEDOR) */}
        {/* ========================================================================= */}
        <section id="reservar" className="scroll-mt-24 space-y-6">
          <MotionFade delay={0.1}>
            <div className="flex items-center gap-2 px-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
              <span className="w-2 h-2 rounded-full bg-[#a9773c]" />
              Agenda Online en Tiempo Real
            </div>
          </MotionFade>

          {/* Contenedor Bento unificado para el turnero */}
          <MotionFade delay={0.2}>
            <div className="rounded-[2.2rem] sm:rounded-[2.5rem] bg-white/50 backdrop-blur-2xl border border-white/70 shadow-[0_12px_40px_0_rgba(169,119,60,0.06)] p-6 sm:p-8 lg:p-10">
              <div className="max-w-3xl mx-auto text-center space-y-2.5 mb-8">
                <h2 className="font-sans font-bold text-2xl sm:text-3xl text-slate-900 uppercase tracking-tight">
                  Seleccioná tu Turno
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 font-normal">
                  Elegí el servicio, el barbero, el día y el horario disponible. Confirmación inmediata vía correo electrónico.
                </p>
              </div>

              {/* Client Component de Turnos directo sin anidación redundante */}
              <BookingFlow />
            </div>
          </MotionFade>
        </section>

        {/* ========================================================================= */}
        {/* 5. SECCIÓN DE EVENTOS & CANALES OFICIALES (ROVE ON-DEMAND) */}
        {/* ========================================================================= */}
        <footer id="eventos" className="pt-4 pb-8 space-y-8">
          <MotionFade delay={0.2}>
            <div className="rounded-[2.2rem] sm:rounded-[2.5rem] bg-white/50 backdrop-blur-2xl border border-white/70 shadow-[0_16px_45px_0_rgba(169,119,60,0.08)] p-8 sm:p-12 lg:p-14 relative overflow-hidden">
              {/* Brillo especular superior */}
              <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white to-transparent opacity-90" />

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
                {/* IZQUIERDA: COMUNICACIÓN CORPORATIVA & PROPUESTA ON-DEMAND */}
                <div className="lg:col-span-7 space-y-6">
                  {/* Encabezado Corporativo con Monograma de Marca */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-5">
                    {/* Monograma corporativo Rove sobre degradado camel */}
                    <div className="relative group shrink-0">
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-[1.6rem] bg-gradient-to-tr from-[#a9773c] via-[#c49257] to-[#8d5e2a] border-2 border-white/90 shadow-lg shadow-[#a9773c]/30 flex items-center justify-center text-white font-bold text-2xl sm:text-3xl select-none group-hover:scale-105 transition-transform duration-300">
                        R
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white border border-amber-100 flex items-center justify-center text-[#a9773c] shadow-xs">
                        <Sparkles className="w-3 h-3" />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <h2 className="font-sans font-bold text-2xl sm:text-3xl lg:text-4xl text-slate-900 tracking-tight leading-tight">
                        ROVE EN TU EVENTO
                      </h2>
                    </div>
                  </div>

                  {/* Propuesta de Marca */}
                  <div className="space-y-3 text-slate-600 text-xs sm:text-sm leading-relaxed">
                    <p>
                      Llevamos la experiencia de <strong>Rove Barbería</strong> directamente a tu evento. Atención personalizada para que cada detalle refleje la importancia del momento.
                    </p>
                    <p className="text-slate-500">
                      Servicio integral orientado a <strong>casamientos, fiestas de egresados, celebraciones corporativas y producciones audiovisuales</strong>. Montaje in-situ con estándares de barbería de autor.
                    </p>
                  </div>

                  {/* Highlights en píldoras */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="px-3 py-1.5 rounded-xl bg-white/80 border border-amber-900/10 text-slate-700 text-[11px] font-medium shadow-xs">
                      Fiestas de Egresados
                    </span>
                    <span className="px-3 py-1.5 rounded-xl bg-white/80 border border-amber-900/10 text-slate-700 text-[11px] font-medium shadow-xs">
                      Casamientos & Grooming
                    </span>
                    <span className="px-3 py-1.5 rounded-xl bg-white/80 border border-amber-900/10 text-slate-700 text-[11px] font-medium shadow-xs">
                      Producciones & Shooting
                    </span>

                  </div>

                  {/* Botón CTA Corporativo */}
                  <div className="pt-2">
                    <a
                      href="https://wa.me/5491148920091?text=Hola%20Rove%20Barbería,%20nos%20gustaría%20cotizar%20un%20servicio%20para%20un%20evento"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#a9773c] via-[#c49257] to-[#8d5e2a] text-white font-semibold text-xs uppercase tracking-wider px-8 py-4.5 h-auto transition-all duration-300 hover:scale-[1.02] active:scale-95 shadow-[0_12px_28px_-6px_rgba(169,119,60,0.45)] hover:shadow-[0_18px_36px_-6px_rgba(169,119,60,0.6)] inline-flex items-center gap-2 border border-white/40"
                    >
                      <Scissors className="w-4 h-4 stroke-[1.8]" />
                      <span>Cotizar Evento</span>
                      <span className="transition-transform duration-300 group-hover:translate-x-1">&rarr;</span>
                    </a>
                  </div>
                </div>

                {/* DERECHA: CANALES OFICIALES */}
                <div className="lg:col-span-5 space-y-5 text-xs text-slate-600 border-t lg:border-t-0 lg:border-l border-amber-900/10 pt-6 lg:pt-0 lg:pl-10">
                  <div>
                    <div className="text-[11px] font-bold text-slate-800 uppercase tracking-widest mb-1">
                      Canales Oficiales
                    </div>
                    <p className="text-slate-500 text-[11px]">
                      Atención exclusiva y consultas para servicios corporativos y privados.
                    </p>
                  </div>

                  {/* Lista en orden estricto: WhatsApp, Instagram, Correo Electrónico, Salón Principal */}
                  <div className="space-y-3.5">
                    {/* 1. WhatsApp */}
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-white border border-amber-100 shadow-xs flex items-center justify-center text-[#a9773c] shrink-0">
                        <MessageCircle className="w-4 h-4 stroke-[1.8]" />
                      </div>
                      <div>
                        <div className="text-[10px] uppercase font-semibold text-slate-400">WhatsApp</div>
                        <a
                          href="https://wa.me/5491148920091"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-800 font-semibold hover:text-[#a9773c] transition-colors"
                        >
                          +54 9 11 4892-0091
                        </a>
                      </div>
                    </div>

                    {/* 2. Instagram */}
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-white border border-amber-100 shadow-xs flex items-center justify-center text-[#a9773c] shrink-0">
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="w-4 h-4"
                          aria-hidden="true"
                        >
                          <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                          <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
                        </svg>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase font-semibold text-slate-400">Instagram</div>
                        <a
                          href="https://instagram.com/rovebarberia"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-800 font-semibold hover:text-[#a9773c] transition-colors"
                        >
                          @rovebarberia
                        </a>
                      </div>
                    </div>

                    {/* 3. Correo Electrónico */}
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-white border border-amber-100 shadow-xs flex items-center justify-center text-[#a9773c] shrink-0">
                        <Mail className="w-4 h-4 stroke-[1.8]" />
                      </div>
                      <div>
                        <div className="text-[10px] uppercase font-semibold text-slate-400">Correo Electrónico</div>
                        <a
                          href="mailto:contacto@rovebarberia.com"
                          className="text-slate-800 font-semibold hover:text-[#a9773c] transition-colors"
                        >
                          contacto@rovebarberia.com
                        </a>
                      </div>
                    </div>

                    {/* 4. Salón Principal (Ubicación) */}
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-white border border-amber-100 shadow-xs flex items-center justify-center text-[#a9773c] shrink-0">
                        <MapPin className="w-4 h-4 stroke-[1.8]" />
                      </div>
                      <div>
                        <div className="text-[10px] uppercase font-semibold text-slate-400">Salón Principal</div>
                        <span className="text-slate-800 font-medium">San Juan 910, B7600 Mar del Plata</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </MotionFade>

          {/* Copyright y links inferiores */}
          <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 px-4 gap-4">
            <div>
              &copy; 2026 ROVE Barbería. Todos los derechos reservados.
            </div>
            <div className="flex items-center gap-6">
              <Link href="/admin/login" className="hover:text-slate-800 transition-colors">
                Acceso Barbero
              </Link>
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="hover:text-slate-800 transition-colors">
                Instagram
              </a>
              <a href="#servicios" className="hover:text-slate-800 transition-colors">
                Servicios
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

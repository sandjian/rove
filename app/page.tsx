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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { BookingFlow } from "@/app/components/booking-flow";
import { MotionFade, MotionStaggerContainer, MotionStaggerItem } from "@/app/components/motion-fade";
import { TiltedGridHero } from "@/app/components/tilted-grid-hero";

export default function HomePage() {
  const stats = [
    { value: "8+", label: "Años de Oficio", icon: Award },
    { value: "15k+", label: "Cortes Realizados", icon: Scissors },
    { value: "99%", label: "Clientes Satisfechos", icon: Users },
    { value: "100%", label: "Precisión y Estilo", icon: Sparkles },
  ];

  const heroGallery = [
    {
      src: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=1000&q=80",
      alt: "Corte clásico Rove",
    },
    {
      src: "https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=1000&q=80",
      alt: "Ritual de toalla caliente y navaja",
    },
    {
      src: "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=1000&q=80",
      alt: "Herramientas de barbería de autor",
    },
    {
      src: "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=1000&q=80",
      alt: "Perfilado milimétrico de barba",
    },
    {
      src: "https://images.unsplash.com/photo-1534778101976-62847782c213?auto=format&fit=crop&w=1000&q=80",
      alt: "Detalle de degradado y fade",
    },
    {
      src: "https://images.unsplash.com/photo-1622286342621-4bd786c2447c?auto=format&fit=crop&w=1000&q=80",
      alt: "Ambiente exclusivo salón Rove",
    },
  ];

  const servicesBento = [
    {
      id: "corte-clasico",
      title: "Corte Clásico & Fade",
      subtitle: "ESPECIALIDAD ROVE",
      category: "CABELLO",
      description:
        "Corte a tijera o máquina con degradé artesanal a milímetro. Lavado premium, acabado a navaja japonesa y peinado con ceras de fijación mate.",
      duration: "35 min",
      price: "$12.000",
      featured: true,
      tag: "Más solicitado",
    },
    {
      id: "perfilado-barba",
      title: "Perfilado & Ritual de Barba",
      subtitle: "TRATAMIENTO COMPLETO",
      category: "BARBERÍA",
      description:
        "Toalla caliente aromatizada con aceites esenciales, rebajado simétrico, navaja templada y bálsamo nutritivo calmante.",
      duration: "30 min",
      price: "$8.000",
      featured: false,
      tag: "Ritual Tradicional",
    },
    {
      id: "combo-rove",
      title: "Experiencia Total Rove",
      subtitle: "CORTE + BARBA + SPA",
      category: "EXPERIENCIA EXCLUSIVA",
      description:
        "El servicio insignia: corte integral, esculpido de barba con toalla térmica, exfoliación facial suave y refrigerio de cortesía.",
      duration: "55 min",
      price: "$18.000",
      featured: false,
      tag: "Completo",
    },
  ];

  const capabilities = [
    {
      title: "Asesoramiento de Visagismo",
      desc: "Evaluamos la fisonomía de tu rostro y tipo de cabello para recomendarte el corte que mejor proyecta tu imagen.",
    },
    {
      title: "Higiene y Esterilización Grado Hospitalario",
      desc: "Herramientas desinfectadas con rayos UV y autoclaves entre cliente y cliente. Hojas de navaja 100% descartables.",
    },
    {
      title: "Productos de Gama Alta",
      desc: "Fórmulas importadas sin parabenos: pomadas con fijación natural, aceites de jojoba y champús botánicos.",
    },
    {
      title: "Puntualidad Absoluta sin Esperas",
      desc: "Respetamos el horario de tu turno al segundo. Tu tiempo es sagrado, sin demoras de salón tradicional.",
    },
    {
      title: "Espacio Íntimo y Exclusivo",
      desc: "Ambiente reservado, acústica cuidada, café espresso de especialidad o bebidas frías seleccionadas.",
    },
    {
      title: "Confirmación y Gestión Digital",
      desc: "Notificaciones automáticas a tu casilla con enlace para cancelar o reprogramar sin necesidad de llamar por teléfono.",
    },
  ];

  const processSteps = [
    {
      number: "01",
      title: "RESERVA",
      desc: "Elegís tu horario ideal y servicio en nuestro turnero online en menos de 1 minuto.",
    },
    {
      number: "02",
      title: "CONSULTA",
      desc: "Charlamos sobre el estilo que buscás, textura de cabello y mantenimiento deseado.",
    },
    {
      number: "03",
      title: "CORTE & RITUAL",
      desc: "Técnica precisa de barbería clásica, toalla caliente y productos de autor.",
    },
    {
      number: "04",
      title: "DETALLE FINAL",
      desc: "Perfilado a navaja, limpieza de cuello y peinado profesional duradero.",
    },
    {
      number: "05",
      title: "RESULTADO",
      desc: "Salís con un estilo impecable, seguridad total y frescura renovada.",
    },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-zinc-100 selection:bg-zinc-200 selection:text-zinc-950 font-sans antialiased overflow-x-hidden">
      {/* Glow de fondo superior sutil */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[450px] bg-gradient-to-b from-zinc-800/15 via-transparent to-transparent blur-[140px] pointer-events-none -z-10" />

      {/* NAVBAR */}
      <header className="sticky top-0 z-50 w-full border-b border-zinc-800/60 bg-[#0a0a0c]/85 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Logo Monograma / Identidad */}
          <Link href="/" className="flex items-center gap-2 group">
            <span className="font-['Krona_One',sans-serif] text-xl sm:text-2xl tracking-[0.2em] font-extrabold text-zinc-100 group-hover:text-zinc-300 transition-colors uppercase">
              ROVE
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 group-hover:bg-zinc-100 transition-colors" />
          </Link>

          {/* Menú de Navegación */}
          <nav className="hidden md:flex items-center gap-8 text-xs font-medium tracking-widest uppercase text-zinc-400">
            <a href="#servicios" className="hover:text-zinc-100 transition-colors">
              Servicios
            </a>
            <a href="#filosofia" className="hover:text-zinc-100 transition-colors">
              Filosofía
            </a>
            <a href="#proceso" className="hover:text-zinc-100 transition-colors">
              Experiencia
            </a>
            <a href="#ubicacion" className="hover:text-zinc-100 transition-colors">
              Ubicación
            </a>
          </nav>

          {/* CTA Header */}
          <div className="flex items-center gap-3">
            <Button
              render={
                <a
                  href="#reservar"
                  className="rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-semibold text-xs tracking-wider uppercase px-5 py-2.5 h-auto transition-transform active:scale-95 shadow-sm"
                >
                  Reservar Turno ↗
                </a>
              }
            />
          </div>
        </div>
      </header>

      {/* CONTENEDOR PRINCIPAL */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 space-y-24 sm:space-y-32">
        {/* ========================================================================= */}
        {/* HERO SECTION CON TILTED CYLINDRICAL 3D GRID Y TEXTOS CENTRADOS */}
        {/* ========================================================================= */}
        <section className="relative -mt-4 sm:-mt-6">
          <TiltedGridHero
            images={heroGallery}
            speed={4.5}
            tileHeight={30}
            aspectRatio={16 / 9}
            gap={6}
            axis={72}
            curve={75}
            fade={16}
            className="w-full min-h-[640px] sm:min-h-[720px] rounded-3xl border border-zinc-800/80 bg-gradient-to-b from-zinc-900/60 via-zinc-950/80 to-[#0a0a0c] p-6 sm:p-12 shadow-2xl"
          >
            {/* Contenido tipográfico estrictamente centrado */}
            <div className="max-w-4xl mx-auto text-center space-y-6 sm:space-y-8 pt-4 pb-16 sm:pb-24">
              <MotionFade delay={0.1}>
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-zinc-700/60 bg-zinc-950/80 backdrop-blur-md text-[11px] font-semibold uppercase tracking-[0.28em] text-zinc-300 shadow-lg">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Barbería de Autor — Buenos Aires
                </div>
              </MotionFade>

              <MotionFade delay={0.2}>
                <h1 className="font-['Krona_One',sans-serif] text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-black uppercase tracking-tight text-zinc-100 leading-[0.92] drop-shadow-2xl">
                  ROVE <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-zinc-400 via-zinc-200 to-zinc-500">
                    BARBER
                  </span>
                </h1>
              </MotionFade>

              <MotionFade delay={0.3}>
                <p className="text-base sm:text-lg md:text-xl text-zinc-300 max-w-2xl mx-auto font-light leading-relaxed drop-shadow">
                  Cortes clásicos, degradados modernos y perfilado tradicional de barba. 
                  Una experiencia reservada donde la precisión artesanal se fusiona con la tecnología.
                </p>
              </MotionFade>

              <MotionFade delay={0.4}>
                <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
                  <Button
                    size="lg"
                    render={
                      <a
                        href="#reservar"
                        className="rounded-full bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-xs uppercase tracking-widest px-8 py-6 h-auto transition-transform active:scale-95 shadow-xl flex items-center"
                      >
                        Reservar Turno <ArrowUpRight className="w-4 h-4 ml-2" />
                      </a>
                    }
                  />

                  <Button
                    variant="outline"
                    size="lg"
                    render={
                      <a
                        href="#servicios"
                        className="rounded-full border-zinc-700 hover:border-zinc-500 bg-zinc-950/80 hover:bg-zinc-900 text-zinc-200 hover:text-white font-medium text-xs uppercase tracking-widest px-7 py-6 h-auto backdrop-blur-md transition-all flex items-center"
                      >
                        Ver Servicios
                      </a>
                    }
                  />
                </div>
              </MotionFade>
            </div>
          </TiltedGridHero>
        </section>

        {/* ========================================================================= */}
        {/* ESTADÍSTICAS (Barra de datos rápidos estilo referencia) */}
        {/* ========================================================================= */}
        <section className="relative">
          <MotionFade delay={0.2}>
            <div className="rounded-3xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-md p-8 sm:p-10 shadow-xl">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4 divide-y md:divide-y-0 md:divide-x divide-zinc-800/80">
                {stats.map((stat, idx) => {
                  const Icon = stat.icon;
                  return (
                    <div
                      key={idx}
                      className={`flex flex-col items-center text-center ${
                        idx !== 0 ? "pt-6 md:pt-0 md:px-6" : "md:pr-6"
                      }`}
                    >
                      <Icon className="w-5 h-5 text-zinc-400 mb-3" />
                      <div className="font-['Krona_One',sans-serif] text-3xl sm:text-4xl font-extrabold text-zinc-100 tracking-tight">
                        {stat.value}
                      </div>
                      <div className="text-xs uppercase tracking-widest text-zinc-400 mt-2 font-medium">
                        {stat.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </MotionFade>
        </section>

        {/* ========================================================================= */}
        {/* BENTO GRID DE SERVICIOS ("Featured Work" de la imagen) */}
        {/* ========================================================================= */}
        <section id="servicios" className="space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-zinc-800/80 pb-6">
            <div>
              <div className="text-xs uppercase tracking-[0.25em] text-zinc-500 font-semibold mb-2">
                Catálogo de Autor
              </div>
              <h2 className="font-['Krona_One',sans-serif] text-2xl sm:text-3xl font-extrabold uppercase text-zinc-100 tracking-tight">
                Servicios Seleccionados
              </h2>
            </div>
            <a
              href="#reservar"
              className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              Ver disponibilidad de turnos <ChevronRight className="w-3.5 h-3.5" />
            </a>
          </div>

          <MotionStaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {servicesBento.map((srv) => (
              <MotionStaggerItem key={srv.id} className="h-full">
                <Card className="h-full rounded-2xl border-zinc-800/80 bg-zinc-900/50 hover:bg-zinc-900/80 hover:border-zinc-700/80 transition-all duration-300 flex flex-col justify-between group overflow-hidden">
                  <CardContent className="p-7 flex flex-col justify-between h-full space-y-6">
                    {/* Header de la tarjeta */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
                          {srv.category}
                        </span>
                        <Badge
                          variant="outline"
                          className="border-zinc-800 bg-zinc-950 text-zinc-400 text-[10px] tracking-wider uppercase font-medium"
                        >
                          {srv.duration}
                        </Badge>
                      </div>

                      <div className="space-y-1">
                        <h3 className="font-['Krona_One',sans-serif] text-lg font-bold text-zinc-100 group-hover:text-zinc-200 transition-colors">
                          {srv.title}
                        </h3>
                        <p className="text-[11px] uppercase tracking-wider text-zinc-400 font-semibold">
                          {srv.subtitle}
                        </p>
                      </div>

                      <p className="text-xs text-zinc-400 font-light leading-relaxed">
                        {srv.description}
                      </p>
                    </div>

                    {/* Footer de la tarjeta con precio y acción */}
                    <div className="pt-4 border-t border-zinc-800/60 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-zinc-400 block">
                          Valor
                        </span>
                        <span className="font-['Krona_One',sans-serif] text-xl font-extrabold text-zinc-100">
                          {srv.price}
                        </span>
                      </div>

                      <Button
                        size="icon"
                        render={
                          <a
                            href="#reservar"
                            title={`Reservar ${srv.title}`}
                            className="rounded-full bg-zinc-800 hover:bg-zinc-100 text-zinc-300 hover:text-zinc-950 transition-all w-10 h-10 group-hover:scale-105 flex items-center justify-center"
                          >
                            <ArrowUpRight className="w-4 h-4" />
                          </a>
                        }
                      />
                    </div>
                  </CardContent>
                </Card>
              </MotionStaggerItem>
            ))}
          </MotionStaggerContainer>
        </section>

        {/* ========================================================================= */}
        {/* FILOSOFÍA Y DETALLES ("Core Capabilities" de la referencia) */}
        {/* ========================================================================= */}
        <section id="filosofia" className="space-y-8">
          <div className="border-b border-zinc-800/80 pb-6">
            <div className="text-xs uppercase tracking-[0.25em] text-zinc-400 font-semibold mb-2">
              Estándares de Excelencia
            </div>
            <h2 className="font-['Krona_One',sans-serif] text-2xl sm:text-3xl font-extrabold uppercase text-zinc-100 tracking-tight">
              Filosofía & Pilares
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {capabilities.map((item, idx) => (
              <MotionFade key={idx} delay={idx * 0.08}>
                <div className="p-7 rounded-2xl border border-zinc-800/70 bg-zinc-900/30 hover:border-zinc-700/60 transition-colors space-y-3 h-full">
                  <div className="w-8 h-8 rounded-lg bg-zinc-800/50 border border-zinc-700/40 flex items-center justify-center text-zinc-300 mb-4">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <h3 className="font-['Krona_One',sans-serif] text-sm font-bold text-zinc-200">
                    {item.title}
                  </h3>
                  <p className="text-xs text-zinc-400 font-light leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </MotionFade>
            ))}
          </div>
        </section>

        {/* ========================================================================= */}
        {/* PROCESO ("My Design Process" de la referencia) */}
        {/* ========================================================================= */}
        <section id="proceso" className="space-y-8">
          <div className="border-b border-zinc-800/80 pb-6">
            <div className="text-xs uppercase tracking-[0.25em] text-zinc-400 font-semibold mb-2">
              Paso a Paso
            </div>
            <h2 className="font-['Krona_One',sans-serif] text-2xl sm:text-3xl font-extrabold uppercase text-zinc-100 tracking-tight">
              La Experiencia Rove
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {processSteps.map((step, idx) => (
              <MotionFade key={idx} delay={idx * 0.07}>
                <div className="p-6 rounded-2xl border border-zinc-800/60 bg-zinc-900/20 space-y-3 relative overflow-hidden h-full">
                  <div className="font-['Krona_One',sans-serif] text-2xl font-black text-zinc-700">
                    {step.number}
                  </div>
                  <h3 className="font-['Krona_One',sans-serif] text-xs font-bold uppercase text-zinc-200 tracking-wider">
                    {step.title}
                  </h3>
                  <p className="text-[11px] text-zinc-400 font-light leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              </MotionFade>
            ))}
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECCIÓN TURNERO / CALL TO ACTION (BookingFlow montado limpiamente) */}
        {/* ========================================================================= */}
        <section id="reservar" className="scroll-mt-24 space-y-8">
          <MotionFade delay={0.1}>
            <div className="text-center max-w-2xl mx-auto space-y-3">
              <Badge className="bg-zinc-900 text-zinc-300 border-zinc-800 text-[10px] tracking-widest uppercase py-1 px-3">
                Sistema Oficial de Citas
              </Badge>
              <h2 className="font-['Krona_One',sans-serif] text-3xl sm:text-4xl font-extrabold uppercase tracking-tight text-zinc-100">
                Reservá Tu Horario
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 font-light">
                Seleccioná el servicio, el día y la hora que mejor te acomode. Sin llamadas ni esperas.
              </p>
            </div>
          </MotionFade>

          {/* Contenedor del Turnero */}
          <MotionFade delay={0.2}>
            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-4 sm:p-8 backdrop-blur-xl shadow-2xl">
              <BookingFlow />
            </div>
          </MotionFade>
        </section>

        {/* ========================================================================= */}
        {/* FOOTER / CONTACTO ("Let's Create..." de la referencia) */}
        {/* ========================================================================= */}
        <section id="ubicacion" className="pt-8">
          <MotionFade delay={0.2}>
            <div className="rounded-3xl border border-zinc-800/80 bg-zinc-900/50 backdrop-blur-xl p-8 sm:p-12 overflow-hidden relative">
              {/* Resplandor decorativo */}
              <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-zinc-700/10 to-transparent blur-3xl pointer-events-none" />

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                {/* Texto Masivo Izquierda */}
                <div className="lg:col-span-7 space-y-4">
                  <h2 className="font-['Krona_One',sans-serif] text-3xl sm:text-5xl font-black uppercase text-zinc-100 leading-[1.1] tracking-tight">
                    DEFINÍ TU ESTILO. <br />
                    <span className="text-zinc-500">RESERVÁ HOY.</span>
                  </h2>
                  <p className="text-xs sm:text-sm text-zinc-400 font-light max-w-md">
                    Atención personalizada, café de cortesía y la precisión que mereces.
                  </p>
                  <div className="pt-2">
                    <Button
                      render={
                        <a
                          href="#reservar"
                          className="rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-bold text-xs uppercase tracking-widest px-7 py-5 h-auto transition-transform active:scale-95 inline-flex items-center"
                        >
                          Agendar Cita ↗
                        </a>
                      }
                    />
                  </div>
                </div>

                {/* Info Contacto Derecha */}
                <div className="lg:col-span-5 space-y-4 text-xs text-zinc-400 border-t lg:border-t-0 lg:border-l border-zinc-800 pt-6 lg:pt-0 lg:pl-8">
                  <div className="flex items-center gap-3">
                    <MapPin className="w-4 h-4 text-zinc-300 shrink-0" />
                    <span>Honduras 4872, Palermo Soho, CABA</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock className="w-4 h-4 text-zinc-300 shrink-0" />
                    <span>Lunes a Sábados — 10:00 a 20:00 hs</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-zinc-300 shrink-0" />
                    <span>+54 9 11 4892-0091</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-zinc-300 shrink-0" />
                    <span>contacto@rovebarberia.com</span>
                  </div>
                </div>
              </div>
            </div>
          </MotionFade>

          {/* Copyright y links legales */}
          <div className="py-8 flex flex-col sm:flex-row items-center justify-between text-[11px] text-zinc-500 gap-4">
            <div>
              &copy; 2026 ROVE Barbería. Todos los derechos reservados.
            </div>

            <div className="flex items-center gap-6">
              <Link href="/admin/login" className="hover:text-zinc-300 transition-colors">
                Acceso Barbero
              </Link>
              <a href="#" className="hover:text-zinc-300 transition-colors">
                Instagram
              </a>
              <a href="#" className="hover:text-zinc-300 transition-colors">
                Términos
              </a>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

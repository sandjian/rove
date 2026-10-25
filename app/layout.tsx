import type { Metadata } from "next";
import { Geist_Mono, Krona_One, Space_Grotesk, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-body",
  subsets: ["latin"],
});

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const kronaOne = Krona_One({
  variable: "--font-krona",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ROVE Barbería — Reservá tu Turno Online",
  description:
    "Cortes clásicos, degradados modernos y perfilado de barba en Buenos Aires. Elegí tu servicio y horario en segundos sin esperas.",
  keywords: [
    "barbería",
    "corte de pelo",
    "barba",
    "Buenos Aires",
    "Palermo",
    "turnos online",
    "Rove Barbería",
  ],
  authors: [{ name: "Rove Barbería" }],
  openGraph: {
    title: "ROVE Barbería — Reservas Online",
    description:
      "Cortes clásicos, perfilado de barba y experiencia de autor en Buenos Aires. Turnos sin demoras.",
    type: "website",
    locale: "es_AR",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${spaceGrotesk.variable} ${plusJakarta.variable} ${geistMono.variable} ${kronaOne.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100 font-sans selection:bg-zinc-200 selection:text-zinc-950">
        {children}
      </body>
    </html>
  );
}

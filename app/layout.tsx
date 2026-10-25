import type { Metadata } from "next";
import { Geist, Geist_Mono, Krona_One, Syne } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
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

const syne = Syne({
  variable: "--font-syne",
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
      className={`${geistSans.variable} ${geistMono.variable} ${kronaOne.variable} ${syne.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100 font-sans selection:bg-zinc-200 selection:text-zinc-950">
        {children}
      </body>
    </html>
  );
}

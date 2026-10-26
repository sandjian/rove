import type { Metadata } from "next";
import { Inter, Krona_One, Space_Grotesk } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-body",
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
      className={`${inter.variable} ${spaceGrotesk.variable} ${kronaOne.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans selection:bg-amber-100 selection:text-amber-950">
        {children}
      </body>
    </html>
  );
}

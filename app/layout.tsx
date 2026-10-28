import type { Metadata } from "next";
import { Urbanist, Krona_One } from "next/font/google";
import "./globals.css";

const urbanist = Urbanist({
  variable: "--font-urbanist",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const kronaOne = Krona_One({
  variable: "--font-krona-one",
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
      className={`${urbanist.variable} ${kronaOne.variable} ${urbanist.className} h-full antialiased`}
    >
      <body className={`${urbanist.className} min-h-full flex flex-col font-sans selection:bg-amber-100 selection:text-amber-950`}>
        {children}
      </body>
    </html>
  );
}

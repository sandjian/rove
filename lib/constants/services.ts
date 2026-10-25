import type { ServiceDto } from "@/app/actions";

export const DEFAULT_SERVICES: ServiceDto[] = [
  {
    id: "corte-clasico",
    name: "Corte Clásico",
    description:
      "Corte a tijera o máquina con degradé preciso, acabado a navaja y peinado con cera mate.",
    durationMinutes: 30,
    priceAmount: 12000,
    currency: "ARS",
  },
  {
    id: "perfilado-barba",
    name: "Perfilado y Arreglo de Barba",
    description:
      "Diseño y rebajado de barba, toalla caliente, rasurado de contornos a navaja y aceites hidratantes.",
    durationMinutes: 30,
    priceAmount: 8000,
    currency: "ARS",
  },
  {
    id: "combo-rove",
    name: "Combo Rove: Corte + Barba",
    description:
      "La experiencia completa de Rove: corte de cabello personalizado, tratamiento de barba y toalla caliente.",
    durationMinutes: 50,
    priceAmount: 18000,
    currency: "ARS",
  },
  {
    id: "corte-infantil",
    name: "Corte Infantil",
    description:
      "Corte de pelo para menores de 12 años con atención paciente y dedicada.",
    durationMinutes: 30,
    priceAmount: 10000,
    currency: "ARS",
  },
];

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AdminAppointmentDto,
  AdminAvailabilityWindowDto,
  completeAppointmentAdminAction,
  cancelAppointmentAdminAction,
  createManualBlockAction,
  logoutAdminAction,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Calendar,
  CheckCircle2,
  Clock,
  LogOut,
  PlusCircle,
  Scissors,
  ShieldAlert,
  User,
  XCircle,
  Phone,
  Mail,
} from "lucide-react";

interface AdminDashboardClientProps {
  initialAppointments: AdminAppointmentDto[];
  initialWindows: AdminAvailabilityWindowDto[];
  adminEmail: string;
}

export function AdminDashboardClient({
  initialAppointments,
  initialWindows,
  adminEmail,
}: AdminDashboardClientProps) {
  const router = useRouter();
  const [appointments, setAppointments] = useState(initialAppointments);
  const [windows, setWindows] = useState(initialWindows);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Modal para nuevo bloqueo de agenda
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [blockDate, setBlockDate] = useState("");
  const [blockStartTime, setBlockStartTime] = useState("13:00");
  const [blockEndTime, setBlockEndTime] = useState("15:00");
  const [blockReason, setBlockReason] = useState("Almuerzo / Descanso");
  const [blockError, setBlockError] = useState<string | null>(null);

  // Formateadores
  const dateTimeFormatter = new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const currencyFormatter = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });

  async function handleLogout() {
    await logoutAdminAction();
    router.push("/admin/login");
    router.refresh();
  }

  async function handleComplete(id: string) {
    setActionLoading(id);
    const res = await completeAppointmentAdminAction(id);
    if (res.success) {
      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: "completed" } : a))
      );
    }
    setActionLoading(null);
  }

  async function handleCancel(id: string) {
    const confirm = window.confirm(
      "¿Seguro que deseas cancelar esta reserva? Se liberará el turno y se enviará un email al cliente."
    );
    if (!confirm) return;

    setActionLoading(id);
    const res = await cancelAppointmentAdminAction(id, "Cancelado por el barbero");
    if (res.success) {
      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: "cancelled" } : a))
      );
    }
    setActionLoading(null);
  }

  async function handleCreateBlock(e: React.FormEvent) {
    e.preventDefault();
    setBlockError(null);

    if (!blockDate || !blockStartTime || !blockEndTime) {
      setBlockError("Completá todos los campos.");
      return;
    }

    // Convertir a ISO local de Buenos Aires
    const startIso = new Date(`${blockDate}T${blockStartTime}:00-03:00`).toISOString();
    const endIso = new Date(`${blockDate}T${blockEndTime}:00-03:00`).toISOString();

    const res = await createManualBlockAction({
      startIso,
      endIso,
      reason: blockReason,
    });

    if (res.success) {
      setBlockDialogOpen(false);
      router.refresh();
    } else {
      setBlockError(res.error || "No se pudo crear el bloqueo.");
    }
  }

  // Filtrado de citas
  const filteredAppointments = appointments.filter((appt) => {
    const matchesStatus = filterStatus === "all" || appt.status === filterStatus;
    const matchesSearch =
      appt.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      appt.customerEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      appt.customerPhone.includes(searchTerm) ||
      appt.serviceName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const stats = {
    total: appointments.length,
    confirmed: appointments.filter((a) => a.status === "confirmed").length,
    completed: appointments.filter((a) => a.status === "completed").length,
    cancelled: appointments.filter((a) => a.status === "cancelled").length,
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Header Administrativo */}
      <header className="border-b border-zinc-800 bg-zinc-900/60 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-serif font-black tracking-widest text-lg text-zinc-100 uppercase">
              ROVE
            </span>
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-400/10 text-amber-400 border border-amber-400/20">
              Admin
            </span>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <span className="text-zinc-400 hidden sm:inline">{adminEmail}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 gap-1.5"
            >
              <LogOut className="w-4 h-4" />
              Salir
            </Button>
          </div>
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full space-y-8">
        {/* Métricas Rápidas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-zinc-800/80 bg-zinc-900/50">
            <CardHeader className="pb-2">
              <CardDescription className="text-zinc-400 text-xs">Citas Totales</CardDescription>
              <CardTitle className="text-2xl font-bold text-zinc-100">{stats.total}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-zinc-800/80 bg-zinc-900/50">
            <CardHeader className="pb-2">
              <CardDescription className="text-amber-400/80 text-xs">Confirmadas</CardDescription>
              <CardTitle className="text-2xl font-bold text-amber-300">{stats.confirmed}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-zinc-800/80 bg-zinc-900/50">
            <CardHeader className="pb-2">
              <CardDescription className="text-emerald-400/80 text-xs">Completadas</CardDescription>
              <CardTitle className="text-2xl font-bold text-emerald-400">{stats.completed}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-zinc-800/80 bg-zinc-900/50">
            <CardHeader className="pb-2">
              <CardDescription className="text-red-400/80 text-xs">Canceladas</CardDescription>
              <CardTitle className="text-2xl font-bold text-zinc-400">{stats.cancelled}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Acciones de Agenda y Bloqueos */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
              Agenda y Reservas
            </h1>
            <p className="text-sm text-zinc-400">
              Controlá las citas agendadas y gestioná bloqueos horarios para la atención.
            </p>
          </div>

          <Dialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
            <DialogTrigger
              render={
                <Button className="bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold gap-2">
                  <PlusCircle className="w-4 h-4" />
                  Bloquear Horario
                </Button>
              }
            />
            <DialogContent className="border-zinc-800 bg-zinc-900 text-zinc-100 sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Nuevo Bloqueo de Horario</DialogTitle>
                <DialogDescription className="text-zinc-400">
                  Definí una franja horaria donde la barbería no tomará turnos (ej. almuerzo o descanso).
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleCreateBlock} className="space-y-4 py-2">
                {blockError && (
                  <div className="p-2.5 text-xs rounded bg-red-500/10 border border-red-500/30 text-red-300">
                    {blockError}
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="blockDate" className="text-zinc-300 text-xs">
                    Fecha
                  </Label>
                  <Input
                    id="blockDate"
                    type="date"
                    required
                    value={blockDate}
                    onChange={(e) => setBlockDate(e.target.value)}
                    className="bg-zinc-950 border-zinc-800 text-zinc-100"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="blockStartTime" className="text-zinc-300 text-xs">
                      Desde
                    </Label>
                    <Input
                      id="blockStartTime"
                      type="time"
                      required
                      value={blockStartTime}
                      onChange={(e) => setBlockStartTime(e.target.value)}
                      className="bg-zinc-950 border-zinc-800 text-zinc-100"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="blockEndTime" className="text-zinc-300 text-xs">
                      Hasta
                    </Label>
                    <Input
                      id="blockEndTime"
                      type="time"
                      required
                      value={blockEndTime}
                      onChange={(e) => setBlockEndTime(e.target.value)}
                      className="bg-zinc-950 border-zinc-800 text-zinc-100"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="blockReason" className="text-zinc-300 text-xs">
                    Motivo
                  </Label>
                  <Input
                    id="blockReason"
                    type="text"
                    required
                    value={blockReason}
                    onChange={(e) => setBlockReason(e.target.value)}
                    placeholder="Almuerzo, trámite, mantenimiento..."
                    className="bg-zinc-950 border-zinc-800 text-zinc-100"
                  />
                </div>

                <DialogFooter className="pt-2">
                  <Button
                    type="submit"
                    className="w-full bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold"
                  >
                    Guardar Bloqueo
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filtros de Citas */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <Input
            placeholder="Buscar por cliente, teléfono o servicio..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-500 max-w-md"
          />

          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            {["all", "confirmed", "completed", "cancelled"].map((status) => (
              <Button
                key={status}
                variant={filterStatus === status ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterStatus(status)}
                className={
                  filterStatus === status
                    ? "bg-amber-400 text-zinc-950 font-bold"
                    : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-100"
                }
              >
                {status === "all"
                  ? "Todos"
                  : status === "confirmed"
                  ? "Confirmados"
                  : status === "completed"
                  ? "Completados"
                  : "Cancelados"}
              </Button>
            ))}
          </div>
        </div>

        {/* Tabla de Reservas */}
        <Card className="border-zinc-800 bg-zinc-900/60 overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-zinc-950/40 border-b border-zinc-800">
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-zinc-400 font-semibold">Horario & Fecha</TableHead>
                  <TableHead className="text-zinc-400 font-semibold">Cliente</TableHead>
                  <TableHead className="text-zinc-400 font-semibold">Servicio</TableHead>
                  <TableHead className="text-zinc-400 font-semibold">Monto</TableHead>
                  <TableHead className="text-zinc-400 font-semibold">Estado</TableHead>
                  <TableHead className="text-right text-zinc-400 font-semibold">Acciones</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {filteredAppointments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-zinc-500 text-sm">
                      No se encontraron citas con los filtros seleccionados.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAppointments.map((appt) => {
                    const startDate = new Date(appt.startAt);
                    const formattedDate = dateTimeFormatter.format(startDate);

                    return (
                      <TableRow key={appt.id} className="border-zinc-800 hover:bg-zinc-800/40">
                        {/* Horario */}
                        <TableCell className="font-medium text-zinc-200">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                            <span>{formattedDate}</span>
                          </div>
                        </TableCell>

                        {/* Cliente */}
                        <TableCell>
                          <div className="space-y-0.5">
                            <div className="text-sm font-semibold text-zinc-100 flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-zinc-400" />
                              {appt.customerName}
                            </div>
                            <div className="text-xs text-zinc-400 flex items-center gap-3">
                              <span className="inline-flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {appt.customerPhone}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                {appt.customerEmail}
                              </span>
                            </div>
                          </div>
                        </TableCell>

                        {/* Servicio */}
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-sm text-zinc-300">
                            <Scissors className="w-3.5 h-3.5 text-amber-400" />
                            <span>{appt.serviceName}</span>
                            <span className="text-xs text-zinc-500">
                              ({appt.durationMinutes} min)
                            </span>
                          </div>
                        </TableCell>

                        {/* Importe */}
                        <TableCell className="font-semibold text-zinc-200 text-sm">
                          {currencyFormatter.format(appt.priceAmount)}
                        </TableCell>

                        {/* Estado */}
                        <TableCell>
                          {appt.status === "confirmed" && (
                            <Badge className="bg-amber-400/10 text-amber-400 border border-amber-400/30 hover:bg-amber-400/20">
                              Confirmado
                            </Badge>
                          )}
                          {appt.status === "completed" && (
                            <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20">
                              Completado
                            </Badge>
                          )}
                          {appt.status === "cancelled" && (
                            <Badge className="bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20">
                              Cancelado
                            </Badge>
                          )}
                        </TableCell>

                        {/* Acciones */}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {appt.status === "confirmed" && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={actionLoading === appt.id}
                                  onClick={() => handleComplete(appt.id)}
                                  className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 h-8 px-2"
                                  title="Marcar como atendido"
                                >
                                  <CheckCircle2 className="w-4 h-4 mr-1" />
                                  Listo
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={actionLoading === appt.id}
                                  onClick={() => handleCancel(appt.id)}
                                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 px-2"
                                  title="Cancelar turno"
                                >
                                  <XCircle className="w-4 h-4 mr-1" />
                                  Cancelar
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </main>
    </div>
  );
}

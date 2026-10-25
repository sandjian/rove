import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/security/admin-auth";
import { getAdminAppointmentsAction, getAdminWindowsAction } from "./actions";
import { AdminDashboardClient } from "./dashboard-client";

export const instant = false;

export const metadata = {
  title: "Panel de Gestión — ROVE Barbería",
};

export default async function AdminDashboardPage() {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin/login");
  }

  const [appointmentsRes, windowsRes] = await Promise.all([
    getAdminAppointmentsAction(),
    getAdminWindowsAction(),
  ]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <AdminDashboardClient
        initialAppointments={appointmentsRes.appointments}
        initialWindows={windowsRes.windows}
        adminEmail={session.email}
      />
    </div>
  );
}

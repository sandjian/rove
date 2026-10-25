import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/security/admin-auth";
import { AdminLoginForm } from "./login-form";

export const instant = false;

export const metadata = {
  title: "Acceso Administrativo — ROVE Barbería",
};

export default async function AdminLoginPage() {
  const session = await getAdminSession();
  if (session) {
    redirect("/admin");
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-950 text-zinc-100">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-3xl font-black font-serif tracking-widest text-zinc-100 uppercase">
            ROVE
          </div>
          <p className="text-xs uppercase tracking-[0.3em] text-amber-400 font-semibold mt-1">
            Gestión de Agenda & Barbería
          </p>
        </div>
        <AdminLoginForm />
      </div>
    </div>
  );
}

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
    <div className="min-h-screen flex items-center justify-center p-4 bg-linear-to-br from-[#faf6f0] via-[#f7f3ec] to-[#f2ede4] text-slate-800 font-sans antialiased relative selection:bg-[#a9773c]/20 selection:text-slate-900">
      {/* Luces difusas cálidas camel */}
      <div className="fixed top-[-10%] right-[-5%] w-137.5 h-137.5 rounded-full bg-linear-to-br from-[#a9773c]/15 via-[#c49257]/10 to-transparent blur-[120px] pointer-events-none -z-10" />
      <div className="fixed bottom-[-10%] left-[-5%] w-150 h-150 rounded-full bg-linear-to-tr from-[#8d5e2a]/10 via-[#d4a86a]/15 to-transparent blur-[130px] pointer-events-none -z-10" />

      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-linear-to-tr from-[#a9773c] via-[#c49257] to-[#8d5e2a] text-white shadow-md shadow-[#a9773c]/30 font-bold text-lg mb-2">
            R
          </div>
          <h1 className="font-sans font-bold text-2xl uppercase text-slate-900 tracking-tight">
            ROVE ADMIN
          </h1>
          <p className="text-xs uppercase tracking-[0.25em] text-[#a9773c] font-semibold">
            Gestión de Agenda & Barbería
          </p>
        </div>
        <AdminLoginForm />
      </div>
    </div>
  );
}

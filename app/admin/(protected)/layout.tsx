import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/security/admin-auth";
import { AdminNav } from "./components/admin-nav";

export const metadata = {
  title: "Administración — ROVE Barbería",
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin/login");
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-[#faf6f0] via-[#f7f3ec] to-[#f2ede4] text-slate-800 font-sans antialiased relative selection:bg-[#a9773c]/20 selection:text-slate-900">
      {/* Luces difusas de ambiente camel */}
      <div className="fixed top-[-10%] right-[-5%] w-137.5 h-137.5 rounded-full bg-linear-to-br from-[#a9773c]/10 via-[#c49257]/10 to-transparent blur-[120px] pointer-events-none -z-10" />
      <div className="fixed bottom-[-10%] left-[-5%] w-150 h-150 rounded-full bg-linear-to-tr from-[#8d5e2a]/10 via-[#d4a86a]/10 to-transparent blur-[130px] pointer-events-none -z-10" />

      {/* Contenedor principal con max-w-7xl consistente con el diseño general */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        <AdminNav adminEmail={session.email} />
        <main>{children}</main>
      </div>
    </div>
  );
}

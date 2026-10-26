"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Calendar, Scissors, LayoutDashboard } from "lucide-react";
import { logoutAdminAction } from "../actions";

export function AdminNav({ adminEmail }: { adminEmail: string }) {
  const pathname = usePathname();

  const links = [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/agenda", label: "Agenda", icon: Calendar },
    { href: "/admin/servicios", label: "Servicios", icon: Scissors },
  ];

  return (
    <header className="rounded-[2rem] bg-white/50 backdrop-blur-2xl border border-white/70 shadow-[0_8px_32px_0_rgba(169,119,60,0.06)] px-6 py-4 flex items-center justify-between">
      {/* Logo Rove */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#a9773c] via-[#c49257] to-[#8d5e2a] flex items-center justify-center text-white shadow-sm shadow-[#a9773c]/40 font-bold text-xs">
          R
        </div>
        <div>
          <span className="font-['Krona_One',sans-serif] text-sm tracking-[0.15em] text-slate-900 uppercase">
            ROVE ADMIN
          </span>
          <span className="block text-[10px] text-slate-500 font-medium">
            {adminEmail}
          </span>
        </div>
      </div>

      {/* Links de Navegación */}
      <nav className="flex items-center gap-1 sm:gap-2">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all duration-200 ${
                isActive
                  ? "bg-white text-[#a9773c] shadow-sm border border-amber-900/10"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/40"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{link.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <form action={logoutAdminAction}>
        <button
          type="submit"
          className="p-2.5 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50/60 transition-colors"
          title="Cerrar Sesión"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </form>
    </header>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginAdminAction } from "../actions";

export function AdminLoginForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const result = await loginAdminAction(formData);

    if (result.success) {
      router.push("/admin");
      router.refresh();
    } else {
      setError(result.error || "Credenciales incorrectas.");
      setLoading(false);
    }
  }

  return (
    <div className="rounded-[2rem] bg-white/60 backdrop-blur-2xl border border-white/80 shadow-[0_12px_40px_0_rgba(169,119,60,0.08)] p-8 space-y-6">
      <div className="space-y-1">
        <h2 className="font-['Krona_One',sans-serif] text-lg text-slate-900 font-normal uppercase tracking-tight">
          Ingreso de Barbero
        </h2>
        <p className="text-xs text-slate-500 font-normal">
          Accedé al panel para consultar citas, horarios y servicios.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-xs rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-medium">
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-[10px] font-bold uppercase tracking-wider text-slate-600">
            Email Profesional
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            defaultValue="admin@rove.com"
            placeholder="admin@rove.com"
            className="w-full bg-white/90 border border-amber-900/10 focus:border-[#a9773c]/50 focus:ring-2 focus:ring-[#a9773c]/10 rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-800 transition-all outline-none"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="block text-[10px] font-bold uppercase tracking-wider text-slate-600">
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            defaultValue="rove2026"
            className="w-full bg-white/90 border border-amber-900/10 focus:border-[#a9773c]/50 focus:ring-2 focus:ring-[#a9773c]/10 rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-800 transition-all outline-none"
          />
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-gradient-to-r from-[#a9773c] via-[#c49257] to-[#8d5e2a] text-white font-semibold text-xs tracking-wider uppercase py-3.5 shadow-md shadow-[#a9773c]/35 hover:scale-[1.01] active:scale-95 transition-all duration-200 disabled:opacity-50"
          >
            {loading ? "Accediendo..." : "Entrar al Panel"}
          </button>
        </div>
      </form>
    </div>
  );
}

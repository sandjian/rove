"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
    <Card className="border-zinc-800 bg-zinc-900/90 backdrop-blur-md text-zinc-100 shadow-2xl">
      <CardHeader>
        <CardTitle className="text-xl font-bold">Ingreso de Administrador</CardTitle>
        <CardDescription className="text-zinc-400">
          Accedé al panel de control de citas, horarios y bloqueos de agenda.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 text-sm rounded-lg bg-red-500/10 border border-red-500/30 text-red-300">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email" className="text-zinc-300">
              Email Profesional
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              defaultValue="admin@rove.com"
              placeholder="barbero@rove.com"
              className="bg-zinc-950/60 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-amber-400"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-zinc-300">
              Contraseña
            </Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              placeholder="••••••••"
              className="bg-zinc-950/60 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-amber-400"
            />
          </div>
        </CardContent>

        <CardFooter className="pt-2">
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold transition-all"
          >
            {loading ? "Verificando..." : "Entrar al Panel"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

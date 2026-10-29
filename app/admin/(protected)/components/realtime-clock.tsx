"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

export function RealtimeClock() {
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    // Inicializar hora local inmediatamente en cliente
    const updateTime = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString("es-AR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/70 border border-slate-200/80 shadow-xs backdrop-blur-md">
      <Clock className="w-3.5 h-3.5 text-[#a9773c]" />
      <span className="font-krona text-4xl text-slate-900/70 tracking-wider font-semibold min-w-17.5">
        {time ?? "--:--:--"}
      </span>
      <span className="text-[10px] uppercase font-semibold text-slate-400">hs</span>
    </div>
  );
}

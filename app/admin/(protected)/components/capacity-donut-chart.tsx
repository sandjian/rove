import React from "react";

interface CapacityDonutChartProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
}

export function CapacityDonutChart({
  percentage,
  size = 110,
  strokeWidth = 10,
}: CapacityDonutChartProps) {
  // Clamping seguro 0 - 100
  const validPercentage = Math.max(0, Math.min(100, Math.round(percentage)));

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (validPercentage / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center select-none" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90 transition-all duration-500 ease-out"
      >
        {/* Círculo de fondo tenue */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="rgba(169, 119, 60, 0.12)"
          strokeWidth={strokeWidth}
        />

        {/* Círculo de progreso camel de la marca */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="#a9773c"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>

      {/* Porcentaje en el centro usando la fuente Krona One */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-krona text-base sm:text-lg font-normal text-slate-900 tracking-tight leading-none">
          {validPercentage}%
        </span>
        <span className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold mt-0.5">
          Ocupado
        </span>
      </div>
    </div>
  );
}

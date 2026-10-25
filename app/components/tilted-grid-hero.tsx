"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const SLICES = 16;
const CAMERA = 1.6;

function arc(bend: number) {
  return (CAMERA - 1 + Math.cos(bend)) / (2 * CAMERA * Math.sin(bend));
}

const MAX_WIDTH = 55;

function measure(
  width: number,
  height: number,
  tile: number,
  aspect: number,
  gap: number,
  bend: number,
) {
  const h = Math.min(
    (tile / 100) * height,
    ((MAX_WIDTH / 100) * width) / aspect,
  );
  const radius = width * arc(bend);
  if (!(h > 0) || !(radius > 0))
    return { columns: 4, sweep: 60, unit: 4, limit: 50 };
  const deg = (rad: number) => (rad * 180) / Math.PI;
  const unit = deg(h / radius);
  const pitch = (aspect + gap / 100) * unit;
  const limit = deg(bend) + (aspect * unit) / 2;
  const columns = Math.min(60, Math.max(3, Math.ceil((2 * limit) / pitch)));
  const round = (n: number) => +n.toFixed(4);
  const sweep = round((columns * pitch) / 2);
  return {
    columns,
    sweep,
    unit: round(unit),
    limit: round(Math.min(sweep, limit)),
  };
}

export type TiltedGridImage = {
  src: string;
  alt?: string;
};

export type TiltedGridHeroProps = {
  images: TiltedGridImage[];
  speed?: number;
  tileHeight?: number;
  aspectRatio?: number;
  gap?: number;
  axis?: number;
  curve?: number;
  fade?: number;
  children?: React.ReactNode;
  className?: string;
};

export function TiltedGridHero({
  images,
  speed = 4,
  tileHeight = 40,
  aspectRatio = 16 / 9,
  gap = 6,
  axis = 65,
  curve = 75,
  fade = 12,
  children,
  className,
  ...props
}: React.ComponentProps<"div"> & TiltedGridHeroProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const id = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  const orbit = `tgh-o-${id}`;
  const tile = `tgh-t-${id}`;
  const bend = (Math.min(85, Math.max(5, curve)) * Math.PI) / 180;

  // Estado del tamaño del contenedor medido en píxeles
  const [size, setSize] = React.useState<{ width: number; height: number }>({
    width: 1200,
    height: 600,
  });

  const [shown, setShown] = React.useState<Record<number, number>>({});

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      const w = Math.round(rect.width) || window.innerWidth || 1200;
      const h = Math.round(rect.height) || 600;
      setSize({ width: w, height: h });
    };

    updateSize();

    const ro = new ResizeObserver(() => {
      updateSize();
    });
    ro.observe(el);
    window.addEventListener("resize", updateSize);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateSize);
    };
  }, []);

  const { columns, sweep, unit, limit } = measure(
    size.width,
    size.height,
    tileHeight,
    aspectRatio,
    gap,
    bend,
  );

  // Altura base en píxeles calculada exactamente
  const baseTileHeightPx = Math.min(
    (tileHeight / 100) * size.height,
    ((MAX_WIDTH / 100) * size.width) / aspectRatio,
  );

  const u = React.useCallback(
    (n: number) => `${+(n * baseTileHeightPx).toFixed(2)}px`,
    [baseTileHeightPx]
  );

  const radiusPx = size.width * arc(bend);
  const radius = `${+radiusPx.toFixed(2)}px`;

  const turn = React.useCallback(
    (deg: number) =>
      `translateZ(${radius}) rotateY(${+deg.toFixed(4)}deg) translateZ(-${radius})`,
    [radius]
  );

  const hide = +(((sweep - limit) / (2 * sweep || 1)) * 100).toFixed(4);

  const css = React.useMemo(
    () =>
      `@keyframes ${orbit}{` +
      `from{transform:${turn(-sweep)}}to{transform:${turn(sweep)}}` +
      `0%,${hide}%,${100 - hide}%,100%{visibility:hidden}` +
      `${hide + 0.001}%,${100 - hide - 0.001}%{visibility:visible}}` +
      `@media(prefers-reduced-motion:reduce){.${tile}{animation-play-state:paused}}`,
    [orbit, tile, turn, sweep, hide]
  );

  const share = aspectRatio / SLICES;
  const duration = columns * speed;
  const mask = `linear-gradient(90deg,transparent,#000 ${fade}%,#000 ${
    100 - fade
  }%,transparent)`;

  const perspectivePx = +(radiusPx * CAMERA).toFixed(2);

  return (
    <div
      ref={ref}
      className={cn("relative overflow-hidden w-full", className)}
      {...props}
    >
      <style>{css}</style>

      {/* Renglón cilíndrico animado visible con cálculo directo en píxeles */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
        style={{
          perspective: `${perspectivePx}px`,
          perspectiveOrigin: `50% ${axis}%`,
          maskImage: mask,
          WebkitMaskImage: mask,
        }}
      >
        {Array.from({ length: columns }, (_, t) => {
          const first = columns - 1 - t;
          const img = images[(shown[t] ?? first) % Math.max(images.length, 1)];
          return (
            <div
              key={t}
              className={cn(tile, "absolute will-change-transform")}
              style={{
                left: `calc(50% - ${u(aspectRatio / 2)})`,
                top: `calc(${axis}% - ${u(0.5)})`,
                width: u(aspectRatio),
                height: u(1),
                transformStyle: "preserve-3d",
                animation: `${orbit} ${duration}s linear ${-t * speed}s infinite`,
              }}
              onAnimationIteration={(e) => {
                const lap = Math.round(e.elapsedTime / duration);
                setShown((prev) => {
                  const next = lap * columns + first;
                  return prev[t] === next ? prev : { ...prev, [t]: next };
                });
              }}
            >
              {Array.from({ length: SLICES }, (_, k) => (
                <div
                  key={k}
                  className={cn(
                    "absolute top-0 overflow-hidden bg-zinc-900 border-y border-zinc-700/40",
                    k === 0 && "rounded-l-lg border-l",
                    k === SLICES - 1 && "rounded-r-lg border-r",
                  )}
                  style={{
                    left: u((aspectRatio - share) / 2),
                    width:
                      k === SLICES - 1 ? u(share) : `calc(${u(share)} + 1px)`,
                    height: u(1),
                    transform: turn(
                      (aspectRatio / 2 - (k + 0.5) * share) * unit,
                    ),
                  }}
                >
                  {img ? (
                    <img
                      src={img.src}
                      alt={k === 0 ? (img.alt ?? "") : ""}
                      loading="eager"
                      draggable={false}
                      className="absolute top-0 max-w-none object-cover brightness-[0.88] contrast-[1.05]"
                      style={{
                        left: u(-k * share),
                        width: u(aspectRatio),
                        height: u(1),
                      }}
                    />
                  ) : null}
                  {/* Gradiente de profundidad */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20 pointer-events-none" />
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Contenido centrado */}
      {children && (
        <div className="relative z-10 w-full h-full flex flex-col justify-center items-center">
          {children}
        </div>
      )}
    </div>
  );
}

export default TiltedGridHero;

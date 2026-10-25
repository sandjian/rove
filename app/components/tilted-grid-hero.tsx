"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/* ── the curved 3D row ──────────────────────────────────────────────
 * Scroll Tilted Grid turned on its side with cylindrical perspective.
 * ─────────────────────────────────────────────────────────────── */

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
    return { columns: 2, sweep: 0, unit: 0, limit: 0 };
  const deg = (rad: number) => (rad * 180) / Math.PI;
  const unit = deg(h / radius);
  const pitch = (aspect + gap / 100) * unit;
  const limit = deg(bend) + (aspect * unit) / 2;
  const columns = Math.min(60, Math.max(2, Math.ceil((2 * limit) / pitch)));
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
  tileHeight = 28,
  aspectRatio = 16 / 9,
  gap = 6,
  axis = 65,
  curve = 75,
  fade = 14,
  children,
  className,
  ...props
}: React.ComponentProps<"div"> & TiltedGridHeroProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const id = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  const orbit = `tgh-o-${id}`;
  const tile = `tgh-t-${id}`;
  const bend = (Math.min(85, Math.max(5, curve)) * Math.PI) / 180;

  const [layout, setLayout] = React.useState<ReturnType<typeof measure> | null>(null);
  const [shown, setShown] = React.useState<Record<number, number>>({});

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width === 0 || height === 0) return;
      const next = measure(width, height, tileHeight, aspectRatio, gap, bend);
      setLayout((prev) =>
        prev?.columns === next.columns &&
        prev.sweep === next.sweep &&
        prev.unit === next.unit
          ? prev
          : next,
      );
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [tileHeight, aspectRatio, gap, bend]);

  // Pre-cargar imágenes para evitar parpadeos
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    for (const { src } of images) {
      const img = new window.Image();
      img.src = src;
    }
  }, [images]);

  const { columns, sweep, unit, limit } =
    layout ?? measure(1200, 680, tileHeight, aspectRatio, gap, bend);

  const u = React.useCallback(
    (n: number) =>
      `calc(${+n.toFixed(4)} * min(${tileHeight}cqh, ${+(
        MAX_WIDTH / aspectRatio
      ).toFixed(4)}cqw))`,
    [tileHeight, aspectRatio]
  );

  const r = 100 * arc(bend);
  const radius = `${+r.toFixed(3)}cqw`;

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

  return (
    <div
      ref={ref}
      className={cn("relative overflow-hidden w-full", className)}
      {...props}
      style={{ containerType: "inline-size", ...props.style }}
    >
      <style>{css}</style>

      {/* Renglón cilíndrico animado */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 transition-opacity duration-700 overflow-hidden"
        style={{
          opacity: 0.85,
          perspective: `${+(r * CAMERA).toFixed(3)}cqw`,
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
                    "absolute top-0 overflow-hidden bg-zinc-900 border-y border-zinc-700/30",
                    k === 0 && "rounded-l-xl border-l",
                    k === SLICES - 1 && "rounded-r-xl border-r",
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
                      className="absolute top-0 max-w-none object-cover brightness-[0.92] contrast-[1.08] saturate-[0.9]"
                      style={{
                        left: u(-k * share),
                        width: u(aspectRatio),
                        height: u(1),
                      }}
                    />
                  ) : null}
                  {/* Sutil viñeta para integrar los cortes cilíndricos */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/30 pointer-events-none" />
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Contenido centrado renderizado por encima */}
      <div className="relative z-10 w-full h-full flex flex-col justify-center items-center">
        {children}
      </div>
    </div>
  );
}

export default TiltedGridHero;

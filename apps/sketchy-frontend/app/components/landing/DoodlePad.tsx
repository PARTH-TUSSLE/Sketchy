"use client";

import { useEffect, useRef, useState } from "react";

const GRID = 24;

export const GHOST_COUNT = 3;

const GHOSTS = [
  { name: "aahana", color: "#E05A3C" },
  { name: "riley", color: "#2AA583" },
  { name: "tomo", color: "#8B5CF6" },
  { name: "neve", color: "#D9A414" },
];

type Seg = [number, number, number, number];

interface Ghost {
  name: string;
  color: string;
  x: number;
  y: number;
  tx: number;
  ty: number;
  mode: "move" | "draw" | "wait";
  segs: Seg[];
  segIdx: number;
  seed: number;
  cooldown: number;
  wait: number;
}

function paintBase(c: CanvasRenderingContext2D, w: number, h: number) {
  c.clearRect(0, 0, w, h);
  const isDark =
    typeof document !== "undefined" &&
    (document.documentElement.classList.contains("dark") ||
      document.documentElement.getAttribute("data-theme") === "dark");

  c.strokeStyle = isDark
    ? "rgba(255, 255, 255, 0.05)"
    : "rgba(215, 210, 200, 0.5)";
  c.lineWidth = 1;
  for (let x = GRID; x < w; x += GRID) {
    c.beginPath();
    c.moveTo(x, 0);
    c.lineTo(x, h);
    c.stroke();
  }
  for (let y = GRID; y < h; y += GRID) {
    c.beginPath();
    c.moveTo(0, y);
    c.lineTo(w, y);
    c.stroke();
  }
}

function doodleSegments(x: number, y: number, seed: number): Seg[] {
  const segs: Seg[] = [];
  const r = 6 + Math.random() * 6;
  const kind = seed % 3;

  if (kind === 0) {
    // wobbly squiggle
    let px = x - 12;
    let py = y + 4;
    for (let i = 0; i < 4; i++) {
      const nx = px + 6 + Math.random() * 5;
      const ny = py + Math.sin(i * 1.7) * (5 + Math.random() * 4);
      segs.push([px, py, nx, ny]);
      px = nx;
      py = ny;
    }
  } else if (kind === 1) {
    // circle
    const steps = 18;
    for (let i = 0; i < steps; i++) {
      const a1 = (i / steps) * Math.PI * 2;
      const a2 = ((i + 1) / steps) * Math.PI * 2;
      segs.push([
        x + Math.cos(a1) * r,
        y + Math.sin(a1) * r,
        x + Math.cos(a2) * r,
        y + Math.sin(a2) * r,
      ]);
    }
  } else {
    // rectangle
    const w = 14 + Math.random() * 8;
    const h = 10 + Math.random() * 6;
    const x0 = x - w / 2;
    const y0 = y - h / 2;
    segs.push(
      [x0, y0, x0 + w, y0],
      [x0 + w, y0, x0 + w, y0 + h],
      [x0 + w, y0 + h, x0, y0 + h],
      [x0, y0 + h, x0, y0]
    );
  }
  return segs;
}

export function DoodlePad() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const strokes = useRef(0);

  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [count, setCount] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const wrap = wrapRef.current!;
    const layer = layerRef.current!;
    const ctx = canvas.getContext("2d")!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const size = () => {
      const rect = wrap.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paintBase(ctx, rect.width, rect.height);
    };
    size();

    const ro = new ResizeObserver(size);
    ro.observe(wrap);

    // Repaint canvas base grid whenever theme changes
    const mo = new MutationObserver(() => {
      const rect = wrap.getBoundingClientRect();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paintBase(ctx, rect.width, rect.height);
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });

    // ————— Ghost collaborators —————
    const dims = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      return { w, h };
    };

    const ghosts: Ghost[] = GHOSTS.map((g, i) => ({
      ...g,
      x: 0,
      y: 0,
      tx: 0,
      ty: 0,
      mode: "move",
      segs: [],
      segIdx: 0,
      seed: i * 7 + 3,
      cooldown: i === 0 ? 150 + Math.random() * 300 : Math.random() * 900 + 300,
      wait: 0,
    }));

    const els: Record<string, HTMLDivElement> = {};
    const cursorSVG = (color: string) =>
      `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">` +
      `<path d="M3 1.5 L13.2 6.2 L7.6 7.2 L6.2 12.8 Z" fill="${color}" stroke="#fff" stroke-width="1.2"/>` +
      `</svg>`;

    ghosts.forEach((g, i) => {
      const el = document.createElement("div");
      el.className = "ghost-cursor";
      el.style.animationDelay = `${400 + i * 180}ms`;
      el.innerHTML =
        cursorSVG(g.color) +
        `<span class="cursor-chip"><i style="background:${g.color}"></i>${g.name}</span>`;
      layer.appendChild(el);
      els[g.name] = el;
    });

    const renderCursor = (g: Ghost) => {
      els[g.name].style.transform = `translate3d(${g.x}px, ${g.y}px, 0)`;
    };

    const pickTarget = (g: Ghost) => {
      const { w, h } = dims();
      g.tx = 26 + Math.random() * Math.max(40, w - 52);
      g.ty = 26 + Math.random() * Math.max(40, h - 52);
    };

    ghosts.forEach((g) => {
      pickTarget(g);
      g.x = g.tx;
      g.y = g.ty;
    });
    ghosts.forEach(renderCursor);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let cancelLoop: () => void = () => {};

    if (reduced) {
      // Show the room populated, but still.
      ghosts.forEach((g, i) => {
        const { w, h } = dims();
        g.x = w * (0.18 + 0.26 * (i + 0.5));
        g.y = h * (0.2 + 0.22 * i);
        renderCursor(g);
      });
    } else {
      let raf = 0;
      let lastT = performance.now();
      let visible = true;
      const io = new IntersectionObserver(
        ([e]) => {
          visible = e.isIntersecting;
        },
        { threshold: 0 }
      );
      io.observe(wrap);

      const step = (ts: number) => {
        raf = requestAnimationFrame(step);
        if (!visible) return;
        const dt = Math.min((ts - lastT) / 1000, 0.05);
        lastT = ts;

        for (const g of ghosts) {
          if (g.mode === "move") {
            const dx = g.tx - g.x;
            const dy = g.ty - g.y;
            const d = Math.hypot(dx, dy);
            if (d < 2) {
              g.cooldown -= dt * 1000;
              if (g.cooldown <= 0) {
                g.cooldown = 800 + Math.random() * 2000;
                if (Math.random() < 0.7) {
                  g.mode = "draw";
                  g.segs = doodleSegments(g.x, g.y, g.seed + Math.floor(Math.random() * 7));
                  g.segIdx = 0;
                } else {
                  pickTarget(g);
                }
              }
            } else {
              const stepPx = Math.min(d, (70 + Math.random() * 40) * dt);
              g.x += (dx / d) * stepPx;
              g.y += (dy / d) * stepPx;
              renderCursor(g);
            }
          } else if (g.mode === "draw") {
            ctx.strokeStyle = g.color;
            ctx.lineWidth = 1.8;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            for (let i = 0; i < 4 && g.segIdx < g.segs.length; i++, g.segIdx++) {
              const [x1, y1, x2, y2] = g.segs[g.segIdx];
              ctx.beginPath();
              ctx.moveTo(x1, y1);
              ctx.lineTo(x2, y2);
              ctx.stroke();
            }
            if (g.segIdx >= g.segs.length) {
              g.mode = "wait";
              g.wait = 250 + Math.random() * 900;
            }
          } else if (g.mode === "wait") {
            g.wait -= dt * 1000;
            if (g.wait <= 0) {
              g.mode = "move";
              pickTarget(g);
            }
          }
        }
      };

      raf = requestAnimationFrame((t) => {
        lastT = t;
        raf = requestAnimationFrame(step);
      });

      cancelLoop = () => {
        cancelAnimationFrame(raf);
        io.disconnect();
      };
    }

    return () => {
      ro.disconnect();
      mo.disconnect();
      cancelLoop();
      layer.innerHTML = "";
    };
  }, []);

  const point = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const down = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = point(e);
    strokes.current += 1;
    setCount(strokes.current);
  };

  const move = (e: React.PointerEvent) => {
    const p = point(e);
    setPos(p);
    if (!drawing.current || !last.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.strokeStyle = "#3a3ff2";
    ctx.lineWidth = 2.25;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  };

  const up = () => {
    drawing.current = false;
    last.current = null;
  };

  const clear = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintBase(ctx, rect.width, rect.height);
    strokes.current = 0;
    setCount(0);
  };

  return (
    <div ref={wrapRef} className="relative h-full w-full select-none">
      <canvas
        ref={canvasRef}
        className="duck-pad block h-full w-full"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerLeave={() => {
          up();
          setPos(null);
        }}
      />

      {/* Ghost collaborator layer */}
      <div ref={layerRef} className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true" />

      {pos && (
        <div
          className="anno pointer-events-none absolute rounded-md border border-line bg-paper/90 px-2 py-1 text-[10px] shadow-xs backdrop-blur-xs"
          style={{
            left: Math.min(pos.x + 12, (wrapRef.current?.clientWidth ?? 0) - 110),
            top: Math.min(pos.y + 12, (wrapRef.current?.clientHeight ?? 0) - 40),
          }}
        >
          x {Math.round(pos.x * 10) / 10} · y {Math.round(pos.y * 10) / 10}
        </div>
      )}

      <div className="absolute right-3 top-3">
        <button
          onClick={clear}
          className="anno pointer-events-auto cursor-pointer rounded-lg border border-line bg-paper px-2.5 py-1.5 text-[10px] transition-all hover:border-ink hover:text-ink active:scale-95 shadow-xs"
        >
          clear {count > 0 ? `· ${count}` : ""}
        </button>
      </div>
    </div>
  );
}
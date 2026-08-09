"use client";

import { useEffect, useRef, useState } from "react";

const GRID = 24;

function paintBase(c: CanvasRenderingContext2D, w: number, h: number) {
  c.clearRect(0, 0, w, h);
  c.strokeStyle = "rgba(224,221,211,0.9)";
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

export function DoodlePad() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const strokes = useRef(0);

  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [count, setCount] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const wrap = wrapRef.current!;
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

    return () => {
      ro.disconnect();
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
    <div ref={wrapRef} className="relative h-full w-full">
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

      {pos && (
        <div
          className="anno pointer-events-none absolute rounded-md border border-line bg-paper px-2 py-1 opacity-90"
          style={{
            left: Math.min(pos.x + 12, (wrapRef.current?.clientWidth ?? 0) - 110),
            top: Math.min(pos.y + 12, (wrapRef.current?.clientHeight ?? 0) - 40),
          }}
        >
          x {Math.round(pos.x * 10) / 10} · y {Math.round(pos.y * 10) / 10}
        </div>
      )}

      <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-2">
        <span className="live-dot h-2 w-2 rounded-full bg-marker" />
        <span className="anno">live board</span>
      </div>

      <div className="absolute right-3 top-3">
        <button
          onClick={clear}
          className="anno pointer-events-auto rounded-md border border-line bg-paper px-2.5 py-1.5 text-[10px] transition-colors hover:border-ink hover:text-ink"
        >
          clear {count > 0 ? `· ${count}` : ""}
        </button>
      </div>

      <div className="pointer-events-none absolute bottom-3 left-4">
        <span className="anno text-inkfaint">draw — it is a real canvas</span>
      </div>
    </div>
  );
}
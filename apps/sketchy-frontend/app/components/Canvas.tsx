"use client";

import { useRef, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IconButton } from "../components/IconButton";
import {
  ArrowLeft,
  Circle,
  Eraser,
  Frame,
  Hand,
  Pencil,
  RectangleHorizontal,
  Trash2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Game, COLORS, DEFAULT_COLOR } from "../draw/Game";

export default function Canvas({
  roomId,
  roomName,
  socket,
}: {
  roomId: string;
  roomName: string;
  socket: WebSocket;
}) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const coordsRef = useRef<HTMLSpanElement>(null);
  const [selectedTool, setSelectedTool] = useState<Tool>("pencil");
  const [selectedColor, setSelectedColor] = useState<string>(DEFAULT_COLOR);
  const [panMode, setPanMode] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [game, setGame] = useState<Game>();

  const goBack = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx;
    if (typeof idx === "number" && idx > 0) {
      router.back();
    } else {
      router.push("/");
    }
  };

  const selectTool = (t: Tool) => {
    setSelectedTool(t);
    setPanMode(false);
  };

  useEffect(() => {
    if (canvasRef.current) {
      const g = new Game(canvasRef.current, roomId, socket, {
        onViewChange: ({ zoom }) => setZoom(Math.round(zoom * 100)),
      });
      setGame(g);

      return () => {
        g.destroy();
      };
    }
  }, [roomId, socket]);

  useEffect(() => {
    game?.setTool(selectedTool);
  }, [selectedTool, game]);

  useEffect(() => {
    game?.setColor(selectedColor);
  }, [selectedColor, game]);

  useEffect(() => {
    game?.setPanMode(panMode);
  }, [panMode, game]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.tagName === "INPUT") return;
      if (e.key === "v" || e.key === "P" || e.key === "p") selectTool("pencil");
      else if (e.key === "r" || e.key === "R") selectTool("rect");
      else if (e.key === "c" || e.key === "C") selectTool("circle");
      else if (e.key === "e" || e.key === "E") selectTool("eraser");
      else if (e.key === "h" || e.key === "H") setPanMode((m) => !m);
      else if (e.key === "+" || e.key === "=") game?.zoomIn();
      else if (e.key === "-" || e.key === "_") game?.zoomOut();
      else if (/^[0-9]$/.test(e.key)) {
        const idx = e.key === "0" ? COLORS.length - 1 : Number(e.key) - 1;
        setSelectedColor(COLORS[idx]?.value ?? DEFAULT_COLOR);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [game]);

  const trackCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);
    if (coordsRef.current) {
      coordsRef.current.textContent = `x ${x} · y ${y}`;
    }
  };

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden select-none bg-[#141419] text-paper">
      {/* room chrome — top */}
      <header className="relative z-10 flex items-center justify-between gap-4 border-b border-white/10 px-5 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={goBack}
            aria-label="Back to studio"
            title="Back to studio"
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-white/10 bg-white/5 text-paper/70 transition-colors hover:bg-white/10 hover:text-paper"
          >
            <ArrowLeft size={17} />
          </button>
          <span className="font-[var(--font-serif)] text-xl italic text-paper">
            Sketchy
          </span>
          <span className="anno hidden text-paper/40 sm:inline">studio</span>
        </div>

        <div className="hidden min-w-0 items-center gap-3 sm:flex">
          <span className="anno text-paper/40">drawing</span>
          <span className="max-w-[280px] truncate rounded-md border border-white/15 bg-white/5 px-2.5 py-1 font-mono text-sm text-paper/90">
            {roomName}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="live-dot h-2 w-2 rounded-full bg-marker" />
          <span className="anno text-paper/50">live</span>
        </div>
      </header>

      {/* desk */}
      <div className="relative flex-1 overflow-hidden p-4 sm:p-8">
        {/* desk vignette, so the paper floats on the dark table */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_0%,transparent_40%,rgba(0,0,0,0.5))]" />

        <div className="relative mx-auto h-full w-full max-w-[1600px]">
          {/* corner labels */}
          <span className="anno pointer-events-none absolute -left-2 top-1/2 -translate-y-1/2 -rotate-90 text-paper/25">
            y ⇣
          </span>
          <span className="anno pointer-events-none absolute left-1/2 -top-3 -translate-x-1/2 text-paper/25">
            x ⇢
          </span>

          <canvas
            ref={canvasRef}
            onMouseMove={trackCoords}
            onMouseLeave={() => {
              if (coordsRef.current) coordsRef.current.textContent = "x 0 · y 0";
            }}
            className="absolute inset-0 h-full w-full cursor-crosshair rounded-2xl shadow-[0_24px_64px_-24px_rgba(0,0,0,0.8)] ring-1 ring-white/5 touch-none"
          />
        </div>

        {/* drafting ruler toolbar */}
        <div className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-2xl border border-white/10 bg-[#1c1c24]/90 p-1.5 pl-3 shadow-[0_16px_40px_-16px_rgba(0,0,0,0.9)] backdrop-blur-md">
          <span className="anno mr-2 inline-flex items-center gap-1 border-r border-white/10 pr-3 text-paper/40">
            tools
          </span>
          <IconButton
            tone="dark"
            activated={selectedTool === "pencil"}
            icon={<Pencil size={18} />}
            label="Pencil (P)"
            onClick={() => selectTool("pencil")}
          />
          <IconButton
            tone="dark"
            activated={selectedTool === "rect"}
            icon={<RectangleHorizontal size={18} />}
            label="Rectangle (R)"
            onClick={() => selectTool("rect")}
          />
          <IconButton
            tone="dark"
            activated={selectedTool === "circle"}
            icon={<Circle size={18} />}
            label="Circle (C)"
            onClick={() => selectTool("circle")}
          />
          <IconButton
            tone="dark"
            activated={selectedTool === "eraser"}
            icon={<Eraser size={18} />}
            label="Eraser (E)"
            onClick={() => selectTool("eraser")}
          />
          <span className="mx-1.5 h-6 w-px bg-white/10" />
          <IconButton
            tone="dark"
            activated={panMode}
            icon={<Hand size={18} />}
            label="Hand · pan (H, or hold space)"
            onClick={() => setPanMode((m) => !m)}
          />
          <div className="flex items-center gap-1.5 px-1">
            {COLORS.map((c, i) => (
              <button
                key={c.value}
                type="button"
                aria-label={`${c.name} ink (${i + 1})`}
                aria-pressed={selectedColor === c.value}
                title={`${c.name} — ${i + 1}`}
                onClick={() => setSelectedColor(c.value)}
                className={`h-5 w-5 shrink-0 cursor-pointer rounded-full border border-white/30 transition-transform duration-150 hover:scale-110 ${
                  selectedColor === c.value
                    ? "scale-110 ring-2 ring-white ring-offset-2 ring-offset-[#1c1c24]"
                    : ""
                }`}
                style={{ backgroundColor: c.value }}
              />
            ))}
          </div>
          <span className="mx-1.5 h-6 w-px bg-white/10" />
          <IconButton
            tone="dark"
            activated={false}
            icon={<Trash2 size={18} />}
            label="Clear entire board"
            onClick={() => game?.clearBoard()}
          />
        </div>

        {/* tool hint */}
        <div className="absolute bottom-6 right-5 hidden sm:block">
          <span className="anno text-paper/35">
            {panMode && "h — hand / pan"}
            {!panMode && selectedTool === "pencil" && "p — freehand stroke"}
            {!panMode && selectedTool === "rect" && "r — bounding box"}
            {!panMode && selectedTool === "circle" && "c — circumscribe"}
            {!panMode && selectedTool === "eraser" && "e — erase a stroke"}
          </span>
          <span className="anno ml-3 text-paper/25">1–9 ink · space pan · ⌃+scroll zoom</span>
        </div>
      </div>

      {/* footer — drafting plate along the table */}
      <footer className="relative z-10 flex items-center justify-between gap-4 border-t border-white/10 px-5 py-2.5 sm:px-6">
        <div className="flex items-center gap-3">
          <span ref={coordsRef} className="anno w-32 text-paper/40">
            x 0 · y 0
          </span>
          <span className="hidden h-4 w-px bg-white/10 sm:block" />
          <div className="hidden items-center rounded-lg border border-white/10 bg-white/5 p-0.5 sm:flex">
            <button
              type="button"
              aria-label="Zoom out"
              title="Zoom out (−)"
              onClick={() => game?.zoomOut()}
              className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-paper/60 transition-colors hover:bg-white/10 hover:text-paper"
            >
              <ZoomOut size={13} />
            </button>
            <button
              type="button"
              aria-label="Reset zoom to 100%"
              title="Reset zoom to 100%"
              onClick={() => game?.resetZoom()}
              className="min-w-11 cursor-pointer rounded-md px-1.5 py-1 font-mono text-[11px] text-paper/70 transition-colors hover:bg-white/10 hover:text-paper"
            >
              {zoom}%
            </button>
            <button
              type="button"
              aria-label="Zoom in"
              title="Zoom in (+)"
              onClick={() => game?.zoomIn()}
              className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-paper/60 transition-colors hover:bg-white/10 hover:text-paper"
            >
              <ZoomIn size={13} />
            </button>
            <button
              type="button"
              aria-label="Center on drawing"
              title="Center on drawing"
              onClick={() => game?.fitView()}
              className="mx-0.5 flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border-l border-white/10 text-paper/60 transition-colors hover:bg-white/10 hover:text-paper"
            >
              <Frame size={13} />
            </button>
          </div>
        </div>
        <span className="anno hidden text-paper/30 md:block">
          infinite canvas · pan · zoom
        </span>
        <span className="anno text-paper/30">sketchy · realtime</span>
      </footer>
    </div>
  );
}

export type Tool = "pencil" | "rect" | "circle" | "eraser";
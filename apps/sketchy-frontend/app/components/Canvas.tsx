"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { IconButton } from "../components/IconButton";
import {
  PlugConnectedIcon,
  SelectIcon,
  PencilIcon,
  RectIcon,
  CircleIcon,
  ArrowIcon,
  TextIcon,
  ImageIcon,
  EraserIcon,
  LaserIcon,
  HandIcon,
  UndoIcon,
  RedoIcon,
  ZoomInIcon,
  ZoomOutIcon,
  FitViewIcon,
  TrashIcon,
  SlidersIcon,
  ArrowLeftIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from "./icons";
import { Sparkles, X, Check, Share2, Users } from "lucide-react";
import { Game, COLORS, DEFAULT_COLOR, DEFAULT_FONT_SIZE, FONTS, DEFAULT_FONT_FAMILY, type Shape } from "../draw/Game";
import { processImageFile } from "../draw/image";

export type Tool = "pencil" | "rect" | "circle" | "arrow" | "text" | "image" | "select" | "eraser" | "laser";

const TOOLS: { id: Tool; label: string; shortcut: string; getIcon: (size?: number) => React.ReactNode }[] = [
  { id: "select", label: "Select", shortcut: "V", getIcon: (size = 17) => <SelectIcon size={size} /> },
  { id: "pencil", label: "Pencil", shortcut: "P", getIcon: (size = 17) => <PencilIcon size={size} /> },
  { id: "rect", label: "Rectangle", shortcut: "R", getIcon: (size = 17) => <RectIcon size={size} /> },
  { id: "circle", label: "Circle", shortcut: "C", getIcon: (size = 17) => <CircleIcon size={size} /> },
  { id: "arrow", label: "Arrow", shortcut: "A", getIcon: (size = 17) => <ArrowIcon size={size} /> },
  { id: "text", label: "Text", shortcut: "T", getIcon: (size = 17) => <TextIcon size={size} /> },
  { id: "image", label: "Image", shortcut: "I", getIcon: (size = 17) => <ImageIcon size={size} /> },
  { id: "eraser", label: "Eraser", shortcut: "E", getIcon: (size = 17) => <EraserIcon size={size} /> },
  { id: "laser", label: "Laser", shortcut: "G", getIcon: (size = 17) => <LaserIcon size={size} /> },
];

const TEXT_BOX_PAD_X = 14;
const TEXT_BOX_PAD_Y = 10;
const TEXT_BOX_BORDER = 1;

const PAPER_COLORS = [
  { name: "Paper", value: "#f8f6f1" },
  { name: "Clean White", value: "#ffffff" },
  { name: "Blueprint Mist", value: "#dce4ee" },
  { name: "Warm Sand", value: "#efe2cd" },
  { name: "Sage Slate", value: "#e3ead9" },
  { name: "Obsidian", value: "#232329" },
] as const;

const DEFAULT_PAPER = PAPER_COLORS[0].value;

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedTool, setSelectedTool] = useState<Tool>("pencil");
  const [selectedColor, setSelectedColor] = useState<string>(DEFAULT_COLOR);
  const [selectedFont, setSelectedFont] = useState<string>(DEFAULT_FONT_FAMILY);
  const [backgroundColor, setBackgroundColor] = useState<string>(DEFAULT_PAPER);
  const [strokeWidth, setStrokeWidth] = useState<number>(2);
  const [panMode, setPanMode] = useState(false);
  const [toolbarOpen, setToolbarOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [zoom, setZoom] = useState(100);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [game, setGame] = useState<Game>();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [memberCount, setMemberCount] = useState(1);
  const [copied, setCopied] = useState(false);

  // In-place note editing for the text tool.
  const [textDraft, setTextDraft] = useState<{ x: number; y: number } | null>(null);
  const [textValue, setTextValue] = useState("");

  const gameRef = useRef<Game | undefined>(undefined);
  gameRef.current = game;
  const colorRef = useRef(selectedColor);
  colorRef.current = selectedColor;
  const fontRef = useRef(selectedFont);
  fontRef.current = selectedFont;
  const textValueRef = useRef(textValue);
  textValueRef.current = textValue;
  const textDraftRef = useRef(textDraft);
  textDraftRef.current = textDraft;
  const editingTextIdRef = useRef<string | null>(null);
  const suppressTextStartRef = useRef(false);

  const goBack = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx;
    if (typeof idx === "number" && idx > 0) {
      router.back();
    } else {
      router.push("/new-room");
    }
  };

  const shareHref =
    typeof window !== "undefined"
      ? `${window.location.origin}/canvas/${encodeURIComponent(roomName)}`
      : "";

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareHref);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — the link is still visible in the address bar.
    }
  };

  const commitTextDraft = useCallback(() => {
    const draft = textDraftRef.current;
    if (!draft) return false;
    textDraftRef.current = null;
    const value = textValueRef.current;
    const editId = editingTextIdRef.current;
    editingTextIdRef.current = null;
    setTextDraft(null);
    setTextValue("");
    if (value.trim().length > 0 && gameRef.current) {
      if (editId) {
        gameRef.current.commitTextEdit(
          editId,
          draft.x,
          draft.y,
          value,
          DEFAULT_FONT_SIZE,
          colorRef.current,
          fontRef.current
        );
      } else {
        gameRef.current.commitText(draft.x, draft.y, value, DEFAULT_FONT_SIZE, colorRef.current, fontRef.current);
      }
    }
    return true;
  }, []);

  const resizeTextArea = useCallback(() => {
    const t = textareaRef.current;
    if (!t) return;
    const chrome = 2 * TEXT_BOX_BORDER;
    t.style.width = "0px";
    const w = t.scrollWidth;
    t.style.width = `${Math.ceil(w) + chrome}px`;
    t.style.height = "0px";
    const h = t.scrollHeight;
    t.style.height = `${Math.ceil(h) + chrome}px`;
  }, []);

  const selectTool = useCallback((t: Tool) => {
    commitTextDraft();
    if (t === "text") suppressTextStartRef.current = false;
    setSelectedTool(t);
    setPanMode(false);
  }, [commitTextDraft]);

  const pickImage = () => {
    fileInputRef.current?.click();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !gameRef.current) return;
    try {
      const dataUrl = await processImageFile(file);
      gameRef.current.insertImage(dataUrl);
      selectTool("select");
    } catch (err) {
      console.error("Failed to load image:", err);
    }
  };

  const handleStartText = useCallback(
    (x: number, y: number) => {
      if (suppressTextStartRef.current) {
        suppressTextStartRef.current = false;
        return;
      }
      commitTextDraft();
      editingTextIdRef.current = null;
      setTextDraft({ x, y });
      setTextValue("");
    },
    [commitTextDraft]
  );

  const handleEditText = useCallback((shape: Shape) => {
    if (shape.type !== "text") return;
    commitTextDraft();
    editingTextIdRef.current = shape.id;
    setSelectedColor(shape.color);
    setSelectedFont(shape.fontFamily || DEFAULT_FONT_FAMILY);
    setTextDraft({ x: shape.x, y: shape.y });
    setTextValue(shape.text);
  }, [commitTextDraft]);

  const handlePreMouseDown = useCallback(() => {
    if (commitTextDraft()) {
      suppressTextStartRef.current = true;
      return true;
    }
    return false;
  }, [commitTextDraft]);

  useEffect(() => {
    if (textDraft) {
      const t = textareaRef.current;
      if (t) {
        t.focus();
        const end = t.value.length;
        t.setSelectionRange(end, end);
      }
    }
  }, [textDraft]);

  useEffect(() => {
    if (textDraft) {
      requestAnimationFrame(resizeTextArea);
    }
  }, [textDraft, textValue, resizeTextArea]);

  const lastSentBackgroundRef = useRef<string | null>(DEFAULT_PAPER);

  const handleBackgroundChange = useCallback((color: string) => {
    lastSentBackgroundRef.current = color;
    setBackgroundColor(color);
  }, []);

  const handleHistoryChange = useCallback((undo: boolean, redo: boolean) => {
    setCanUndo(undo);
    setCanRedo(redo);
  }, []);

  useEffect(() => {
    if (canvasRef.current) {
      const g = new Game(canvasRef.current, roomId, socket, {
        onViewChange: ({ zoom }) => setZoom(Math.round(zoom * 100)),
        onStartText: handleStartText,
        onEditText: handleEditText,
        onPreMouseDown: handlePreMouseDown,
        onBackgroundChange: handleBackgroundChange,
        onHistoryChange: handleHistoryChange,
        onPresenceChange: setMemberCount,
      });
      setGame(g);

      return () => {
        g.destroy();
      };
    }
  }, [roomId, socket, handleStartText, handleEditText, handlePreMouseDown, handleBackgroundChange, handleHistoryChange]);

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
    game?.setFontFamily(selectedFont);
  }, [selectedFont, game]);

  useEffect(() => {
    game?.setBackgroundColor(backgroundColor);
    if (backgroundColor !== lastSentBackgroundRef.current) {
      lastSentBackgroundRef.current = backgroundColor;
      socket.send(
        JSON.stringify({ type: "background", roomId, backgroundColor })
      );
    }
  }, [backgroundColor, game, socket, roomId]);

  useEffect(() => {
    game?.setStrokeWidth(strokeWidth);
  }, [strokeWidth, game]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) game?.redo();
        else game?.undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        game?.redo();
      } else if (e.key === "v" || e.key === "V") selectTool("select");
      else if (e.key === "p" || e.key === "P") selectTool("pencil");
      else if (e.key === "r" || e.key === "R") selectTool("rect");
      else if (e.key === "c" || e.key === "C") selectTool("circle");
      else if (e.key === "a" || e.key === "A") selectTool("arrow");
      else if (e.key === "t" || e.key === "T") selectTool("text");
      else if (e.key === "i" || e.key === "I") {
        selectTool("image");
        pickImage();
      } else if (e.key === "e" || e.key === "E") selectTool("eraser");
      else if (e.key === "g" || e.key === "G") selectTool("laser");
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
  }, [game, selectTool]);

  const trackCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);
    if (coordsRef.current) {
      coordsRef.current.textContent = `x ${x} · y ${y}`;
    }
  };

  const textPos = textDraft && game ? game.worldToScreen(textDraft.x, textDraft.y) : null;

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden select-none bg-[#0a0b0f] text-white">
      {/* Studio Header Bar */}
      <header className="relative z-30 flex items-center justify-between gap-2 border-b border-white/10 bg-[#0d0e14]/90 px-3 py-2 sm:px-6 sm:py-2.5 backdrop-blur-2xl shadow-md">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3.5">
          <button
            type="button"
            onClick={goBack}
            aria-label="Back to studio"
            title="Back to studio"
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/70 transition-all duration-150 hover:bg-white/12 hover:border-white/20 hover:text-white active:scale-95 touch-manipulation"
          >
            <ArrowLeftIcon size={17} />
          </button>
          <div className="flex items-center gap-2">
            <span className="font-[var(--font-serif)] text-lg sm:text-2xl italic font-normal text-white tracking-tight">
              Sketchy
            </span>
            <span className="anno text-[9px] sm:text-[10px] text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full font-mono uppercase tracking-wider hidden sm:inline-block">
              Studio
            </span>
          </div>
        </div>

        {/* Members + Share */}
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 sm:gap-2 rounded-xl border border-white/12 bg-white/5 px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-mono text-white/90 shadow-inner">
            <Users size={14} className="text-white/60 shrink-0" />
            <span className="font-semibold tabular-nums">{memberCount}</span>
            <span className="hidden sm:inline text-white/60">online</span>
          </div>
          <button
            type="button"
            onClick={copyLink}
            aria-label="Copy room link"
            title="Copy room link"
            className={`flex items-center gap-1.5 rounded-xl border px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-mono transition-all active:scale-95 cursor-pointer ${
              copied
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                : "border-white/12 bg-white/5 text-white/90 hover:bg-white/12 hover:border-white/20"
            }`}
          >
            {copied ? <Check size={14} /> : <Share2 size={14} />}
            <span className="hidden sm:inline">{copied ? "Copied" : "Share"}</span>
          </button>
        </div>

        {/* Status / Mobile Full Toolbar Sheet Button */}
        <div className="flex items-center gap-2">
          {/* Mobile Full Toolbar Sheet Toggle */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open Full Toolbar & Options"
            title="Open Full Toolbar"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-500/50 bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 text-xs font-medium transition-all active:scale-95 touch-manipulation shadow-sm"
          >
            <Sparkles size={14} className="text-indigo-400 animate-pulse" />
            <span className="font-mono text-[11px] uppercase tracking-wider">Tools</span>
          </button>

          <div className="hidden sm:flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-400 font-mono">
            <PlugConnectedIcon size={16} color="#34d399" />
            <span>Live Sync</span>
          </div>
        </div>
      </header>

      {/* Main Studio Canvas Workspace */}
      <div className="relative flex-1 overflow-hidden p-0 sm:p-4 md:p-6 bg-[#090a0e]">
        {/* Subtle Vignette Overlay */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(140%_140%_at_50%_0%,transparent_35%,rgba(0,0,0,0.85))] z-0" />

        <div className="relative mx-auto h-full w-full max-w-[1700px] z-10">
          {/* Axis Labels */}
          <span className="anno pointer-events-none absolute -left-1 top-1/2 -translate-y-1/2 -rotate-90 text-[10px] text-white/20 hidden sm:block">
            y ⇣
          </span>
          <span className="anno pointer-events-none absolute left-1/2 -top-2 -translate-x-1/2 text-[10px] text-white/20 hidden sm:block">
            x ⇢
          </span>

          <canvas
            ref={canvasRef}
            onMouseMove={trackCoords}
            onMouseLeave={() => {
              if (coordsRef.current) coordsRef.current.textContent = "x 0 · y 0";
            }}
            className="absolute inset-0 h-full w-full cursor-crosshair rounded-none sm:rounded-2xl shadow-[0_25px_70px_-15px_rgba(0,0,0,0.9)] touch-none"
          />

          {/* In-place Note Editor for Text Tool */}
          {textPos && (
            <textarea
              ref={textareaRef}
              value={textValue}
              placeholder="Type… ↵ to place"
              onChange={(e) => setTextValue(e.target.value)}
              onBlur={commitTextDraft}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  commitTextDraft();
                } else if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  commitTextDraft();
                }
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              className="absolute z-40 max-h-[80vh] max-w-[88vw] resize-none overflow-hidden select-text whitespace-pre rounded-xl border-2 border-indigo-500/80 bg-white shadow-[0_8px_32px_-4px_rgba(0,0,0,0.4)] outline-none placeholder:text-slate-400 p-2"
              style={{
                left: textPos.x - TEXT_BOX_PAD_X - TEXT_BOX_BORDER,
                top: textPos.y - TEXT_BOX_PAD_Y - TEXT_BOX_BORDER,
                padding: `${TEXT_BOX_PAD_Y}px ${TEXT_BOX_PAD_X}px`,
                minWidth:
                  DEFAULT_FONT_SIZE * game!.getZoom() * 2 +
                  TEXT_BOX_PAD_X * 2 +
                  TEXT_BOX_BORDER * 2,
                minHeight:
                  DEFAULT_FONT_SIZE * game!.getZoom() * 1.4 +
                  TEXT_BOX_PAD_Y * 2 +
                  TEXT_BOX_BORDER * 2,
                fontSize: `${DEFAULT_FONT_SIZE * game!.getZoom()}px`,
                lineHeight: `${DEFAULT_FONT_SIZE * game!.getZoom() * 1.3}px`,
                fontFamily: selectedFont,
                color: selectedColor,
                caretColor: selectedColor,
              }}
            />
          )}
        </div>

        {/* Floating Contextual Property Inspector Panel (Desktop & Tablet) */}
        {toolbarOpen && inspectorOpen && (
          <div className="hidden sm:flex absolute bottom-20 sm:bottom-22 left-1/2 -translate-x-1/2 z-30 max-w-[calc(100vw-1.5rem)] items-center gap-3 overflow-x-auto scrollbar-none rounded-2xl border border-white/15 bg-[#14151f]/95 p-2 px-3.5 shadow-[0_20px_50px_-10px_rgba(0,0,0,0.9)] backdrop-blur-2xl transition-all animate-in fade-in slide-in-from-bottom-2">
            {/* Stroke Width Control */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="anno text-[10px] text-white/40">width</span>
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-2.5 py-1">
                <div
                  className="rounded-full bg-indigo-400 shrink-0 transition-all"
                  style={{
                    width: `${Math.max(3, Math.min(14, strokeWidth))}px`,
                    height: `${Math.max(3, Math.min(14, strokeWidth))}px`,
                  }}
                />
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={strokeWidth}
                  onChange={(e) => setStrokeWidth(Number(e.target.value))}
                  className="w-16 sm:w-20 h-1.5 accent-indigo-500 cursor-pointer rounded-lg touch-manipulation"
                  aria-label="Stroke width"
                  title={`Stroke width: ${strokeWidth}`}
                />
                <span className="anno w-4 text-right text-[11px] text-white/80 font-mono">
                  {strokeWidth}
                </span>
              </div>
            </div>

            <span className="h-5 w-px bg-white/12 shrink-0" />

            {/* Ink Color Swatches */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="anno text-[10px] text-white/40 mr-0.5">ink</span>
              {COLORS.map((c, i) => (
                <button
                  key={c.value}
                  type="button"
                  aria-label={`${c.name} ink (${i + 1})`}
                  aria-pressed={selectedColor === c.value}
                  title={`${c.name} — (${i + 1})`}
                  onClick={() => setSelectedColor(c.value)}
                  className={`h-5 w-5 shrink-0 cursor-pointer rounded-full border border-white/30 transition-all duration-150 hover:scale-110 touch-manipulation ${
                    selectedColor === c.value
                      ? "scale-110 ring-2 ring-indigo-400 ring-offset-2 ring-offset-[#14151f]"
                      : "opacity-80 hover:opacity-100"
                  }`}
                  style={{ backgroundColor: c.value }}
                />
              ))}
              <label
                title="Custom ink colour"
                className="relative flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-white/40 transition-transform duration-150 hover:scale-110 touch-manipulation"
                style={{
                  background:
                    "conic-gradient(#e03131, #fcc419, #40c057, #228be6, #e03131)",
                }}
              >
                <input
                  type="color"
                  value={selectedColor}
                  onChange={(e) => setSelectedColor(e.target.value)}
                  aria-label="Custom tool colour"
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
              </label>
            </div>

            {/* Font Family Selector (For Text Tool) */}
            {selectedTool === "text" && (
              <>
                <span className="h-5 w-px bg-white/12 shrink-0" />
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="anno text-[10px] text-white/40">font</span>
                  <select
                    value={selectedFont}
                    onChange={(e) => setSelectedFont(e.target.value)}
                    aria-label="Text font"
                    title="Text font"
                    style={{ fontFamily: selectedFont }}
                    className="h-7 cursor-pointer rounded-lg border border-white/15 bg-white/10 px-2 text-xs text-white outline-none transition-colors hover:bg-white/15 focus-visible:border-indigo-400 shrink-0"
                  >
                    {FONTS.map((f) => (
                      <option key={f.id} value={f.value} style={{ fontFamily: f.value, color: "#111" }}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <span className="h-5 w-px bg-white/12 shrink-0" />

            {/* Paper Canvas Backdrop Swatches */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="anno text-[10px] text-white/40 mr-0.5">paper</span>
              {PAPER_COLORS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  aria-label={`${p.name} paper`}
                  aria-pressed={backgroundColor === p.value}
                  title={`${p.name} paper`}
                  onClick={() => setBackgroundColor(p.value)}
                  className={`h-4.5 w-4.5 shrink-0 cursor-pointer rounded-md border border-white/30 transition-all duration-150 hover:scale-110 touch-manipulation ${
                    backgroundColor === p.value
                      ? "scale-110 ring-2 ring-indigo-400 ring-offset-2 ring-offset-[#14151f]"
                      : "opacity-75 hover:opacity-100"
                  }`}
                  style={{ backgroundColor: p.value }}
                />
              ))}
              <label
                title="Custom paper colour"
                className="relative flex h-4.5 w-4.5 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-md border border-white/40 transition-transform duration-150 hover:scale-110 touch-manipulation"
                style={{
                  background:
                    "conic-gradient(#e03131, #fcc419, #40c057, #228be6, #e03131)",
                }}
              >
                <input
                  type="color"
                  value={backgroundColor}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                  aria-label="Custom paper colour"
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
              </label>
            </div>
          </div>
        )}

        {/* Primary Floating Tool Dock (Desktop & Tablet) */}
        {toolbarOpen ? (
          <div className="hidden sm:flex absolute bottom-3 sm:bottom-6 left-1/2 z-30 max-w-[calc(100vw-1rem)] -translate-x-1/2 items-center gap-1 sm:gap-1.5 overflow-x-auto scrollbar-none rounded-2xl border border-white/15 bg-[#12131a]/95 p-1.5 sm:p-2 px-2.5 sm:px-3 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.95)] backdrop-blur-2xl">
            <div className="flex items-center gap-1 shrink-0">
              <IconButton
                tone="dark"
                activated={selectedTool === "select" && !panMode}
                icon={<SelectIcon size={17} />}
                label="Pointer · Select (V)"
                onClick={() => selectTool("select")}
              />
              <IconButton
                tone="dark"
                activated={selectedTool === "pencil" && !panMode}
                icon={<PencilIcon size={17} />}
                label="Freehand Pencil (P)"
                onClick={() => selectTool("pencil")}
              />
              <IconButton
                tone="dark"
                activated={selectedTool === "rect" && !panMode}
                icon={<RectIcon size={17} />}
                label="Rectangle (R)"
                onClick={() => selectTool("rect")}
              />
              <IconButton
                tone="dark"
                activated={selectedTool === "circle" && !panMode}
                icon={<CircleIcon size={17} />}
                label="Circle (C)"
                onClick={() => selectTool("circle")}
              />
              <IconButton
                tone="dark"
                activated={selectedTool === "arrow" && !panMode}
                icon={<ArrowIcon size={17} />}
                label="Arrow (A)"
                onClick={() => selectTool("arrow")}
              />
              <IconButton
                tone="dark"
                activated={selectedTool === "text" && !panMode}
                icon={<TextIcon size={17} />}
                label="Text Note (T)"
                onClick={() => selectTool("text")}
              />
              <IconButton
                tone="dark"
                activated={selectedTool === "image" && !panMode}
                icon={<ImageIcon size={17} />}
                label="Embed Image (I)"
                onClick={() => {
                  selectTool("image");
                  pickImage();
                }}
              />
              <IconButton
                tone="dark"
                activated={selectedTool === "eraser" && !panMode}
                icon={<EraserIcon size={17} />}
                label="Eraser (E)"
                onClick={() => selectTool("eraser")}
              />
              <IconButton
                tone="dark"
                activated={selectedTool === "laser" && !panMode}
                icon={<LaserIcon size={17} />}
                label="Laser Pointer (G)"
                onClick={() => selectTool("laser")}
              />

              <span className="mx-0.5 h-6 w-px bg-white/12 shrink-0" />

              <IconButton
                tone="dark"
                activated={panMode}
                icon={<HandIcon size={17} />}
                label="Hand Pan (H)"
                onClick={() => setPanMode((m) => !m)}
              />
            </div>

            <span className="mx-0.5 h-6 w-px bg-white/12 shrink-0" />

            {/* Quick Actions & Controls */}
            <div className="flex items-center gap-1 shrink-0">
              <IconButton
                tone="dark"
                activated={inspectorOpen}
                icon={<SlidersIcon size={16} />}
                label="Toggle Tool Options Inspector"
                onClick={() => setInspectorOpen((o) => !o)}
                badge={
                  inspectorOpen ? (
                    <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-indigo-400" />
                  ) : null
                }
              />
              <IconButton
                tone="dark"
                activated={false}
                icon={<TrashIcon size={16} />}
                label="Clear Board"
                onClick={() => game?.clearBoard()}
              />
              <IconButton
                tone="dark"
                activated={false}
                icon={<ChevronDownIcon size={16} />}
                label="Collapse Dock"
                onClick={() => setToolbarOpen(false)}
              />
            </div>
          </div>
        ) : (
          /* Collapsed Toolbar Trigger Button */
          <button
            type="button"
            aria-label="Expand drafting tools"
            title="Expand drafting tools"
            onClick={() => setToolbarOpen(true)}
            className="hidden sm:flex absolute bottom-4 sm:bottom-6 left-1/2 z-30 -translate-x-1/2 cursor-pointer items-center gap-2.5 rounded-full border border-white/20 bg-[#14151f]/95 px-5 py-2.5 text-white/90 shadow-[0_20px_45px_-10px_rgba(0,0,0,0.9)] backdrop-blur-2xl transition-all duration-180 hover:bg-[#1a1b26] hover:scale-105 active:scale-95 touch-manipulation"
          >
            <Sparkles size={16} className="text-indigo-400 animate-pulse" />
            <span className="anno text-[11px] text-white/80 font-mono tracking-wider">
              Drafting Tools
            </span>
            <ChevronUpIcon size={15} className="text-white/60" />
          </button>
        )}

        {/* Floating Bottom Left Control Widget (Desktop & Tablet) */}
        <div className="hidden sm:flex absolute bottom-3 sm:bottom-6 left-3 sm:left-6 z-20 items-center gap-2">
          {/* Coordinates Badge */}
          <div className="hidden sm:flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#12131a]/80 px-3 py-2 backdrop-blur-xl text-[11px] font-mono text-white/50 shadow-md">
            <span ref={coordsRef}>x 0 · y 0</span>
          </div>

          {/* Undo / Redo Button Group */}
          <div className="flex items-center gap-1 rounded-xl border border-white/12 bg-[#12131a]/90 p-1 backdrop-blur-2xl shadow-lg">
            <button
              type="button"
              aria-label="Undo last change"
              title="Undo (Ctrl+Z)"
              onClick={() => game?.undo()}
              disabled={!canUndo}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-white/70 transition-all hover:bg-white/12 hover:text-white disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent touch-manipulation"
            >
              <UndoIcon size={15} />
            </button>
            <button
              type="button"
              aria-label="Redo last change"
              title="Redo (Ctrl+Shift+Z)"
              onClick={() => game?.redo()}
              disabled={!canRedo}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-white/70 transition-all hover:bg-white/12 hover:text-white disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent touch-manipulation"
            >
              <RedoIcon size={15} />
            </button>
          </div>
        </div>

        {/* Floating Bottom Right Control Widget (Desktop & Tablet) */}
        <div className="hidden sm:flex absolute bottom-3 sm:bottom-6 right-3 sm:right-6 z-20 items-center gap-1 rounded-xl border border-white/12 bg-[#12131a]/90 p-1 backdrop-blur-2xl shadow-lg">
          <button
            type="button"
            aria-label="Zoom out"
            title="Zoom out (−)"
            onClick={() => game?.zoomOut()}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-white/70 transition-all hover:bg-white/12 hover:text-white touch-manipulation"
          >
            <ZoomOutIcon size={15} />
          </button>
          <button
            type="button"
            aria-label="Reset zoom to 100%"
            title="Reset zoom to 100%"
            onClick={() => game?.resetZoom()}
            className="min-w-10 sm:min-w-12 cursor-pointer rounded-lg px-1.5 py-1 font-mono text-[11px] text-white/80 transition-all hover:bg-white/12 hover:text-white text-center touch-manipulation"
          >
            {zoom}%
          </button>
          <button
            type="button"
            aria-label="Zoom in"
            title="Zoom in (+)"
            onClick={() => game?.zoomIn()}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-white/70 transition-all hover:bg-white/12 hover:text-white touch-manipulation"
          >
            <ZoomInIcon size={15} />
          </button>
          <button
            type="button"
            aria-label="Scroll back to content"
            title="Scroll back to content"
            onClick={() => game?.fitView()}
            className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border-l border-white/10 pl-2 pr-2.5 text-white/70 transition-all hover:bg-white/12 hover:text-white touch-manipulation"
          >
            <FitViewIcon size={14} />
            <span className="hidden sm:inline text-[11px] font-mono font-medium">Scroll back to content</span>
          </button>
        </div>

        {/* MOBILE BOTTOM QUICK BAR (Non-overlapping, single row control bar for Mobile & Small Screens) */}
        <div className="sm:hidden absolute bottom-3 left-2 right-2 z-30 flex items-center justify-between gap-1 p-1.5 rounded-2xl border border-white/15 bg-[#12131a]/95 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.9)]">
          {/* Left: Undo / Redo */}
          <div className="flex items-center gap-0.5 rounded-xl border border-white/10 bg-white/5 p-0.5">
            <button
              type="button"
              onClick={() => game?.undo()}
              disabled={!canUndo}
              aria-label="Undo"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 disabled:opacity-25 touch-manipulation"
            >
              <UndoIcon size={15} />
            </button>
            <button
              type="button"
              onClick={() => game?.redo()}
              disabled={!canRedo}
              aria-label="Redo"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 disabled:opacity-25 touch-manipulation"
            >
              <RedoIcon size={15} />
            </button>
          </div>

          {/* Center: Active Tool & Open Full Toolbar Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-indigo-500/50 bg-indigo-600/30 text-white text-xs font-medium shadow-md transition-all active:scale-95 touch-manipulation"
          >
            <span className="flex items-center gap-1">
              {panMode ? <HandIcon size={15} /> : (TOOLS.find((t) => t.id === selectedTool)?.getIcon(15))}
              <span className="font-mono text-[10px] uppercase tracking-wider">{panMode ? "Hand" : selectedTool}</span>
            </span>
            <span
              className="h-3 w-3 rounded-full border border-white/40 shrink-0"
              style={{ backgroundColor: selectedColor }}
            />
            <span className="h-3.5 w-px bg-white/20" />
            <span className="flex items-center gap-1 text-indigo-300 font-mono text-[10px]">
              <Sparkles size={12} />
              <span>ALL TOOLS</span>
            </span>
          </button>

          {/* Right: Zoom Out, Zoom %, Zoom In, Fit View */}
          <div className="flex items-center gap-0.5 rounded-xl border border-white/10 bg-white/5 p-0.5">
            <button
              type="button"
              onClick={() => game?.zoomOut()}
              aria-label="Zoom out"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 touch-manipulation"
            >
              <ZoomOutIcon size={14} />
            </button>
            <button
              type="button"
              onClick={() => game?.resetZoom()}
              className="px-1 font-mono text-[10px] text-white/80 touch-manipulation"
            >
              {zoom}%
            </button>
            <button
              type="button"
              onClick={() => game?.zoomIn()}
              aria-label="Zoom in"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 touch-manipulation"
            >
              <ZoomInIcon size={14} />
            </button>
            <button
              type="button"
              onClick={() => game?.fitView()}
              aria-label="Scroll back to content"
              className="flex h-8 w-8 items-center justify-center rounded-lg border-l border-white/10 text-white/70 hover:bg-white/10 touch-manipulation"
            >
              <FitViewIcon size={14} />
            </button>
          </div>
        </div>

        {/* Hidden File Input for Image Tool */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFile}
        />
      </div>

      {/* FULL MOBILE & DESKTOP TOOLBAR SHEET MODAL */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-md transition-all p-0 sm:p-4 animate-in fade-in duration-200">
          {/* Backdrop Overlay Click to Close */}
          <div
            className="absolute inset-0 z-0"
            onClick={() => setMobileMenuOpen(false)}
          />

          <div className="relative z-10 w-full max-w-lg max-h-[88vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-white/20 bg-[#12131e]/98 p-4 sm:p-6 text-white shadow-[0_25px_70px_rgba(0,0,0,0.95)] backdrop-blur-2xl scrollbar-none animate-in slide-in-from-bottom duration-300">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400">
                  <Sparkles size={18} />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white tracking-tight">Full Toolbar & Studio Options</h2>
                  <p className="text-xs text-white/50">All tools, brushes, paper, and canvas controls</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/70 hover:bg-white/15 hover:text-white transition-all active:scale-95 touch-manipulation"
                aria-label="Close toolbar sheet"
              >
                <X size={18} />
              </button>
            </div>

            {/* SECTION 1: DRAFTING TOOLS GRID */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <span className="anno text-[11px] text-white/50 tracking-wider">Drawing Tools</span>
                <span className="text-[11px] text-indigo-400 font-mono">10 tools</span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {TOOLS.map((t) => {
                  const isActive = selectedTool === t.id && !panMode;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        if (t.id === "image") {
                          selectTool("image");
                          pickImage();
                        } else {
                          selectTool(t.id);
                        }
                      }}
                      className={`flex flex-col items-center justify-center gap-1.5 p-2 rounded-2xl border transition-all touch-manipulation min-h-[64px] ${
                        isActive
                          ? "border-indigo-500/80 bg-indigo-600/30 text-white shadow-[0_0_15px_rgba(99,102,241,0.3)] ring-1 ring-indigo-400"
                          : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      {t.getIcon(20)}
                      <span className="text-[10px] font-medium text-center truncate max-w-full">
                        {t.label}
                      </span>
                    </button>
                  );
                })}
                {/* Pan Tool */}
                <button
                  type="button"
                  onClick={() => setPanMode((m) => !m)}
                  className={`flex flex-col items-center justify-center gap-1.5 p-2 rounded-2xl border transition-all touch-manipulation min-h-[64px] ${
                    panMode
                      ? "border-indigo-500/80 bg-indigo-600/30 text-white shadow-[0_0_15px_rgba(99,102,241,0.3)] ring-1 ring-indigo-400"
                      : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <HandIcon size={20} />
                  <span className="text-[10px] font-medium text-center truncate max-w-full">
                    Hand Pan
                  </span>
                </button>
              </div>
            </div>

            {/* SECTION 2: STROKE WIDTH */}
            <div className="mb-5 rounded-2xl border border-white/10 bg-white/5 p-3.5">
              <div className="flex items-center justify-between mb-2">
                <span className="anno text-[11px] text-white/60">Stroke Thickness</span>
                <span className="font-mono text-xs text-indigo-400 font-bold">{strokeWidth} px</span>
              </div>
              <div className="flex items-center gap-3">
                <div
                  className="rounded-full bg-indigo-400 shrink-0 transition-all"
                  style={{
                    width: `${Math.max(4, Math.min(18, strokeWidth))}px`,
                    height: `${Math.max(4, Math.min(18, strokeWidth))}px`,
                  }}
                />
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={strokeWidth}
                  onChange={(e) => setStrokeWidth(Number(e.target.value))}
                  className="w-full h-2 accent-indigo-500 cursor-pointer rounded-lg touch-manipulation"
                />
              </div>
            </div>

            {/* SECTION 3: INK COLOR PALETTE */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <span className="anno text-[11px] text-white/50">Ink Colour</span>
                <span className="text-[11px] font-mono text-white/40">{selectedColor}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setSelectedColor(c.value)}
                    className={`h-8 w-8 shrink-0 rounded-full border border-white/30 transition-all touch-manipulation flex items-center justify-center ${
                      selectedColor === c.value
                        ? "scale-110 ring-2 ring-indigo-400 ring-offset-2 ring-offset-[#12131e]"
                        : "opacity-80 hover:opacity-100"
                    }`}
                    style={{ backgroundColor: c.value }}
                  >
                    {selectedColor === c.value && (
                      <Check size={14} className={(c.value as string) === "#ffffff" ? "text-black" : "text-white"} />
                    )}
                  </button>
                ))}
                <label
                  title="Custom ink colour"
                  className="relative flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-white/40 transition-transform touch-manipulation"
                  style={{
                    background: "conic-gradient(#e03131, #fcc419, #40c057, #228be6, #e03131)",
                  }}
                >
                  <input
                    type="color"
                    value={selectedColor}
                    onChange={(e) => setSelectedColor(e.target.value)}
                    className="absolute inset-0 cursor-pointer opacity-0"
                  />
                </label>
              </div>
            </div>

            {/* SECTION 4: FONT FAMILY */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <span className="anno text-[11px] text-white/50">Text Typeface</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {FONTS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setSelectedFont(f.value)}
                    style={{ fontFamily: f.value }}
                    className={`px-3 py-2 text-xs rounded-xl border text-center transition-all touch-manipulation ${
                      selectedFont === f.value
                        ? "border-indigo-500 bg-indigo-600/30 text-white font-semibold"
                        : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                    }`}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            </div>

            {/* SECTION 5: PAPER BACKDROP */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <span className="anno text-[11px] text-white/50">Paper Backdrop</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {PAPER_COLORS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setBackgroundColor(p.value)}
                    className={`h-8 px-2.5 rounded-xl border border-white/20 text-xs font-mono transition-all touch-manipulation flex items-center gap-2 ${
                      backgroundColor === p.value
                        ? "border-indigo-400 bg-indigo-500/20 text-white ring-2 ring-indigo-400/50"
                        : "bg-white/5 text-white/70 hover:bg-white/10"
                    }`}
                  >
                    <span className="h-3.5 w-3.5 rounded-md border border-black/20 shrink-0" style={{ backgroundColor: p.value }} />
                    {p.name}
                  </button>
                ))}
                <label
                  title="Custom paper colour"
                  className="relative flex h-8 px-3 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-white/30 bg-white/5 text-xs text-white/80 transition-transform touch-manipulation"
                >
                  Custom
                  <input
                    type="color"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    className="absolute inset-0 cursor-pointer opacity-0"
                  />
                </label>
              </div>
            </div>

            {/* SECTION 6: ACTIONS & NAVIGATION */}
            <div className="border-t border-white/10 pt-4 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                {/* Undo / Redo */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => game?.undo()}
                    disabled={!canUndo}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-xs text-white/80 disabled:opacity-30 touch-manipulation"
                  >
                    <UndoIcon size={15} /> Undo
                  </button>
                  <button
                    type="button"
                    onClick={() => game?.redo()}
                    disabled={!canRedo}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-xs text-white/80 disabled:opacity-30 touch-manipulation"
                  >
                    <RedoIcon size={15} /> Redo
                  </button>
                </div>

                {/* Zoom controls */}
                <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => game?.zoomOut()}
                    className="p-1 text-white/70 hover:text-white touch-manipulation"
                  >
                    <ZoomOutIcon size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => game?.resetZoom()}
                    className="px-1.5 font-mono text-[11px] text-white/80 touch-manipulation"
                  >
                    {zoom}%
                  </button>
                  <button
                    type="button"
                    onClick={() => game?.zoomIn()}
                    className="p-1 text-white/70 hover:text-white touch-manipulation"
                  >
                    <ZoomInIcon size={15} />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    game?.fitView();
                    setMobileMenuOpen(false);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/15 bg-white/10 text-xs font-mono text-white/90 hover:bg-white/15 transition-all touch-manipulation"
                >
                  <FitViewIcon size={15} /> Scroll back to content
                </button>

                <button
                  type="button"
                  onClick={() => {
                    game?.clearBoard();
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-red-500/30 bg-red-500/10 text-xs text-red-400 hover:bg-red-500/20 transition-all touch-manipulation"
                >
                  <TrashIcon size={15} /> Clear
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
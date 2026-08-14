"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { IconButton } from "../components/IconButton";
import {
  ArrowLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Circle,
  Crosshair,
  Eraser,
  Frame,
  Hand,
  Image as ImageIcon,
  MousePointer2,
  Pencil,
  RectangleHorizontal,
  Redo2,
  Trash2,
  Type,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Game, COLORS, DEFAULT_COLOR, DEFAULT_FONT_SIZE, FONTS, DEFAULT_FONT_FAMILY, type Shape } from "../draw/Game";
import { processImageFile } from "../draw/image";

// The note editor is a floating card on the paper: inner padding + hairline
// border around the live text. These mirror the Tailwind classes used below so
// the box can be nudged left/up by exactly the chrome width, keeping the text
// you type anchored to the exact world point where you clicked.
const TEXT_BOX_PAD_X = 14;
const TEXT_BOX_PAD_Y = 10;
const TEXT_BOX_BORDER = 1;

// Paper tones offered for the canvas backdrop (the "paper" on the desk).
const PAPER_COLORS = [
  { name: "paper", value: "#f8f6f1" },
  { name: "white", value: "#ffffff" },
  { name: "mist", value: "#dce4ee" },
  { name: "sand", value: "#efe2cd" },
  { name: "sage", value: "#e3ead9" },
  { name: "graphite", value: "#232329" },
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
  const [zoom, setZoom] = useState(100);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [game, setGame] = useState<Game>();

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
  // When the editor is rewriting an existing note, its shape id lives here so
  // the commit updates that shape instead of stacking a second copy.
  const editingTextIdRef = useRef<string | null>(null);
  // True right after a commit so the very next canvas click (which is what
  // triggered that commit) doesn't immediately pop a fresh empty editor open.
  const suppressTextStartRef = useRef(false);

  const goBack = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx;
    if (typeof idx === "number" && idx > 0) {
      router.back();
    } else {
      router.push("/");
    }
  };

  // Flush the note editor into a shared shape (idempotent: clears the live
  // draft reference first so blur + click double-fires only ever commit once).
  // Returns true when an open draft was actually committed, so callers that
  // need to know (e.g. a canvas click that just finished a note) can react.
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

  // Grow the card to fit the note (both directions), never smaller than a
  // comfortable empty slot. scrollWidth/scrollHeight include the padding, so
  // only the hairline border needs adding on top of each dimension.
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
      // Drop the image at the centre of the current view, then hand over to
      // the pointer tool so it can be dragged around or resized immediately.
      gameRef.current.insertImage(dataUrl);
      selectTool("select");
    } catch (err) {
      console.error("Failed to load image:", err);
    }
  };

  const handleStartText = useCallback(
    (x: number, y: number) => {
      // A click that just committed the previous note shouldn't instantly
      // spawn a fresh empty editor at the same cursor position.
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

  // The text tool clicked an existing note: re-open it in place, pre-filled,
  // and pick up its ink colour and typeface so what you see matches what you're
  // editing.
  const handleEditText = useCallback((shape: Shape) => {
    if (shape.type !== "text") return;
    commitTextDraft();
    editingTextIdRef.current = shape.id;
    setSelectedColor(shape.color);
    setSelectedFont(shape.fontFamily || DEFAULT_FONT_FAMILY);
    setTextDraft({ x: shape.x, y: shape.y });
    setTextValue(shape.text);
  }, [commitTextDraft]);

  // Committed via a canvas click (mousedown on the paper). Only the click that
  // placed the note should be suppressed so it doesn't pop a fresh editor open;
  // Escape/Enter/blur commits must not leave a stale suppression behind.
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
        // Place the caret at the end (Excalidraw-style) so typing appends
        // to an existing note instead of inserting at the start.
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

  // Background the room settled on. Tracks the last value we broadcast so a
  // change that arrived from someone else isn't echoed straight back to the
  // server (and every other client) as if we'd picked it ourselves.
  const lastSentBackgroundRef = useRef<string | null>(DEFAULT_PAPER);

  const handleBackgroundChange = useCallback((color: string) => {
    lastSentBackgroundRef.current = color;
    setBackgroundColor(color);
  }, []);

  // Drives the enabled state of the undo/redo buttons when history changes.
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

          {/* in-place note editor for the text tool — a floating card that
              hugs the note and grows with the typing (Excalidraw-style) */}
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
              className="absolute z-30 max-h-[80vh] resize-none overflow-hidden select-text whitespace-pre rounded-lg border border-marker/40 bg-white/95 shadow-[0_1px_3px_rgba(24,24,26,0.14),0_12px_28px_-8px_rgba(24,24,26,0.3)] outline-none placeholder:text-inkfaint/70"
              style={{
                // Nudge the card up/left by its own chrome (padding + border)
                // so the text starts exactly at the world-space note point.
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

        {/* drafting ruler toolbar — collapsible so the paper stays unobstructed */}
        {toolbarOpen ? (
        <div className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-2xl border border-white/10 bg-[#1c1c24]/90 p-1.5 pl-3 shadow-[0_16px_40px_-16px_rgba(0,0,0,0.9)] backdrop-blur-md">
          <span className="anno mr-2 inline-flex items-center gap-1 border-r border-white/10 pr-3 text-paper/40">
            tools
          </span>
          <IconButton
            tone="dark"
            activated={selectedTool === "select"}
            icon={<MousePointer2 size={18} />}
            label="Pointer · select (V)"
            onClick={() => selectTool("select")}
          />
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
            activated={selectedTool === "arrow"}
            icon={<ArrowUpRight size={18} />}
            label="Arrow (A)"
            onClick={() => selectTool("arrow")}
          />
          <IconButton
            tone="dark"
            activated={selectedTool === "text"}
            icon={<Type size={18} />}
            label="Text (T)"
            onClick={() => selectTool("text")}
          />
          <IconButton
            tone="dark"
            activated={selectedTool === "image"}
            icon={<ImageIcon size={18} />}
            label="Image (I)"
            onClick={() => {
              selectTool("image");
              pickImage();
            }}
          />
          <IconButton
            tone="dark"
            activated={selectedTool === "eraser"}
            icon={<Eraser size={18} />}
            label="Eraser (E)"
            onClick={() => selectTool("eraser")}
          />
          <IconButton
            tone="dark"
            activated={selectedTool === "laser"}
            icon={<Crosshair size={18} />}
            label="Laser pointer (G)"
            onClick={() => selectTool("laser")}
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
            {/* custom tool colour picker */}
            <label
              title="Custom tool colour"
              className="relative flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-md border border-white/30 transition-transform duration-150 hover:scale-110"
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
          <span className="mx-1.5 h-6 w-px bg-white/10" />

          {/* typeface for the text tool — only relevant while the text tool is active */}
          {selectedTool === "text" && (
            <>
              <span className="mx-1.5 h-6 w-px bg-white/10" />
              <select
                value={selectedFont}
                onChange={(e) => setSelectedFont(e.target.value)}
                aria-label="Text font"
                title="Text font"
                style={{ fontFamily: selectedFont }}
                className="h-10 cursor-pointer rounded-lg border border-white/10 bg-[#141419]/95 px-2 text-sm text-paper outline-none transition-colors hover:bg-[#1c1c24] focus-visible:border-marker/60"
              >
                {FONTS.map((f) => (
                  <option key={f.id} value={f.value} style={{ fontFamily: f.value }}>
                    {f.name}
                  </option>
                ))}
              </select>
            </>
          )}

          {/* stroke width */}
          <span className="anno ml-2 border-l border-white/10 pl-3 text-paper/40">
            width
          </span>
          <div className="flex items-center gap-2 px-2">
            <input
              type="range"
              min="1"
              max="20"
              value={strokeWidth}
              onChange={(e) => setStrokeWidth(Number(e.target.value))}
              className="w-24 h-2 accent-marker cursor-pointer"
              aria-label="Stroke width"
              title={`Stroke width: ${strokeWidth}`}
            />
            <span className="anno w-6 text-right text-paper/60">{strokeWidth}</span>
          </div>
          <span className="mx-1.5 h-6 w-px bg-white/10" />

          {/* paper (canvas background) tones */}
          <span className="anno ml-2 border-l border-white/10 pl-3 text-paper/40">
            paper
          </span>
          <div className="flex items-center gap-1.5 px-1">
            {PAPER_COLORS.map((p) => (
              <button
                key={p.value}
                type="button"
                aria-label={`${p.name} paper`}
                aria-pressed={backgroundColor === p.value}
                title={`${p.name} paper`}
                onClick={() => setBackgroundColor(p.value)}
                className={`h-5 w-5 shrink-0 cursor-pointer rounded-md border border-white/30 transition-transform duration-150 hover:scale-110 ${
                  backgroundColor === p.value
                    ? "scale-110 ring-2 ring-white ring-offset-2 ring-offset-[#1c1c24]"
                    : ""
                }`}
                style={{ backgroundColor: p.value }}
              />
            ))}
            <label
              title="Custom paper colour"
              className="relative flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-md border border-white/30 transition-transform duration-150 hover:scale-110"
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
          <span className="mx-1.5 h-6 w-px bg-white/10" />
          <IconButton
            tone="dark"
            activated={false}
            icon={<Trash2 size={18} />}
            label="Clear entire board"
            onClick={() => game?.clearBoard()}
          />
          <span className="mx-1.5 h-6 w-px bg-white/10" />
          <IconButton
            tone="dark"
            activated={false}
            icon={<ChevronDown size={18} />}
            label="Collapse toolbar"
            onClick={() => setToolbarOpen(false)}
          />
        </div>
      ) : (
        /* collapsed: a single pill that re-opens the drafting ruler */
        <button
          type="button"
          aria-label="Expand toolbar"
          title="Expand toolbar"
          onClick={() => setToolbarOpen(true)}
          className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 cursor-pointer items-center gap-2 rounded-full border border-white/10 bg-[#1c1c24]/90 px-4 py-2.5 text-paper/70 shadow-[0_16px_40px_-16px_rgba(0,0,0,0.9)] backdrop-blur-md transition-colors hover:bg-[#141419] hover:text-paper"
        >
          <ChevronUp size={16} />
          <span className="anno text-paper/50">drafting tools</span>
        </button>
      )}

        {/* tool hint */}
        <div className="absolute bottom-6 right-5 hidden sm:block">
          <span className="anno text-paper/35">
            {panMode && "h — hand / pan"}
            {!panMode && selectedTool === "select" && "v — pointer / select"}
            {!panMode && selectedTool === "pencil" && "p — freehand stroke"}
            {!panMode && selectedTool === "rect" && "r — bounding box"}
            {!panMode && selectedTool === "circle" && "c — circumscribe"}
            {!panMode && selectedTool === "arrow" && "a — pointer arrow"}
            {!panMode && selectedTool === "text" && "t — click, type, Enter to place"}
            {!panMode && selectedTool === "image" && "i — pick a file to embed"}
            {!panMode && selectedTool === "eraser" && "e — erase a stroke"}
            {!panMode && selectedTool === "laser" && "g — point, leave a fading trail"}
          </span>
          <span className="anno ml-3 text-paper/25">1–9 ink · space pan · ⌃+scroll zoom</span>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFile}
        />
      </div>

      {/* footer — drafting plate along the table */}
      <footer className="relative z-10 flex items-center justify-between gap-4 border-t border-white/10 px-5 py-2.5 sm:px-6">
        <div className="flex items-center gap-3">
          <span ref={coordsRef} className="anno w-32 text-paper/40">
            x 0 · y 0
          </span>
          <span className="h-4 w-px bg-white/10" />
          <div className="flex items-center rounded-lg border border-white/10 bg-white/5 p-0.5">
            <button
              type="button"
              aria-label="Undo last change"
              title="Undo (Ctrl+Z)"
              onClick={() => game?.undo()}
              disabled={!canUndo}
              className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-paper/60 transition-colors hover:bg-white/10 hover:text-paper disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-paper/60"
            >
              <Undo2 size={13} />
            </button>
            <button
              type="button"
              aria-label="Redo last change"
              title="Redo (Ctrl+Shift+Z)"
              onClick={() => game?.redo()}
              disabled={!canRedo}
              className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-paper/60 transition-colors hover:bg-white/10 hover:text-paper disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-paper/60"
            >
              <Redo2 size={13} />
            </button>
          </div>
          <div className="flex items-center rounded-lg border border-white/10 bg-white/5 p-0.5">
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
              aria-label="Scroll back to content"
              title="Scroll back to content"
              onClick={() => game?.fitView()}
              className="mx-0.5 flex h-6 cursor-pointer items-center gap-1.5 rounded-md border-l border-white/10 px-2 text-paper/70 transition-colors hover:bg-white/10 hover:text-paper"
            >
              <Frame size={13} />
              <span className="hidden text-[11px] font-medium sm:inline">Scroll back to content</span>
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

export type Tool = "pencil" | "rect" | "circle" | "arrow" | "text" | "image" | "select" | "eraser" | "laser";
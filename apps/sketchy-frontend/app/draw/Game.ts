import { Tool } from "../components/Canvas";
import { getExistingShapes } from "./http";
import { getUserIdFromToken } from "../lib/auth";

export type Shape =
  | {
      id: string;
      userId?: string;
      type: "rect";
      x: number;
      y: number;
      width: number;
      height: number;
      color: string;
      strokeWidth: number;
    }
  | {
      id: string;
      userId?: string;
      type: "circle";
      centerX: number;
      centerY: number;
      radius: number;
      color: string;
      strokeWidth: number;
    }
  | {
      id: string;
      userId?: string;
      type: "pencil";
      points: { x: number; y: number }[];
      color: string;
      strokeWidth: number;
    }
  | {
      id: string;
      userId?: string;
      type: "arrow";
      startX: number;
      startY: number;
      endX: number;
      endY: number;
      color: string;
      strokeWidth: number;
    }
  | {
      id: string;
      userId?: string;
      type: "text";
      x: number;
      y: number;
      text: string;
      fontSize: number;
      color: string;
      fontFamily: string;
      strokeWidth: number;
    }
  | {
      id: string;
      userId?: string;
      type: "laser";
      points: { x: number; y: number; t: number }[];
      color: string;
      strokeWidth: number;
    }
  | {
      id: string;
      userId?: string;
      type: "image";
      x: number;
      y: number;
      width: number;
      height: number;
      dataUrl: string;
    };

// Draftsman's ink palette — ordered like Excalidraw's number-key swatches.
export const COLORS = [
  { name: "black", value: "#1e1e1e" },
  { name: "red", value: "#e03131" },
  { name: "orange", value: "#e8590c" },
  { name: "gold", value: "#fcc419" },
  { name: "green", value: "#40c057" },
  { name: "teal", value: "#12b886" },
  { name: "blue", value: "#228be6" },
  { name: "violet", value: "#6741d9" },
  { name: "magenta", value: "#e64980" },
] as const;

export const DEFAULT_COLOR = COLORS[0].value;
export const DEFAULT_FONT_SIZE = 22;

export const FONT_FAMILY = "ui-sans-serif, system-ui, sans-serif";

// Typefaces offered to the text tool. Each maps to a font loaded on the page
// (via the Google Fonts stylesheet in layout.tsx), so canvas rendering can use
// the family by name. The first entry doubles as the default.
export const FONTS = [
  { id: "sans", name: "Sans", value: FONT_FAMILY },
  { id: "marker", name: "Marker", value: '"Caveat", "Comic Sans MS", cursive' },
  { id: "mono", name: "Mono", value: '"IBM Plex Mono", ui-monospace, monospace' },
  { id: "serif", name: "Serif", value: '"Playfair Display", Georgia, serif' },
  { id: "display", name: "Display", value: '"Bebas Neue", "Arial Narrow", sans-serif' },
  { id: "comic", name: "Comic", value: '"Comic Neue", "Comic Sans MS", cursive' },
] as const;

export const DEFAULT_FONT_FAMILY = FONT_FAMILY;
const TEXT_LINE_HEIGHT = 1.3;
// Default artboard footprint for an image dropped without a drag gesture.
const IMAGE_DEFAULT_WIDTH = 200;
const MIN_SHAPE_DIM = 4;
const HANDLE_SIZE = 8;
const HANDLE_HIT = 8;
// Resize moves the tracked edge a fraction of the cursor's drag, so small hand
// movements produce small, controllable growth. Lower = slower/calmer.
const RESIZE_SENSITIVITY = 0.6;
// Extra dampening on top for text, because a single unit of type size is a big
// visual step — the effective text sensitivity is (0.5 × 0.5).
const TEXT_RESIZE_DAMP = 0.7;
// Screen-space distance (px) a drag must travel before it "engages". Tuning
// this keeps a click-to-select from jittering the shape by the tiniest wiggle.
const CLICK_DRAG_THRESHOLD = 4;
// Width of the grab band (screen px) around the selection box border where a
// press starts resizing. Kept thin so grabbing the shape's body moves it and
// only a reach for the border (or the handles themselves) resizes it.
const RESIZE_BAND = 4;
// CSS cursor per resize handle, matching the direction of stretch.
const CURSOR_RESIZE: Record<string, string> = {
  nw: "nwse-resize",
  se: "nwse-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
};

// Laser pointer: fires on press-and-drag, leaving a beam of light — a soft
// bloom under a tapering core that fades along its own length, ending in a
// white-hot tip. Age (ms) controls how long the beam lingers after release.
const LASER_AGE_MS = 450;
const LASER_MAX_DOTS = 320;
const LASER_INTERP_STEP = 3; // screen px between interpolated trail points

// View state for the infinite drafting table: zoom + world-space pan offset.
export interface ViewState {
  zoom: number;
  offsetX: number;
  offsetY: number;
}

interface RemoteCursor {
  name: string;
  x: number | null;
  y: number | null;
}

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// Undo/redo: one entry per local user action, expressed as an invertible delta
// that is replayed through the same socket messages the original action used,
// so the canvas, the server's persistence and every peer stay in agreement.
type HistoryEntry =
  | { kind: "add"; shape: Shape }
  | { kind: "remove"; shape: Shape }
  | { kind: "update"; before: Shape; after: Shape }
  | { kind: "clear"; before: Shape[] };

// Cap history so a board of heavy strokes (or a burst of clears) can't grow the
// stack without bound — memory-cheap deltas, but a clear keeps a full snapshot.
const HISTORY_LIMIT = 50;

// One fading dot in a laser trail (world coords + birth time).
interface LaserPoint {
  x: number;
  y: number;
  t: number;
}

type HandleKey = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;
const ZOOM_FACTOR = 1.08;
const GRID_STEP = 48;
// The drawing board is a giant but finite sheet — panning stops at these edges.
const WORLD_LIMIT = 10000;

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private existingShapes: Shape[];
  private roomId: string;
  private socket: WebSocket;
  private userId: string | null = null;
  private clicked: boolean;
  private startX = 0;
  private startY = 0;
  private points: { x: number; y: number }[] = [];
  private selectedTool: Tool = "circle";
  private strokeColor: string = DEFAULT_COLOR;
  private strokeWidth: number = 2;
  private fontFamily: string = FONT_FAMILY;
  private backgroundColor = "#f8f6f1";
  private scale = 1;

  // Infinite-workspace view: screen = (world − offset) · zoom
  private offsetX = 0;
  private offsetY = 0;
  private zoom = 1;

  private panning = false;
  private panTool = false;
  private spaceDown = false;
  private panLastX = 0;
  private panLastY = 0;

  // Touch state tracking for mobile drawing, pinch zoom, and 2-finger pan
  private touchStartDist = 0;
  private touchStartZoom = 1;
  private touchStartMid = { x: 0, y: 0 };
  private touchLastMid = { x: 0, y: 0 };
  private isPinching = false;
  private lastTouchClient = { x: 0, y: 0 };

  // Presence: everyone else's cursors, keyed by userId, with their name.
  private remoteCursors = new Map<string, RemoteCursor>();
  private lastPointerSent = 0;

  // Laser pointer: our own beam + the freshest point, and one trail per remote
  // user actively lasing. Beams only exist while the button is held — releasing
  // lets the current beam fade out. Trails are ephemeral (never shapes).
  private laserTrail: LaserPoint[] = [];
  private laserLatest: { x: number; y: number } | null = null;
  private lasing = false;
  private remoteLasers = new Map<string, LaserPoint[]>();
  // Ink colour each remote user last lased with, so their beam matches their
  // palette choice (falls back to their presence colour when unknown).
  private remoteLaserColors = new Map<string, string>();
  private laserAnimFrame: number | null = null;

  // Eraser: id of the shape currently under the cursor, if any.
  private hoveredShapeId: string | null = null;
  // Which resize handle sits under the cursor (selection affordance feedback).
  private hoveredResizeHandle: HandleKey | null = null;

  // Selection for pointer mode: which shape is grabbed + what drag is happening.
  private selectedShapeId: string | null = null;
  // Client-space coordinates of the press that started a drag, plus whether
  // the cursor has travelled far enough for the drag to "engage".
  private dragStartClient = { x: 0, y: 0 };
  private dragEngaged = false;
  private moveDrag: {
    shape: Shape;
    start: { x: number; y: number };
    // Snapshot of the shape at press, so a finished move can be undone (and
    // redone) back to exactly where it started.
    before: Shape;
  } | null = null;
  private resizeDrag: {
    shape: Shape;
    origBounds: Bounds;
    // Snapshot of the shape at press, so every frame's resize math anchors to
    // the ORIGINAL value. Scaling the already-mutated shape each frame makes
    // circle/arrow/text growth compound exponentially (a few pixels of drag
    // balloon the element) — the "far too sensitive" text resize.
    origShape: Shape;
    handle: HandleKey;
    // World-space point where the press started, so the shape tracks the drag
    // delta 1:1 instead of snapping its edge onto the cursor's absolute spot.
    origin: { x: number; y: number };
  } | null = null;
  private bandSelect: { start: { x: number; y: number } } | null = null;
  private bandCurrent: { x: number; y: number } | null = null;
  private imagePlacementCount = 0;
  // Coalesces repaints so a burst of mousemove events doesn't redraw the whole
  // board every single event — the root cause of laggy move/resize drags.
  private redrawQueued = false;

  // Layered renderer (Excalidraw-style): the static board lives in an offscreen
  // scene canvas, remote cursors in a cheap overlay, and the main canvas is a
  // composite blit plus, during a move/resize drag, just the one shape being
  // dragged on top. So drag frames cost almost nothing regardless of how much
  // ink is on the paper.
  private sceneCanvas: HTMLCanvasElement | null = null;
  private sceneCtx: CanvasRenderingContext2D | null = null;
  private cursorCanvas: HTMLCanvasElement | null = null;
  private cursorCtx: CanvasRenderingContext2D | null = null;
  private sceneStale = true;
  private cursorQueued = false;
  private dragFrameQueued = false;

  private imageCache = new Map<string, HTMLImageElement>();

  private onViewChange: ((view: ViewState) => void) | null;
  private onStartText: ((x: number, y: number) => void) | null;
  private onEditText: ((shape: Shape) => void) | null;
  private onPreMouseDown: (() => boolean | void) | null;
  private onBackgroundChange: ((color: string) => void) | null;
  private onHistoryChange: ((canUndo: boolean, canRedo: boolean) => void) | null;
  private onPresenceChange: ((count: number) => void) | null;

  // Undo/redo stacks. Only local actions are recorded — remote room updates
  // arrive through the socket and are not part of your personal history.
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];

  constructor(
    canvas: HTMLCanvasElement,
    roomId: string,
    socket: WebSocket,
    opts: {
      onViewChange?: (view: ViewState) => void;
      onStartText?: (x: number, y: number) => void;
      onEditText?: (shape: Shape) => void;
      onPreMouseDown?: () => boolean | void;
      onBackgroundChange?: (color: string) => void;
      onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void;
      onPresenceChange?: (count: number) => void;
    } = {}
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.existingShapes = [];
    this.roomId = roomId;
    this.socket = socket;
    this.userId = getUserIdFromToken();
    this.clicked = false;
    this.onViewChange = opts.onViewChange ?? null;
    this.onStartText = opts.onStartText ?? null;
    this.onEditText = opts.onEditText ?? null;
    this.onPreMouseDown = opts.onPreMouseDown ?? null;
    this.onBackgroundChange = opts.onBackgroundChange ?? null;
    this.onHistoryChange = opts.onHistoryChange ?? null;
    this.onPresenceChange = opts.onPresenceChange ?? null;
    this.configureCanvas();
    this.initHandlers();
    this.initMouseHandlers();
    // Paint the empty board synchronously so the canvas is visible immediately,
    // long before the network round-trip for existing shapes resolves.
    this.clearCanvas();
    this.init().catch((err) => console.error("init() failed:", err));
    // The Google Fonts stylesheet loads typefaces after this module. Once they
    // are in, re-render so webfont text (which may have painted in its fallback
    // face) settles into its true typeface.
    if (typeof document !== "undefined" && "fonts" in document) {
      document.fonts.ready.then(() => this.clearCanvas());
    }
  }

  setTool(tool: Tool) {
    const wasLaser = this.selectedTool === "laser";
    this.selectedTool = tool;
    this.dragEngaged = false;
    this.hoveredResizeHandle = null;
    // Leaving the laser tool clears its ephemeral trail and repaints the
    // presence layer — the tail is only meant to glow while the beam is active.
    if (wasLaser && tool !== "laser") {
      this.lasing = false;
      this.laserTrail = [];
      this.laserLatest = null;
      if (this.laserAnimFrame !== null) {
        cancelAnimationFrame(this.laserAnimFrame);
        this.laserAnimFrame = null;
      }
      this.clearCanvas();
    }
    if (tool !== "eraser" && this.hoveredShapeId !== null) {
      this.hoveredShapeId = null;
      this.clearCanvas();
    }
    this.updateCursor();
  }

  setColor(color: string) {
    this.strokeColor = color;
  }

  // Remembered so freshly committed notes keep the font chosen in the toolbar;
  // existing shapes render with the family stored on each shape.
  setFontFamily(fontFamily: string) {
    this.fontFamily = fontFamily;
  }

  setStrokeWidth(width: number) {
    this.strokeWidth = Math.max(1, Math.min(20, width));
    this.clearCanvas();
  }

  setBackgroundColor(color: string) {
    if (this.backgroundColor === color) return;
    this.backgroundColor = color;
    this.clearCanvas();
  }

  setPanMode(on: boolean) {
    this.panTool = on;
    this.updateCursor();
  }

  getZoom() {
    return this.zoom;
  }

  // Map a world-space point to its pixel position inside the canvas element.
  worldToScreen(worldX: number, worldY: number) {
    return {
      x: (worldX - this.offsetX) * this.zoom,
      y: (worldY - this.offsetY) * this.zoom,
    };
  }

  // Image tool: drop a freshly picked file onto the centre of the current
  // view at a comfortable on-screen size, ready to move or resize.
  insertImage(dataUrl: string) {
    const width = IMAGE_DEFAULT_WIDTH / this.zoom;
    const cw = this.canvas.clientWidth || 1;
    const ch = this.canvas.clientHeight || 1;
    // Cascade successive drops so fresh imports never stack exactly on top of
    // the previous one.
    const nudge = (this.imagePlacementCount * 18) / this.zoom;
    this.imagePlacementCount = (this.imagePlacementCount + 1) % 12;
    const cx = this.offsetX + cw / 2 / this.zoom + nudge;
    const cy = this.offsetY + ch / 2 / this.zoom + nudge;

    const place = (img: HTMLImageElement) => {
      const ar = img.naturalWidth / Math.max(1, img.naturalHeight);
      const height = width / ar;
      const shape: Shape = {
        id: newShapeId(),
        userId: this.userId || undefined,
        type: "image",
        x: cx - width / 2,
        y: cy - height / 2,
        width,
        height,
        dataUrl,
      };
      this.existingShapes.push(shape);
      this.recordHistory({ kind: "add", shape });
      this.selectedShapeId = shape.id;
      this.clearCanvas();
      this.socket.send(
        JSON.stringify({ type: "shape", shape, roomId: this.roomId })
      );
    };

    const cached = this.imageCache.get(dataUrl);
    if (cached && cached.naturalWidth > 0) {
      place(cached);
      return;
    }
    const img = new Image();
    img.onload = () => place(img);
    img.onerror = () => console.error("Failed to decode image");
    img.src = dataUrl;
    this.imageCache.set(dataUrl, img);
  }

  // Text tool: commit a finished editor buffer as a brand-new text shape and
  // select it, so the freshly placed note shows its bounds handles at once.
  commitText(
    x: number,
    y: number,
    text: string,
    fontSize: number,
    color: string,
    fontFamily: string = FONT_FAMILY
  ) {
    const trimmed = text.trim();
    if (trimmed.length === 0) return;
    const shape: Shape = {
      id: newShapeId(),
      userId: this.userId || undefined,
      type: "text",
      x,
      y,
      text,
      fontSize,
      color,
      fontFamily,
      strokeWidth: this.strokeWidth,
    };
    this.selectedShapeId = shape.id;
    this.addShape(shape);
  }

  // Text tool: commit an in-place edit of an existing text shape (keeps its id
  // so erasing, selection and live room updates all agree on the same shape).
  commitTextEdit(
    id: string,
    x: number,
    y: number,
    text: string,
    fontSize: number,
    color: string,
    fontFamily: string = FONT_FAMILY
  ) {
    const target = this.existingShapes.find((s) => s.id === id);
    if (!target || target.type !== "text") return;
    const trimmed = text.trim();
    if (trimmed.length === 0) return;
    const updated: Shape = { ...target, x, y, text, fontSize, color, fontFamily, strokeWidth: this.strokeWidth };
    const idx = this.existingShapes.findIndex((s) => s.id === id);
    this.existingShapes[idx] = updated;
    this.recordHistory({ kind: "update", before: target, after: updated });
    this.selectedShapeId = id;
    this.clearCanvas();
    this.socket.send(
      JSON.stringify({ type: "update", shape: updated, roomId: this.roomId })
    );
  }

  zoomIn() {
    this.applyZoom(this.zoom * ZOOM_FACTOR, canvasCenter(this.canvas));
  }

  zoomOut() {
    this.applyZoom(this.zoom / ZOOM_FACTOR, canvasCenter(this.canvas));
  }

  resetZoom() {
    this.applyZoom(1, canvasCenter(this.canvas));
  }

  private getCanvasSize(): { cw: number; ch: number } {
    const rect = this.canvas?.getBoundingClientRect();
    const cw = rect?.width || this.canvas?.clientWidth || (typeof window !== "undefined" ? window.innerWidth : 800) || 800;
    const ch = rect?.height || this.canvas?.clientHeight || (typeof window !== "undefined" ? window.innerHeight : 600) || 600;
    return { cw, ch };
  }

  // Bring the whole board back into view: centre on everything that's been
  // drawn and zoom so it all fits on the desk.
  fitView() {
    const { cw, ch } = this.getCanvasSize();
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const s of this.existingShapes) {
      const b = this.shapeBounds(s);
      minX = Math.min(minX, b.minX);
      minY = Math.min(minY, b.minY);
      maxX = Math.max(maxX, b.maxX);
      maxY = Math.max(maxY, b.maxY);
    }
    if (this.existingShapes.length === 0 || !isFinite(minX) || !isFinite(minY)) {
      this.zoom = 1;
      this.offsetX = -cw / 2;
      this.offsetY = -ch / 2;
    } else {
      const margin = 80;
      const contentW = Math.max(20, maxX - minX);
      const contentH = Math.max(20, maxY - minY);
      const fitZoom = Math.min(
        (cw - margin * 2) / contentW,
        (ch - margin * 2) / contentH
      );
      this.zoom = Math.min(1.2, Math.max(MIN_ZOOM, fitZoom));
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      this.offsetX = centerX - cw / (2 * this.zoom);
      this.offsetY = centerY - ch / (2 * this.zoom);
    }
    this.clampView();
    this.clearCanvas();
    this.emitView();
  }

  private applyZoom(newZoom: number, anchor: { x: number; y: number }) {
    newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, newZoom));
    const worldX = anchor.x / this.zoom + this.offsetX;
    const worldY = anchor.y / this.zoom + this.offsetY;
    this.zoom = newZoom;
    this.offsetX = worldX - anchor.x / newZoom;
    this.offsetY = worldY - anchor.y / newZoom;
    this.clampView();
    this.clearCanvas();
    this.emitView();
  }

  // Keep the visible window inside the finite board's edges.
  private clampView() {
    const { cw, ch } = this.getCanvasSize();
    const halfW = cw / (2 * this.zoom);
    const halfH = ch / (2 * this.zoom);
    const minX = -WORLD_LIMIT + halfW;
    const maxX = WORLD_LIMIT - halfW;
    const minY = -WORLD_LIMIT + halfH;
    const maxY = WORLD_LIMIT - halfH;
    if (minX < maxX) this.offsetX = Math.min(maxX, Math.max(minX, this.offsetX));
    if (minY < maxY) this.offsetY = Math.min(maxY, Math.max(minY, this.offsetY));
  }

  // Map viewport client coords to world-space (paper) coords.
  // The context already has a DPR transform, so we must NOT multiply by it here.
  private mapToCanvas(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    return { x: sx / this.zoom + this.offsetX, y: sy / this.zoom + this.offsetY };
  }

  private configureCanvas() {
    this.scale = window.devicePixelRatio || 1;
    const width = this.canvas.clientWidth || this.canvas.width;
    const height = this.canvas.clientHeight || this.canvas.height;
    this.canvas.width = Math.round(width * this.scale);
    this.canvas.height = Math.round(height * this.scale);
    this.ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);

    this.observeResize();
  }

  private ro: ResizeObserver | null = null;

  private observeResize() {
    if (typeof ResizeObserver === "undefined") return;
    this.ro = new ResizeObserver(() => {
      const width = this.canvas.clientWidth;
      const height = this.canvas.clientHeight;
      if (!width || !height) return;
      this.canvas.width = Math.round(width * this.scale);
      this.canvas.height = Math.round(height * this.scale);
      this.ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
      this.clearCanvas();
    });
    this.ro.observe(this.canvas);
  }

  async init() {
    const data = await getExistingShapes(this.roomId);
    this.existingShapes = data.shapes;
    // Undo/redo history is personal and session-scoped: a freshly loaded board
    // (or a brand-new room) starts with a clean slate.
    this.undoStack = [];
    this.redoStack = [];
    this.emitHistory();
    // Start on the room's shared paper tone (already persisted on the server).
    if (data.backgroundColor && data.backgroundColor !== this.backgroundColor) {
      this.backgroundColor = data.backgroundColor;
      this.onBackgroundChange?.(data.backgroundColor);
    }
    this.clearCanvas();
    // Land the camera on the existing ink, like a real drafting room.
    this.fitView();
  }

  destroy() {
    if (this.laserAnimFrame !== null) {
      cancelAnimationFrame(this.laserAnimFrame);
      this.laserAnimFrame = null;
    }
    this.canvas?.removeEventListener("mousedown", this.mouseDownHandler);
    this.canvas?.removeEventListener("touchstart", this.touchStartHandler);
    this.canvas?.removeEventListener("touchmove", this.touchMoveHandler);
    this.canvas?.removeEventListener("touchend", this.touchEndHandler);
    this.canvas?.removeEventListener("touchcancel", this.touchEndHandler);
    this.canvas?.removeEventListener("wheel", this.wheelHandler);
    this.canvas?.removeEventListener("mouseleave", this.mouseLeaveHandler);
    window.removeEventListener("mousemove", this.mouseMoveHandler);
    window.removeEventListener("mouseup", this.mouseUpHandler);
    window.removeEventListener("keydown", this.spaceDownHandler);
    window.removeEventListener("keyup", this.spaceUpHandler);
    window.removeEventListener("blur", this.resetModifiers);
    this.ro?.disconnect();
  }

  private emitView() {
    this.onViewChange?.({ zoom: this.zoom, offsetX: this.offsetX, offsetY: this.offsetY });
  }

  initHandlers() {
    this.socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "self" && typeof message.userId === "string") {
        this.userId = message.userId;
      } else if (message.type === "shape" && message.shape) {
        this.upsertShape(message.shape);
        this.scheduleRedraw();
      } else if (message.type === "update" && message.shape) {
        // Our own drag broadcasts these every ~60ms and the server echoes them
        // back. Replacing the shape under an in-flight drag would leave the
        // drag mutating a stale copy, so the shape visibly jumps/trails behind
        // the cursor. Ignore the echo of the very shape we're dragging.
        if (message.shape.id === this.activeDrag()?.shape.id) return;
        // A room-mate dragged a shape; refresh it in place by id.
        this.upsertShape(message.shape);
        this.scheduleRedraw();
      } else if (message.type === "clear") {
        this.existingShapes = [];
        this.selectedShapeId = null;
        this.scheduleRedraw();
      } else if (message.type === "erase" && message.shapeId) {
        this.existingShapes = this.existingShapes.filter(
          (s) => s.id !== message.shapeId
        );
        if (this.hoveredShapeId === message.shapeId) {
          this.hoveredShapeId = null;
        }
        if (this.selectedShapeId === message.shapeId) {
          this.selectedShapeId = null;
        }
        this.scheduleRedraw();
      } else if (message.type === "pointer") {
        this.remoteCursors.set(message.userId, {
          name: message.name,
          x: message.x,
          y: message.y,
        });
        if (message.laser) {
          const trail = this.remoteLasers.get(message.userId) ?? [];
          const last = trail[trail.length - 1];
          const t = Date.now();
          if (last) {
            this.fillBetween(trail, last, { x: message.x, y: message.y }, 4, t);
          } else {
            trail.push({ x: message.x, y: message.y, t });
          }
          if (trail.length > LASER_MAX_DOTS) {
            trail.splice(0, trail.length - LASER_MAX_DOTS);
          }
          this.remoteLasers.set(message.userId, trail);
          if (typeof message.color === "string" && message.color.length > 0) {
            this.remoteLaserColors.set(message.userId, message.color);
          }
          this.ensureLaserLoop();
        }
        this.scheduleCursorRedraw();
      } else if (message.type === "background" && typeof message.backgroundColor === "string") {
        this.setBackgroundColor(message.backgroundColor);
        this.onBackgroundChange?.(message.backgroundColor);
      } else if (message.type === "presence_members") {
        (message.members || []).forEach((m: { userId: string; name: string; x: number | null; y: number | null }) => {
          this.setRemoteCursor(m.userId, m.name, m.x, m.y);
        });
        this.scheduleCursorRedraw();
        this.notifyPresenceCount();
      } else if (message.type === "presence_enter") {
        this.setRemoteCursor(message.userId, message.name, message.x, message.y);
        this.scheduleCursorRedraw();
        this.notifyPresenceCount();
      } else if (message.type === "presence_leave") {
        this.remoteCursors.delete(message.userId);
        this.scheduleCursorRedraw();
        this.notifyPresenceCount();
      }
    };
  }

  // Add when unseen, replace when known — so server echoes, room updates and
  // local commits never fabricate a second copy of the same shape.
  private upsertShape(shape: Shape) {
    const idx = this.existingShapes.findIndex((s) => s.id === shape.id);
    if (idx >= 0) {
      this.existingShapes[idx] = shape;
    } else {
      this.existingShapes.push(shape);
    }
  }

  // Merge instead of overwrite so a roster refresh never blanks a cursor we
  // already have a live position for.
  private setRemoteCursor(
    userId: string,
    name: string,
    x: number | null,
    y: number | null
  ) {
    const existing = this.remoteCursors.get(userId);
    this.remoteCursors.set(userId, {
      name: name || existing?.name || "guest",
      x: x ?? existing?.x ?? null,
      y: y ?? existing?.y ?? null,
    });
  }

  // Surface the live headcount (us + everyone else on the board) so the
  // studio header can show how many people are connected right now.
  private notifyPresenceCount() {
    this.onPresenceChange?.(this.remoteCursors.size + 1);
  }

  // Throttled pointer telemetry so the room sees our cursor. When the laser
  // tool is hot (and firing), the message also flags it — and carries the ink
  // colour — so peers draw our beam in the same hue we picked, not a cursor
  // arrow.
  sendPointer(x: number, y: number) {
    const now = Date.now();
    if (now - this.lastPointerSent < 35) return;
    this.lastPointerSent = now;
    const lasing = this.selectedTool === "laser" && this.lasing;
    this.socket.send(
      JSON.stringify({
        type: "pointer",
        roomId: this.roomId,
        x,
        y,
        laser: lasing,
        color: lasing ? this.strokeColor : undefined,
      })
    );
  }

  private isOwner(shape: Shape | null | undefined): boolean {
    if (!shape) return false;
    if (!shape.userId) return true;
    return shape.userId === this.userId;
  }

  clearBoard() {
    if (this.existingShapes.length === 0) return;
    const before = this.existingShapes.slice();
    this.recordHistory({ kind: "clear", before });
    this.existingShapes = [];
    this.selectedShapeId = null;
    this.hoveredShapeId = null;
    this.clearCanvas();
    this.socket.send(
      JSON.stringify({ type: "clear", roomId: this.roomId })
    );
  }

  private addShape(shape: Shape) {
    this.existingShapes.push(shape);
    this.recordHistory({ kind: "add", shape });
    // Refresh immediately so committed shapes (e.g. a finished note) appear on
    // screen at once, rather than waiting for the server echo round-trip.
    this.clearCanvas();
    this.socket.send(
      JSON.stringify({ type: "shape", shape, roomId: this.roomId })
    );
  }

  // Eraser: remove whatever shape is under a world-space point and tell the
  // room so the deletion lands for everyone at the same time.
  private eraseShapeAt(wx: number, wy: number) {
    const target = this.shapeAt(wx, wy);
    if (!target || !this.isOwner(target)) return;
    this.recordHistory({ kind: "remove", shape: target });
    this.existingShapes = this.existingShapes.filter((s) => s.id !== target.id);
    // Uncover whatever line was underneath so the cursor can keep erasing.
    const next = this.shapeAt(wx, wy);
    this.hoveredShapeId = next?.id ?? null;
    if (this.selectedShapeId === target.id) this.selectedShapeId = null;
    this.clearCanvas();
    this.socket.send(
      JSON.stringify({
        type: "erase",
        shapeId: target.id,
        roomId: this.roomId,
      })
    );
  }

  // Topmost shape that contains (or is near) a world-space point.
  private shapeAt(wx: number, wy: number): Shape | null {
    for (let i = this.existingShapes.length - 1; i >= 0; i--) {
      const s = this.existingShapes[i]!;
      if (this.hitShape(s, wx, wy)) return s;
    }
    return null;
  }

  // A shape counts as "hit" when the cursor is on the ink or within a small
  // screen-space margin, so thin strokes stay grabbable even when zoomed out.
  private hitShape(s: Shape, wx: number, wy: number): boolean {
    const m = 5 / this.zoom;
    if (s.type === "rect") {
      const minX = Math.min(s.x, s.x + s.width) - m;
      const maxX = Math.max(s.x, s.x + s.width) + m;
      const minY = Math.min(s.y, s.y + s.height) - m;
      const maxY = Math.max(s.y, s.y + s.height) + m;
      return wx >= minX && wx <= maxX && wy >= minY && wy <= maxY;
    }
    if (s.type === "circle") {
      const dx = wx - s.centerX;
      const dy = wy - s.centerY;
      return dx * dx + dy * dy <= (s.radius + m) * (s.radius + m);
    }
    if (s.type === "image") {
      const minX = Math.min(s.x, s.x + s.width) - m;
      const maxX = Math.max(s.x, s.x + s.width) + m;
      const minY = Math.min(s.y, s.y + s.height) - m;
      const maxY = Math.max(s.y, s.y + s.height) + m;
      return wx >= minX && wx <= maxX && wy >= minY && wy <= maxY;
    }
    if (s.type === "text") {
      const size = this.textSize(s.text, s.fontSize, s.fontFamily);
      return (
        wx >= s.x - m &&
        wx <= s.x + size.width + m &&
        wy >= s.y - m &&
        wy <= s.y + size.height + m
      );
    }
    if (s.type === "arrow") {
      const a = { x: s.startX, y: s.startY };
      const b = { x: s.endX, y: s.endY };
      const head = this.arrowHead(b, a, s.strokeWidth);
      if (
        distToSegment(a, b, wx, wy) <= m ||
        distToSegment(b, head.a, wx, wy) <= m ||
        distToSegment(b, head.b, wx, wy) <= m
      ) {
        return true;
      }
      return false;
    }
    const pts = s.points;
    if (pts.length === 1) return Math.hypot(wx - pts[0]!.x, wy - pts[0]!.y) <= m;
    for (let i = 0; i < pts.length - 1; i++) {
      if (distToSegment(pts[i]!, pts[i + 1]!, wx, wy) <= m) return true;
    }
    return false;
  }

  private updateHover(wx: number, wy: number) {
    const nextId = this.selectedTool === "eraser" ? this.shapeAt(wx, wy)?.id ?? null : null;
    if (nextId !== this.hoveredShapeId) {
      this.hoveredShapeId = nextId;
      this.clearCanvas();
    }
  }

  // Make sure the offscreen layers match the visible canvas backing store and
  // (re)create them on first use or after a resize. Sized offscreen canvases
  // are cleared by the browser, so any size change flags the scene as stale.
  private ensureLayers() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    let scene = this.sceneCanvas;
    let cursor = this.cursorCanvas;
    if (!scene) {
      scene = document.createElement("canvas");
      cursor = document.createElement("canvas");
      this.sceneCanvas = scene;
      this.cursorCanvas = cursor;
      this.sceneCtx = scene.getContext("2d")!;
      this.cursorCtx = cursor.getContext("2d")!;
    }
    if (scene.width !== w || scene.height !== h) {
      scene.width = w;
      scene.height = h;
      cursor!.width = w;
      cursor!.height = h;
      this.sceneStale = true;
    }
  }

  // Which shape is mid-drag, if any. It is kept off the static scene layer so
  // only it (not the whole board) moves while the mouse is down.
  private activeDrag(): { shape: Shape } | null {
    if (!this.dragEngaged) return null;
    if (this.moveDrag) return this.moveDrag;
    if (this.resizeDrag) return this.resizeDrag;
    return null;
  }

  // Rebuild the static scene layer: paper, grid, every settled shape, and the
  // selection chrome — everything except the single shape being dragged, which
  // the composite step floats on top so drags only repaint that one shape.
  private renderScene() {
    const sc = this.sceneCtx!;
    const w = this.canvas.clientWidth || 1;
    const h = this.canvas.clientHeight || 1;
    sc.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    sc.clearRect(0, 0, w, h);
    sc.fillStyle = this.backgroundColor;
    sc.fillRect(0, 0, w, h);

    this.applyWorldTransformTo(sc);
    this.drawGrid(sc, w, h);

    const draggingId = this.activeDrag()?.shape.id ?? null;
    for (const shape of this.existingShapes) {
      if (shape.id === draggingId) continue;
      this.drawShape(sc, shape);
    }

    // In eraser mode, flag the line under the cursor before it is erased.
    this.drawHoveredShape(sc);
    // In pointer mode, frame the picked shape with resize handles (the one
    // being dragged is drawn by the drag overlay instead).
    this.drawSelection(sc);
    // Pointer-mode rubber band while box-selecting.
    this.drawBand(sc);

    this.sceneStale = false;
  }

  // Redraw the presence overlay: laser trails first, then cursor arrows. Cursor
  // telemetry can arrive tens of times a second per collaborator, so this stays
  // as cheap as possible.
  private renderCursorLayer() {
    const cc = this.cursorCtx!;
    const w = this.canvas.clientWidth || 1;
    const h = this.canvas.clientHeight || 1;
    cc.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    cc.clearRect(0, 0, w, h);

    // Our own beam in the selected ink colour: the fading tail, then the bright
    // reticle on top so the tip reads as the hottest point. Idle (not pressed)
    // the dot dims to a quiet aiming aid; while pressing it burns white-hot.
    this.laserTrail = this.laserTrail.filter(
      (p) => Date.now() - p.t < LASER_AGE_MS
    );
    this.drawLaserTrail(cc, this.laserTrail, this.strokeColor, this.strokeWidth);
    if (this.selectedTool === "laser" && this.laserLatest) {
      this.drawLaserHead(cc, this.laserLatest.x, this.laserLatest.y, this.strokeColor, this.lasing ? 1 : 0.4);
    }

    // Everyone else's beams, tinted with the ink they lased in (or their
    // presence colour if we haven't heard their hue yet).
    const now = Date.now();
    this.remoteLasers.forEach((trail, userId) => {
      const live = trail.filter((p) => now - p.t < LASER_AGE_MS);
      if (live.length === 0) {
        this.remoteLasers.delete(userId);
        this.remoteLaserColors.delete(userId);
        return;
      }
      this.remoteLasers.set(userId, live);
      const name = this.remoteCursors.get(userId)?.name ?? "guest";
      const color = this.remoteLaserColors.get(userId) ?? presenceColor(name);
      // For remote users, use a default base width since we don't know their stroke width
      this.drawLaserTrail(cc, live, color, 2);
      const last = live[live.length - 1]!;
      this.drawLaserHead(cc, last.x, last.y, color);
      this.drawLaserName(cc, (last.x - this.offsetX) * this.zoom, (last.y - this.offsetY) * this.zoom, name);
    });

    if (this.remoteCursors.size === 0) return;
    this.remoteCursors.forEach((c, userId) => {
      if (c.x === null || c.y === null) return;
      // A lasing collaborator is represented by their beam, not a cursor arrow.
      if (this.remoteLasers.has(userId)) return;
      const sx = (c.x - this.offsetX) * this.zoom;
      const sy = (c.y - this.offsetY) * this.zoom;
      if (sx < -60 || sx > w + 60 || sy < -40 || sy > h + 40) return;
      this.drawPresenceCursor(cc, sx, sy, c.name);
    });
  }

  // The beam's glowing tip: a white-hot core wrapped in a coloured halo. Drawn
  // additively so overlapping glows brighten like real light instead of
  // darkening at their seams. intensity dips when idle so the dot reads as a
  // quiet aiming aid, not a live beam.
  private drawLaserHead(
    ctx: CanvasRenderingContext2D,
    worldX: number,
    worldY: number,
    color: string,
    intensity = 1
  ) {
    const sx = (worldX - this.offsetX) * this.zoom;
    const sy = (worldY - this.offsetY) * this.zoom;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    // Wide, barely-there aura.
    let g = ctx.createRadialGradient(sx, sy, 0, sx, sy, 22);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = g;
    ctx.globalAlpha = 0.34 * intensity;
    ctx.beginPath();
    ctx.arc(sx, sy, 22, 0, Math.PI * 2);
    ctx.fill();
    // The coloured body.
    g = ctx.createRadialGradient(sx, sy, 0, sx, sy, 9);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = g;
    ctx.globalAlpha = 0.95 * intensity;
    ctx.beginPath();
    ctx.arc(sx, sy, 9, 0, Math.PI * 2);
    ctx.fill();
    // White-hot centre — only when actually firing.
    if (intensity > 0.7) {
      ctx.fillStyle = "#ffffff";
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(sx, sy, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // The beam itself: a soft glowing underlay traced along the whole path, a
  // crisp tapering core that fades as it recedes from the head, and a white-
  // hot tip at the freshest end. Additive blending keeps it luminous and
  // seam-free; the taper stops it reading as a constant-width pipe.
  private drawLaserTrail(
    ctx: CanvasRenderingContext2D,
    trail: LaserPoint[],
    color: string,
    baseWidth: number = this.strokeWidth
  ) {
    const now = Date.now();
    // World → screen and drop any points older than the beam's lifetime.
    const pts: { x: number; y: number; life: number }[] = [];
    for (const p of trail) {
      const age = now - p.t;
      if (age >= LASER_AGE_MS) continue;
      pts.push({
        x: (p.x - this.offsetX) * this.zoom,
        y: (p.y - this.offsetY) * this.zoom,
        life: 1 - age / LASER_AGE_MS,
      });
    }
    if (pts.length < 2) return;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const trace = () => {
      ctx.beginPath();
      ctx.moveTo(pts[0]!.x, pts[0]!.y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i]!.x, pts[i]!.y);
      }
      ctx.stroke();
    };

    // Scale laser width with the current stroke width setting
    const base = Math.max(1, baseWidth / 2);

    // Soft outer aura
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 30;
    ctx.globalAlpha = 0.2;
    ctx.lineWidth = 15 * base;
    trace();

    // The luminous body.
    ctx.shadowBlur = 14;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 7 * base;
    trace();
    ctx.shadowBlur = 0;

    // Tapering core: thick and bright near the head, thinning to a point and
    // fading away toward the tail — the "light streak" silhouette.
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]!;
      const b = pts[i]!;
      const life = Math.max(a.life, b.life);
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.9 * life;
      ctx.lineWidth = Math.max(0.5, 5 * base * Math.pow(life, 1.25));
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    // White-hot tip: a short bright stroke at the freshest end of the beam.
    const hotN = Math.min(8, pts.length - 1);
    const hotStart = pts.length - 1 - hotN;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = 2.4 * base;
    ctx.beginPath();
    ctx.moveTo(pts[hotStart]!.x, pts[hotStart]!.y);
    for (let i = hotStart + 1; i < pts.length; i++) {
      ctx.lineTo(pts[i]!.x, pts[i]!.y);
    }
    ctx.stroke();
    ctx.restore();
  }

  // A slim name tag that floats just under a collaborator's beam tip, so the
  // trail reads as theirs without the full cursor arrow.
  private drawLaserName(
    ctx: CanvasRenderingContext2D,
    sx: number,
    sy: number,
    name: string
  ) {
    const label = name || "guest";
    ctx.save();
    ctx.font = "600 12px ui-sans-serif, system-ui, sans-serif";
    const textW = ctx.measureText(label).width;
    const pillW = textW + 16;
    const pillH = 20;
    const px = sx - pillW / 2;
    const py = sy + 16;
    ctx.fillStyle = "rgba(28, 28, 36, 0.92)";
    ctx.beginPath();
    ctx.roundRect(px, py, pillW, pillH, 6);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(label, px + (pillW - textW) / 2, py + pillH / 2);
    ctx.restore();
  }

  // Push the current cursor onto our own fading trail and make sure the beam
  // keeps animating (it would otherwise stop as soon as pointer events pause).
  // Points are interpolated along the move so fast flicks leave a continuous
  // streak rather than a dotted line.
  private addLaserPoint(p: { x: number; y: number }) {
    const step = LASER_INTERP_STEP / this.zoom;
    const t = Date.now();
    const last = this.laserTrail[this.laserTrail.length - 1];
    if (last) {
      this.fillBetween(this.laserTrail, last, p, step, t);
    } else {
      this.laserTrail.push({ x: p.x, y: p.y, t });
    }
    if (this.laserTrail.length > LASER_MAX_DOTS) {
      this.laserTrail.splice(0, this.laserTrail.length - LASER_MAX_DOTS);
    }
    this.laserLatest = { x: p.x, y: p.y };
    this.ensureLaserLoop();
  }

  // Stamp every world-space step along the from→to segment onto a trail so
  // sparse cursor telemetry renders as one smooth, unbroken beam.
  private fillBetween(
    trail: LaserPoint[],
    from: { x: number; y: number },
    to: { x: number; y: number },
    step: number,
    t: number
  ) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.hypot(dx, dy);
    const n = Math.max(1, Math.round(dist / Math.max(step, 0.5)));
    for (let i = 1; i <= n; i++) {
      trail.push({ x: from.x + (dx * i) / n, y: from.y + (dy * i) / n, t });
    }
  }

  // A cheap rAF loop that keeps fading the beams after the last pointer event.
  private ensureLaserLoop() {
    if (this.laserAnimFrame !== null) return;
    const tick = () => {
      this.renderCursorLayer();
      this.composite();
      if (this.hasLiveLasers()) {
        this.laserAnimFrame = requestAnimationFrame(tick);
      } else {
        this.laserAnimFrame = null;
      }
    };
    this.laserAnimFrame = requestAnimationFrame(tick);
  }

  private hasLiveLasers(): boolean {
    if (this.laserTrail.length > 0) return true;
    for (const trail of this.remoteLasers.values()) {
      if (trail.length > 0) return true;
    }
    return false;
  }

  // Blit both cached layers onto the visible canvas, then float a mid-drag
  // shape (and its selection frame) on top. Leaves the context in the world
  // transform so callers drawing live previews (e.g. the pencil) keep working.
  private composite() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.sceneCanvas) ctx.drawImage(this.sceneCanvas, 0, 0);
    if (this.cursorCanvas) ctx.drawImage(this.cursorCanvas, 0, 0);
    const drag = this.activeDrag();
    if (drag) {
      this.applyWorldTransformTo(ctx);
      this.drawShape(ctx, drag.shape);
      this.drawShapeFrame(ctx, drag.shape, this.resizeDrag?.handle ?? null);
    }
    this.applyWorldTransformTo(ctx);
  }

  clearCanvas() {
    this.ensureLayers();
    this.renderCursorLayer();
    this.renderScene();
    this.composite();
  }

  // Coalesce repaints to one per animation frame. Drags fire mousemove far
  // faster than the screen can refresh; redrawing the whole board on every raw
  // event is what made move/resize feel laggy. Mutations still apply instantly
  // to the shape state, the canvas just repaints at most once per frame.
  scheduleRedraw() {
    if (this.redrawQueued) return;
    this.redrawQueued = true;
    requestAnimationFrame(() => {
      this.redrawQueued = false;
      this.clearCanvas();
    });
  }

  // During a move/resize drag the scene layer is already cached, so each
  // pointer event only re-blits the static layers and redraws the one moving
  // shape — a near-free repaint that keeps drags buttery at 60fps.
  scheduleDragFrame() {
    if (this.dragFrameQueued) return;
    this.dragFrameQueued = true;
    requestAnimationFrame(() => {
      this.dragFrameQueued = false;
      this.renderCursorLayer();
      if (this.sceneStale) this.renderScene();
      this.composite();
    });
  }

  // Someone else's cursor moved: repaint just the cheap cursor overlay, never
  // the whole board.
  scheduleCursorRedraw() {
    if (this.cursorQueued) return;
    this.cursorQueued = true;
    requestAnimationFrame(() => {
      this.cursorQueued = false;
      this.renderCursorLayer();
      if (this.sceneStale) this.renderScene();
      this.composite();
    });
  }

  private drawPresenceCursor(
    ctx: CanvasRenderingContext2D,
    sx: number,
    sy: number,
    name: string
  ) {
    const color = presenceColor(name);
    ctx.fillStyle = color;
    // Cursor arrow, tip at (sx, sy).
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + 12, sy + 15);
    ctx.lineTo(sx + 8, sy + 16);
    ctx.lineTo(sx + 10, sy + 24);
    ctx.lineTo(sx + 6.5, sy + 23);
    ctx.lineTo(sx + 4.5, sy + 17);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Name pill plate.
    const label = name || "guest";
    const px = sx + 16;
    const py = sy + 12;
    ctx.font = "600 12px ui-sans-serif, system-ui, sans-serif";
    const text = label;
    const textW = ctx.measureText(text).width;
    const pillW = textW + 12 + 20;
    const pillH = 20;
    ctx.fillStyle = "rgba(28, 28, 36, 0.92)";
    ctx.beginPath();
    ctx.roundRect(px, py, pillW, pillH, 6);
    ctx.fill();

    // Initial chip.
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(px + 10, py + pillH / 2, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label.charAt(0).toUpperCase(), px + 10, py + pillH / 2 + 0.5);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(text, px + 24, py + 14);
  }

  private applyWorldTransformTo(ctx: CanvasRenderingContext2D) {
    const s = this.scale * this.zoom;
    ctx.setTransform(s, 0, 0, s, -this.offsetX * s, -this.offsetY * s);
  }

  private drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const top = this.offsetY;
    const bottom = this.offsetY + h / this.zoom;
    const left = this.offsetX;
    const right = this.offsetX + w / this.zoom;
    // Grid follows the paper tone: dark paper gets light hairlines (and
    // vice-versa) so the drafting lines stay visible.
    const dark = this.isDarkBackground();
    const gridColor = dark ? "rgba(255, 255, 255, 0.08)" : "rgba(24, 24, 26, 0.05)";
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1 / this.zoom;
    // One batched path for the whole grid — a single stroke call instead of
    // one per line, so the scene layer (and any pan frame) is far cheaper.
    ctx.beginPath();
    for (let x = Math.floor(left / GRID_STEP) * GRID_STEP; x <= right; x += GRID_STEP) {
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
    }
    for (let y = Math.floor(top / GRID_STEP) * GRID_STEP; y <= bottom; y += GRID_STEP) {
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
    }
    ctx.stroke();
  }

  // Rough perceived-luminance check so overlay strokes (grid hairlines) can
  // flip to light when the paper goes dark. Handles the hex swatches and the
  // native color input's values; unknown formats fall back to treating the
  // paper as light.
  private isDarkBackground(): boolean {
    const c = this.backgroundColor.trim();
    let r = 255;
    let g = 255;
    let b = 255;
    const hex = c.match(/^#([0-9a-f]{6})$/i);
    if (hex) {
      r = parseInt(hex[1]!.slice(0, 2), 16);
      g = parseInt(hex[1]!.slice(2, 4), 16);
      b = parseInt(hex[1]!.slice(4, 6), 16);
    } else {
      const rgb = c.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
      if (rgb) {
        r = Number(rgb[1]);
        g = Number(rgb[2]);
        b = Number(rgb[3]);
      }
    }
    return 0.299 * r + 0.587 * g + 0.114 * b < 128;
  }

  private drawShape(ctx: CanvasRenderingContext2D, shape: Shape) {
    ctx.strokeStyle = "color" in shape ? shape.color : DEFAULT_COLOR;
    // Use shape's strokeWidth if available, otherwise fall back to current setting
    const w = "strokeWidth" in shape ? shape.strokeWidth : this.strokeWidth;
    ctx.lineWidth = w / this.zoom;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (shape.type === "rect") {
      ctx?.strokeRect(shape.x, shape.y, shape.width, shape.height);
    } else if (shape.type === "circle") {
      ctx.beginPath();
      ctx.arc(shape.centerX, shape.centerY, shape.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.closePath();
    } else if (shape.type === "pencil") {
      if (shape.points.length < 2) {
        return;
      }
      ctx.beginPath();
      ctx.moveTo(shape.points[0]!.x, shape.points[0]!.y);
      for (let i = 1; i < shape.points.length; i++) {
        ctx.lineTo(shape.points[i]!.x, shape.points[i]!.y);
      }
      ctx.stroke();
      ctx.closePath();
    } else if (shape.type === "arrow") {
      this.drawArrow(
        ctx,
        { x: shape.startX, y: shape.startY },
        { x: shape.endX, y: shape.endY },
        shape.strokeWidth
      );
    } else if (shape.type === "text") {
      ctx.fillStyle = shape.color || DEFAULT_COLOR;
      const w = "strokeWidth" in shape ? shape.strokeWidth : this.strokeWidth;
      this.drawText(ctx, shape.text, shape.x, shape.y, shape.fontSize, shape.fontFamily, w);
    } else if (shape.type === "image") {
      const img = this.imageFor(shape.dataUrl);
      if (img && img.naturalWidth > 0) {
        try {
          ctx.drawImage(img, shape.x, shape.y, shape.width, shape.height);
        } catch {
          // Data URL failed to decode; skip quietly.
        }
      }
    }
  }

  // Two feathered back-edges that make the arrowhead at the tip.
  private arrowHead(
    end: { x: number; y: number },
    start: { x: number; y: number },
    strokeWidth: number = 2
  ) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const len = Math.hypot(dx, dy);
    const ux = len < 1e-6 ? 1 : dx / len;
    const uy = len < 1e-6 ? 0 : dy / len;
    // Scale arrowhead with stroke width for consistent visual weight
    const headLen = 14 * Math.max(1, strokeWidth / 2);
    const spread = 0.42;
    const ca = Math.cos(spread);
    const sa = Math.sin(spread);
    // Feathers are the shaft vector rotated ±spread around the tip, so they
    // always flare symmetrically back along the arrow's own direction.
    const a = {
      x: end.x - (ux * ca - uy * sa) * headLen,
      y: end.y - (ux * sa + uy * ca) * headLen,
    };
    const b = {
      x: end.x - (ux * ca + uy * sa) * headLen,
      y: end.y + (ux * sa - uy * ca) * headLen,
    };
    return { a, b, ux, uy, headLen };
  }

  // Shaft plus a solid, filled arrowhead at the tip. The shaft is butt-capped
  // and ends a hair past the head's base — inside the filled head — so the head
  // alone occupies the very end of the arrow and no stroke overlaps or pokes
  // past the point. The tail keeps its rounded cap via a filled circle.
  private drawArrow(
    ctx: CanvasRenderingContext2D,
    start: { x: number; y: number },
    end: { x: number; y: number },
    strokeWidth: number = 2
  ) {
    const head = this.arrowHead(end, start, strokeWidth);
    const half = strokeWidth / this.zoom / 2;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const len = Math.hypot(dx, dy);
    // Stop the shaft just inside the head's covered region so the pointed tip
    // at `end` is the arrow's true end and the shaft never crosses it.
    const dec = Math.max(0, Math.min(head.headLen - 2, len));
    const eBase = {
      x: end.x - head.ux * dec,
      y: end.y - head.uy * dec,
    };
    ctx.save();
    ctx.lineCap = "butt";
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(eBase.x, eBase.y);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = ctx.strokeStyle;
    ctx.beginPath();
    ctx.arc(start.x, start.y, half, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(head.a.x, head.a.y);
    ctx.lineTo(head.b.x, head.b.y);
    ctx.closePath();
    ctx.fill();
  }

  private drawText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    fontSize: number,
    fontFamily: string = FONT_FAMILY,
    strokeWidth: number = 0
  ) {
    ctx.font = `${fontSize}px ${fontFamily || FONT_FAMILY}`;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (strokeWidth > 0) {
        ctx.lineWidth = strokeWidth;
        ctx.strokeText(lines[i]!, x, y + i * fontSize * TEXT_LINE_HEIGHT);
      }
      ctx.fillText(lines[i]!, x, y + i * fontSize * TEXT_LINE_HEIGHT);
    }
  }

  private textSize(
    text: string,
    fontSize: number,
    fontFamily: string = FONT_FAMILY
  ): { width: number; height: number } {
    this.ctx.font = `${fontSize}px ${fontFamily || FONT_FAMILY}`;
    let width = 0;
    const lines = text.split("\n");
    for (const line of lines) {
      width = Math.max(width, this.ctx.measureText(line).width);
    }
    return { width, height: lines.length * fontSize * TEXT_LINE_HEIGHT };
  }

  private imageFor(dataUrl: string): HTMLImageElement | undefined {
    const cached = this.imageCache.get(dataUrl);
    if (cached) return cached;
    const img = new Image();
    img.onload = () => {
      // Re-render once the bitmap is actually decodable.
      this.clearCanvas();
    };
    img.src = dataUrl;
    this.imageCache.set(dataUrl, img);
    return img;
  }

  private drawHoveredShape(ctx: CanvasRenderingContext2D) {
    const s = this.existingShapes.find((x) => x.id === this.hoveredShapeId);
    if (!s) return;
    if (this.selectedTool === "select") {
      // Pointer mode: a faint outline on the hovered element (but not the
      // already-selected one, which is framed by drawSelection) signals "you
      // can grab this".
      if (s.id === this.selectedShapeId) return;
      const b = this.shapeBounds(s);
      ctx.save();
      ctx.strokeStyle = "rgba(47, 107, 255, 0.35)";
      ctx.lineWidth = 1.5 / this.zoom;
      ctx.strokeRect(b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY);
      ctx.restore();
      return;
    }
    ctx.save();
    ctx.strokeStyle = "rgba(224, 49, 49, 0.95)";
    ctx.fillStyle = "rgba(224, 49, 49, 0.1)";
    ctx.lineWidth = 3 / this.zoom;
    ctx.setLineDash([7 / this.zoom, 5 / this.zoom]);
    if (s.type === "rect") {
      ctx.fillRect(s.x, s.y, s.width, s.height);
      ctx.strokeRect(s.x, s.y, s.width, s.height);
    } else if (s.type === "circle") {
      ctx.beginPath();
      ctx.arc(s.centerX, s.centerY, s.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.closePath();
    } else if (s.type === "pencil") {
      if (s.points.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(s.points[0]!.x, s.points[0]!.y);
        for (let i = 1; i < s.points.length; i++) {
          ctx.lineTo(s.points[i]!.x, s.points[i]!.y);
        }
        ctx.stroke();
        ctx.closePath();
      }
    } else if (s.type === "arrow") {
      const start = { x: s.startX, y: s.startY };
      const end = { x: s.endX, y: s.endY };
      const w = s.strokeWidth ?? 2;
      const head = this.arrowHead(end, start, w);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.lineTo(head.a.x, head.a.y);
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(head.b.x, head.b.y);
      ctx.stroke();
      ctx.closePath();
    } else if (s.type === "text") {
      const size = this.textSize(s.text, s.fontSize, s.fontFamily);
      ctx.fillRect(s.x, s.y, size.width, size.height);
      ctx.strokeRect(s.x, s.y, size.width, size.height);
    } else if (s.type === "image") {
      ctx.fillRect(s.x, s.y, s.width, s.height);
      ctx.strokeRect(s.x, s.y, s.width, s.height);
    }
    ctx.restore();
  }

  private shapeBounds(s: Shape): Bounds {
    if (s.type === "rect" || s.type === "image") {
      return {
        minX: Math.min(s.x, s.x + s.width),
        minY: Math.min(s.y, s.y + s.height),
        maxX: Math.max(s.x, s.x + s.width),
        maxY: Math.max(s.y, s.y + s.height),
      };
    }
    if (s.type === "circle") {
      return {
        minX: s.centerX - s.radius,
        minY: s.centerY - s.radius,
        maxX: s.centerX + s.radius,
        maxY: s.centerY + s.radius,
      };
    }
    if (s.type === "arrow") {
      return {
        minX: Math.min(s.startX, s.endX),
        minY: Math.min(s.startY, s.endY),
        maxX: Math.max(s.startX, s.endX),
        maxY: Math.max(s.startY, s.endY),
      };
    }
    if (s.type === "text") {
      const size = this.textSize(s.text, s.fontSize, s.fontFamily);
      return { minX: s.x, minY: s.y, maxX: s.x + size.width, maxY: s.y + size.height };
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of s.points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    if (!isFinite(minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    return { minX, minY, maxX, maxY };
  }

  // ---- Pointer mode: selection, move and resize ----

  private getSelectedShape(): Shape | null {
    if (!this.selectedShapeId) return null;
    return this.existingShapes.find((s) => s.id === this.selectedShapeId) ?? null;
  }

  private startSelectDrag(p: { x: number; y: number }) {
    const hit = this.shapeAt(p.x, p.y);
    if (hit && this.isOwner(hit)) {
      if (this.selectedShapeId === hit.id) {
        const handle = this.hitHandle(hit.id, p.x, p.y);
        if (handle) {
          this.resizeDrag = {
            shape: hit,
            origBounds: this.shapeBounds(hit),
            origShape: { ...hit },
            handle,
            origin: { x: p.x, y: p.y },
          };
          this.hoveredResizeHandle = null;
          this.clicked = true;
          this.clearCanvas();
          return;
        }
        // A press just off the handles but within the grab band along the
        // selection border resolves to the nearest edge/corner, so the whole
        // frame reads as resizeable like Excalidraw.
        const bandHandle = this.handleNearBorder(hit, p.x, p.y);
        if (bandHandle) {
          this.resizeDrag = {
            shape: hit,
            origBounds: this.shapeBounds(hit),
            origShape: { ...hit },
            handle: bandHandle,
            origin: { x: p.x, y: p.y },
          };
          this.hoveredResizeHandle = null;
          this.clicked = true;
          this.clearCanvas();
          return;
        }
      }
      this.selectedShapeId = hit.id;
      this.hoveredShapeId = null;
      this.moveDrag = { shape: hit, start: { x: p.x, y: p.y }, before: { ...hit } };
      this.clicked = true;
    } else {
      this.selectedShapeId = null;
      this.hoveredShapeId = null;
      this.bandSelect = { start: { x: p.x, y: p.y } };
      this.bandCurrent = { x: p.x, y: p.y };
      this.clicked = true;
    }
    this.clearCanvas();
  }

  private handlePositions(b: Bounds): { key: HandleKey; x: number; y: number }[] {
    const cx = (b.minX + b.maxX) / 2;
    const cy = (b.minY + b.maxY) / 2;
    return [
      { key: "nw", x: b.minX, y: b.minY },
      { key: "n", x: cx, y: b.minY },
      { key: "ne", x: b.maxX, y: b.minY },
      { key: "e", x: b.maxX, y: cy },
      { key: "se", x: b.maxX, y: b.maxY },
      { key: "s", x: cx, y: b.maxY },
      { key: "sw", x: b.minX, y: b.maxY },
      { key: "w", x: b.minX, y: cy },
    ];
  }

  private hitHandle(id: string, wx: number, wy: number): HandleKey | null {
    const s = this.existingShapes.find((x) => x.id === id);
    if (!s) return null;
    const r = HANDLE_HIT / this.zoom;
    for (const pos of this.handlePositions(this.shapeBounds(s))) {
      if (Math.hypot(pos.x - wx, pos.y - wy) <= r) return pos.key;
    }
    return null;
  }

  // Pressing anywhere within RESIZE_BAND of the selection rectangle boundary
  // acts like grabbing the nearest edge handle, making the dotted frame feel
  // like a well for resizing rather than only the eight corner dots.
  private handleNearBorder(s: Shape, wx: number, wy: number): HandleKey | null {
    const b = this.shapeBounds(s);
    const band = RESIZE_BAND / this.zoom / 2;
    const left = b.minX - band, right = b.maxX + band;
    const top = b.minY - band, bottom = b.maxY + band;
    if (wx < left || wx > right || wy < top || wy > bottom) return null;
    const ix = wx < b.minX + band, ax = wx > b.maxX - band;
    const iy = wy < b.minY + band, ay = wy > b.maxY - band;
    if (ix && iy) return "nw";
    if (ax && iy) return "ne";
    if (ix && ay) return "sw";
    if (ax && ay) return "se";
    if (ix) return "w";
    if (ax) return "e";
    if (iy) return "n";
    if (ay) return "s";
    return null;
  }

  // Frame a shape with the blue selection box and its eight resize handles.
  private drawShapeFrame(
    ctx: CanvasRenderingContext2D,
    shape: Shape,
    activeHandle: HandleKey | null = null
  ) {
    const b = this.shapeBounds(shape);
    const handle = this.handlePositions(b);
    ctx.save();
    ctx.strokeStyle = "#2f6bff";
    ctx.lineWidth = 2 / this.zoom;
    ctx.setLineDash([]);
    ctx.strokeRect(b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY);
    ctx.restore();

    const size = HANDLE_SIZE / this.zoom;
    for (const pos of handle) {
      const active = activeHandle === pos.key;
      ctx.save();
      ctx.fillStyle = active ? "#2f6bff" : "#ffffff";
      ctx.strokeStyle = "#2f6bff";
      ctx.lineWidth = 2 / this.zoom;
      ctx.fillRect(pos.x - size / 2, pos.y - size / 2, size, size);
      ctx.strokeRect(pos.x - size / 2, pos.y - size / 2, size, size);
      ctx.restore();
    }
  }

  private drawSelection(ctx: CanvasRenderingContext2D) {
    const s = this.getSelectedShape();
    if (!s) return;
    // The shape being dragged is drawn by the drag overlay so it can track the
    // cursor without the whole scene re-rendering.
    if (this.activeDrag()?.shape.id === s.id) return;
    this.drawShapeFrame(ctx, s, this.hoveredResizeHandle);
  }

  private computeResizeBounds(
    orig: Bounds,
    handle: HandleKey,
    origin: { x: number; y: number },
    mx: number,
    my: number,
    lockAspect: boolean
  ): Bounds {
    const dMinX = handle.includes("w");
    const dMaxX = handle.includes("e");
    const dMinY = handle.includes("n");
    const dMaxY = handle.includes("s");
    // Push the moved edge by the drag delta from where the press began, rather
    // than snapping it onto the cursor's absolute world spot. A press that
    // lands a few pixels off the handle (common with the border grab band)
    // otherwise makes the shape leap to the cursor the instant the drag
    // engages — the classic "drag a little, it grows too fast" jump. The
    // RESIZE_SENSITIVITY factor additionally damps the growth so the shape
    // tracks the hand slowly and smoothly instead of 1:1 with it.
    const dx = (mx - origin.x) * RESIZE_SENSITIVITY;
    const dy = (my - origin.y) * RESIZE_SENSITIVITY;
    let minX = orig.minX;
    let maxX = orig.maxX;
    let minY = orig.minY;
    let maxY = orig.maxY;
    if (dMinX) minX = orig.minX + dx;
    if (dMaxX) maxX = orig.maxX + dx;
    if (dMinY) minY = orig.minY + dy;
    if (dMaxY) maxY = orig.maxY + dy;
    if (maxX - minX < MIN_SHAPE_DIM) {
      if (dMinX) minX = maxX - MIN_SHAPE_DIM;
      else maxX = minX + MIN_SHAPE_DIM;
    }
    if (maxY - minY < MIN_SHAPE_DIM) {
      if (dMinY) minY = maxY - MIN_SHAPE_DIM;
      else maxY = minY + MIN_SHAPE_DIM;
    }
    if (lockAspect) {
      const ow = orig.maxX - orig.minX || 1;
      const oh = orig.maxY - orig.minY || 1;
      const sW = (maxX - minX) / ow;
      const sH = (maxY - minY) / oh;
      const isCorner = (dMinX || dMaxX) && (dMinY || dMaxY);
      const s = isCorner ? Math.max(sW, sH) : dMinX || dMaxX ? sW : sH;
      const newW = ow * s;
      const newH = oh * s;
      if (dMinX) minX = orig.maxX - newW;
      else minX = orig.minX;
      if (dMaxX) maxX = orig.minX + newW;
      else maxX = orig.maxX;
      if (dMinY) minY = orig.maxY - newH;
      else minY = orig.minY;
      if (dMaxY) maxY = orig.minY + newH;
      else maxY = orig.maxY;
    }
    return { minX, minY, maxX, maxY };
  }

  // Rebuild the dragged shape from the ORIGINAL snapshot and the resize bounds.
  // The old code scaled the already-mutated shape every frame, so circle/arrow/
  // text growth compounded frame over frame — a stationary cursor still kept
  // inflating the element ("drag a little, it grows so fast"). Anchoring every
  // frame to the press-time shape makes resize strictly linear and controllable.
  private applyBoundsToShape(s: Shape, b: Bounds, origShape: Shape) {
    if (s.type === "rect" || s.type === "image") {
      s.x = b.minX;
      s.y = b.minY;
      s.width = b.maxX - b.minX;
      s.height = b.maxY - b.minY;
    } else if (s.type === "circle") {
      const orig = origShape as Extract<Shape, { type: "circle" }>;
      const ob = this.shapeBounds(orig);
      const scale = (b.maxX - b.minX) / (ob.maxX - ob.minX || 1);
      s.radius = Math.max(MIN_SHAPE_DIM / 2, orig.radius * scale);
      s.centerX = (b.minX + b.maxX) / 2;
      s.centerY = (b.minY + b.maxY) / 2;
    } else if (s.type === "arrow") {
      const orig = origShape as Extract<Shape, { type: "arrow" }>;
      const ob = this.shapeBounds(orig);
      const ow = ob.maxX - ob.minX || 1;
      const oh = ob.maxY - ob.minY || 1;
      const nw = b.maxX - b.minX;
      const nh = b.maxY - b.minY;
      s.startX = b.minX + ((orig.startX - ob.minX) / ow) * nw;
      s.startY = b.minY + ((orig.startY - ob.minY) / oh) * nh;
      s.endX = b.minX + ((orig.endX - ob.minX) / ow) * nw;
      s.endY = b.minY + ((orig.endY - ob.minY) / oh) * nh;
    } else if (s.type === "text") {
      const orig = origShape as Extract<Shape, { type: "text" }>;
      const ob = this.shapeBounds(orig);
      const extentScale = (b.maxX - b.minX) / (ob.maxX - ob.minX || 1);
      // Text reads especially jumpy because each unit of type size is visually
      // large, so damp the growth an extra notch on top of RESIZE_SENSITIVITY.
      const damped = 1 + (extentScale - 1) * TEXT_RESIZE_DAMP;
      s.fontSize = Math.max(8, orig.fontSize * damped);
      s.x = b.minX;
      s.y = b.minY;
    }
  }

  private moveShapeBy(s: Shape, dx: number, dy: number) {
    if (s.type === "rect" || s.type === "text" || s.type === "image") {
      s.x += dx;
      s.y += dy;
    } else if (s.type === "circle") {
      s.centerX += dx;
      s.centerY += dy;
    } else if (s.type === "arrow") {
      s.startX += dx;
      s.startY += dy;
      s.endX += dx;
      s.endY += dy;
    }
  }

  private bandBox(): Bounds {
    const a = this.bandSelect!;
    return {
      minX: Math.min(a.start.x, this.bandCurrent!.x),
      minY: Math.min(a.start.y, this.bandCurrent!.y),
      maxX: Math.max(a.start.x, this.bandCurrent!.x),
      maxY: Math.max(a.start.y, this.bandCurrent!.y),
    };
  }

  private drawBand(ctx: CanvasRenderingContext2D) {
    if (!this.bandSelect || !this.bandCurrent) return;
    const b = this.bandBox();
    ctx.save();
    ctx.fillStyle = "rgba(47, 107, 255, 0.08)";
    ctx.strokeStyle = "#2f6bff";
    ctx.lineWidth = 1.5 / this.zoom;
    ctx.setLineDash([5 / this.zoom, 3 / this.zoom]);
    ctx.fillRect(b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY);
    ctx.strokeRect(b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY);
    ctx.restore();
  }

  private applyBandSelect() {
    const box = this.bandBox();
    for (let i = this.existingShapes.length - 1; i >= 0; i--) {
      const s = this.existingShapes[i]!;
      const sb = this.shapeBounds(s);
      if (
        sb.minX >= box.minX &&
        sb.maxX <= box.maxX &&
        sb.minY >= box.minY &&
        sb.maxY <= box.maxY
      ) {
        this.selectedShapeId = s.id;
        return;
      }
    }
    this.selectedShapeId = null;
  }

  private sendShapeUpdate(shape: Shape) {
    this.socket.send(
      JSON.stringify({ type: "update", shape, roomId: this.roomId })
    );
  }

  private sendShape(shape: Shape) {
    this.socket.send(
      JSON.stringify({ type: "shape", shape, roomId: this.roomId })
    );
  }

  private sendErase(shapeId: string) {
    this.socket.send(
      JSON.stringify({ type: "erase", shapeId, roomId: this.roomId })
    );
  }

  private sendClear() {
    this.socket.send(
      JSON.stringify({ type: "clear", roomId: this.roomId })
    );
  }

  // ---- Undo / redo ----

  private isUserEntry(entry: HistoryEntry): boolean {
    if (entry.kind === "add" || entry.kind === "remove") {
      return this.isOwner(entry.shape);
    }
    if (entry.kind === "update") {
      return this.isOwner(entry.before);
    }
    if (entry.kind === "clear") {
      return entry.before.every((s) => this.isOwner(s));
    }
    return true;
  }

  private recordHistory(entry: HistoryEntry) {
    if (!this.isUserEntry(entry)) return;
    this.undoStack.push(entry);
    if (this.undoStack.length > HISTORY_LIMIT) this.undoStack.shift();
    // A fresh action makes the redo trail stale: you can only redo the last
    // undone action, and only if nothing new happened in between.
    this.redoStack = [];
    this.emitHistory();
  }

  private emitHistory() {
    this.onHistoryChange?.(
      this.undoStack.length > 0,
      this.redoStack.length > 0
    );
  }

  undo() {
    const entry = this.undoStack.pop();
    if (!entry) return;
    // Never undo mid-drag: the dragged shape's object is shared with the board
    // and replaying a delta while the pointer is down would corrupt the drag.
    if (this.activeDrag()) {
      this.undoStack.push(entry);
      return;
    }
    this.selectedShapeId = null;
    this.hoveredShapeId = null;
    this.applyHistory(entry, "backward");
    this.redoStack.push(entry);
    this.emitHistory();
    this.clearCanvas();
  }

  redo() {
    const entry = this.redoStack.pop();
    if (!entry) return;
    if (this.activeDrag()) {
      this.redoStack.push(entry);
      return;
    }
    this.selectedShapeId = null;
    this.hoveredShapeId = null;
    this.applyHistory(entry, "forward");
    this.undoStack.push(entry);
    this.emitHistory();
    this.clearCanvas();
  }

  // Replay a history delta in the given direction. Every branch mirrors how the
  // original action talked to the room, so the server's copy and every peer
  // (who receives the broadcast) converge on the same state as this canvas.
  private applyHistory(entry: HistoryEntry, dir: "forward" | "backward") {
    if (entry.kind === "add") {
      if (dir === "backward") {
        this.existingShapes = this.existingShapes.filter(
          (s) => s.id !== entry.shape.id
        );
        this.sendErase(entry.shape.id);
      } else {
        this.existingShapes.push(entry.shape);
        this.sendShape(entry.shape);
      }
    } else if (entry.kind === "remove") {
      if (dir === "backward") {
        this.existingShapes.push(entry.shape);
        this.sendShape(entry.shape);
      } else {
        this.existingShapes = this.existingShapes.filter(
          (s) => s.id !== entry.shape.id
        );
        this.sendErase(entry.shape.id);
      }
    } else if (entry.kind === "update") {
      const target = dir === "backward" ? entry.before : entry.after;
      const idx = this.existingShapes.findIndex((s) => s.id === target.id);
      if (idx >= 0) this.existingShapes[idx] = target;
      else this.existingShapes.push(target);
      this.sendShapeUpdate(target);
    } else {
      // kind === "clear"
      if (dir === "backward") {
        this.existingShapes = entry.before.slice();
        for (const s of entry.before) {
          this.sendShape(s);
        }
      } else {
        this.existingShapes = [];
        this.sendClear();
      }
    }
  }

  private updateCursor() {
    if (this.panning) this.canvas.style.cursor = "grabbing";
    else if (this.panTool || this.spaceDown) this.canvas.style.cursor = "grab";
    else if (this.selectedTool === "select") {
      if (this.resizeDrag) {
        this.canvas.style.cursor = CURSOR_RESIZE[this.resizeDrag.handle] ?? "nwse-resize";
      } else if (this.hoveredResizeHandle) {
        this.canvas.style.cursor = CURSOR_RESIZE[this.hoveredResizeHandle] ?? "default";
      } else if (this.hoveredShapeId) {
        // Hovering the shape itself (not a handle) means "grab to move".
        this.canvas.style.cursor = "move";
      } else {
        this.canvas.style.cursor = "default";
      }
    } else if (this.selectedTool === "text") this.canvas.style.cursor = "text";
    else if (this.selectedTool === "laser") this.canvas.style.cursor = this.lasing ? "none" : "";
    else this.canvas.style.cursor = "";
  }

  // Pointer mode, not dragging: figure out what sits under the cursor so the
  // CSS cursor (and any hover highlight) matches — resize handle vs body.
  private updateSelectHover(wx: number, wy: number) {
    const s = this.getSelectedShape();
    const hit = this.shapeAt(wx, wy);
    const hoveredId = hit && this.isOwner(hit) ? hit.id : null;
    let handle: HandleKey | null = null;
    if (hoveredId && s && hoveredId === s.id) {
      handle = this.hitHandle(s.id, wx, wy);
    }
    if (hoveredId !== this.hoveredShapeId || handle !== this.hoveredResizeHandle) {
      this.hoveredShapeId = hoveredId;
      this.hoveredResizeHandle = handle;
      this.updateCursor();
      this.scheduleRedraw();
    }
  }

  private panBy(dxScreen: number, dyScreen: number) {
    this.offsetX -= dxScreen / this.zoom;
    this.offsetY -= dyScreen / this.zoom;
    this.clampView();
    // Coalesce to one scene repaint per animation frame — wheel events fire far
    // faster than the screen refreshes, and every repaint shuffles the grid.
    this.scheduleRedraw();
    this.emitView();
  }

  mouseUpHandler = (e: MouseEvent) => {
    if (this.panning) {
      this.panning = false;
      this.updateCursor();
      return;
    }
    // Laser: releasing the button stops the beam — the trail is left to fade.
    if (this.selectedTool === "laser") {
      this.lasing = false;
      this.updateCursor();
      return;
    }
    if (!this.clicked) return;

    this.clicked = false;

    const { x, y } = this.mapToCanvas(e.clientX, e.clientY);

    if (this.selectedTool === "select") {
      this.dragEngaged = false;
      if (this.resizeDrag) {
        this.recordHistory({
          kind: "update",
          before: this.resizeDrag.origShape,
          after: this.resizeDrag.shape,
        });
        this.sendShapeUpdate(this.resizeDrag.shape);
        this.resizeDrag = null;
        this.hoveredResizeHandle = null;
        this.updateCursor();
        this.clearCanvas();
      } else if (this.moveDrag) {
        this.recordHistory({
          kind: "update",
          before: this.moveDrag.before,
          after: this.moveDrag.shape,
        });
        this.sendShapeUpdate(this.moveDrag.shape);
        this.moveDrag = null;
        this.clearCanvas();
      } else if (this.bandSelect) {
        this.applyBandSelect();
        this.bandSelect = null;
        this.bandCurrent = null;
        this.clearCanvas();
      }
      return;
    }

    if (this.selectedTool === "text") {
      return;
    }

    const width = x - this.startX;
    const height = y - this.startY;

    const selectedTool = this.selectedTool;

    let shape: Shape | null = null;
    const id = newShapeId();

    if (selectedTool === "rect") {
      shape = {
        id,
        type: "rect",
        x: this.startX,
        y: this.startY,
        width: width,
        height: height,
        color: this.strokeColor,
        strokeWidth: this.strokeWidth,
      };
    } else if (selectedTool === "circle") {
      const radius = Math.max(Math.abs(width), Math.abs(height)) / 2;
      shape = {
        id,
        type: "circle",
        radius: radius,
        centerX: this.startX + width / 2,
        centerY: this.startY + height / 2,
        color: this.strokeColor,
        strokeWidth: this.strokeWidth,
      };
    } else if (selectedTool === "pencil") {
      shape = {
        id,
        type: "pencil",
        points: this.points,
        color: this.strokeColor,
        strokeWidth: this.strokeWidth,
      };
      this.points = [];
    } else if (selectedTool === "arrow") {
      shape = {
        id,
        type: "arrow",
        startX: this.startX,
        startY: this.startY,
        endX: x,
        endY: y,
        color: this.strokeColor,
        strokeWidth: this.strokeWidth,
      };
    }

    if (!shape) {
      return;
    }

    if (this.userId) {
      shape.userId = this.userId;
    }

    this.existingShapes.push(shape);
    this.recordHistory({ kind: "add", shape });

    this.socket.send(
      JSON.stringify({
        type: "shape",
        shape,
        roomId: this.roomId,
      })
    );
  };

  mouseDownHandler = (e: MouseEvent) => {
    // Pan: middle button always, left button when a hand/space is engaged.
    if (e.button === 1 || (e.button === 0 && (this.panTool || this.spaceDown))) {
      e.preventDefault();
      this.panning = true;
      this.panLastX = e.clientX;
      this.panLastY = e.clientY;
      this.updateCursor();
      return;
    }
    if (e.button !== 0) {
      return;
    }

    // Did this very mousedown just commit a note? If so the next text action
    // is skipped (React's suppress flag consumes the upcoming onStartText),
    // and we must not immediately re-open the note we just placed.
    const justCommitted = Boolean(this.onPreMouseDown?.());

    const p = this.mapToCanvas(e.clientX, e.clientY);

    // Laser: pressing arms the beam, which then follows the cursor while held.
    if (this.selectedTool === "laser") {
      this.lasing = true;
      this.addLaserPoint(p);
      this.updateCursor();
      return;
    }

    if (this.selectedTool === "select") {
      this.dragStartClient = { x: e.clientX, y: e.clientY };
      this.dragEngaged = false;
      this.startSelectDrag(p);
      return;
    }

    if (this.selectedTool === "text") {
      // Keep focus on the note editor: without this the browser's default
      // mousedown action moves focus to <body>, which blurs the just-opened
      // textarea and fires its onBlur commit the instant it appears.
      e.preventDefault();
      if (!justCommitted) {
        // Clicking an existing note with the text tool edits it in place.
        const hit = this.shapeAt(p.x, p.y);
        if (hit && hit.type === "text" && this.isOwner(hit)) {
          this.onEditText?.(hit);
          return;
        }
      }
      this.selectedShapeId = null;
      this.clearCanvas();
      this.onStartText?.(p.x, p.y);
      return;
    }

    if (this.selectedTool === "eraser") {
      this.eraseShapeAt(p.x, p.y);
      return;
    }

    this.clicked = true;
    this.startX = p.x;
    this.startY = p.y;
    this.points = [{ x: p.x, y: p.y }];
  };

  mouseMoveHandler = (e: MouseEvent) => {
    const p = this.mapToCanvas(e.clientX, e.clientY);
    this.sendPointer(p.x, p.y);
    if (this.panning) {
      this.panBy(e.clientX - this.panLastX, e.clientY - this.panLastY);
      this.panLastX = e.clientX;
      this.panLastY = e.clientY;
      return;
    }
    // Laser pointer: while the button is held the beam follows the cursor and
    // paints no permanent ink; idle, just the dim aiming dot glides along.
    if (this.selectedTool === "laser") {
      if (this.lasing) {
        this.addLaserPoint(p);
      } else {
        this.laserLatest = { x: p.x, y: p.y };
        this.scheduleCursorRedraw();
      }
      return;
    }
    if (this.selectedTool === "select") {
      if (!this.clicked) {
        // Not dragging: hover feedback (resize handles, move affordance).
        this.updateSelectHover(p.x, p.y);
        return;
      }
      if (!this.dragEngaged) {
        // A press that stays put is a click-to-select, not a drag. Wait until
        // the cursor has truly travelled before engaging move/resize so tiny
        // hand wobbles can't nudge the shape.
        const mdx = e.clientX - this.dragStartClient.x;
        const mdy = e.clientY - this.dragStartClient.y;
        if (mdx * mdx + mdy * mdy < CLICK_DRAG_THRESHOLD * CLICK_DRAG_THRESHOLD) {
          this.updateSelectHover(p.x, p.y);
          return;
        }
        this.dragEngaged = true;
        // Re-anchor the move baseline so engaging after the threshold doesn't
        // make the shape jump the distance travelled since the press.
        if (this.moveDrag) this.moveDrag.start = { x: p.x, y: p.y };
        // Lift the shape off the static scene layer now that it will follow the
        // cursor on the drag overlay; subsequent moves only re-composite.
        this.scheduleRedraw();
      }
      if (this.resizeDrag) {
        const lock = this.resizeDrag.shape.type === "image" || e.shiftKey;
        const b = this.computeResizeBounds(
          this.resizeDrag.origBounds,
          this.resizeDrag.handle,
          this.resizeDrag.origin,
          p.x,
          p.y,
          lock
        );
        this.applyBoundsToShape(this.resizeDrag.shape, b, this.resizeDrag.origShape);
        this.updateCursor();
        this.scheduleDragFrame();
        return;
      }
      if (this.moveDrag) {
        this.moveShapeBy(this.moveDrag.shape, p.x - this.moveDrag.start.x, p.y - this.moveDrag.start.y);
        this.moveDrag.start = { x: p.x, y: p.y };
        this.updateCursor();
        this.scheduleDragFrame();
        return;
      }
      if (this.bandSelect) {
        this.bandCurrent = { x: p.x, y: p.y };
        this.scheduleRedraw();
      }
      return;
    }
    if (!this.clicked) {
      if (this.selectedTool === "eraser") this.updateHover(p.x, p.y);
      return;
    }
    const width = p.x - this.startX;
    const height = p.y - this.startY;
    this.clearCanvas();
    this.ctx.strokeStyle = this.strokeColor;
    this.ctx.lineWidth = this.strokeWidth / this.zoom;
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";
    const selectedTool = this.selectedTool;
    if (selectedTool === "rect") {
      this.ctx?.strokeRect(this.startX, this.startY, width, height);
    } else if (selectedTool === "circle") {
      const centerX = this.startX + width / 2;
      const centerY = this.startY + height / 2;
      const radius = Math.max(Math.abs(width), Math.abs(height)) / 2;

      this.ctx.beginPath();
      this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.closePath();
    } else if (selectedTool === "pencil") {
      this.points.push({ x: p.x, y: p.y });
      this.ctx.beginPath();
      this.ctx.moveTo(this.points[0]!.x, this.points[0]!.y);
      for (let i = 1; i < this.points.length; i++) {
        this.ctx.lineTo(this.points[i]!.x, this.points[i]!.y);
      }
      this.ctx.stroke();
      this.ctx.closePath();
    } else if (selectedTool === "arrow") {
      this.drawArrow(
        this.ctx,
        { x: this.startX, y: this.startY },
        { x: p.x, y: p.y },
        this.strokeWidth
      );
    }
  };

  wheelHandler = (e: WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey || e.altKey) {
      // Scroll up zooms in, scroll down zooms out — one notch = ZOOM_FACTOR.
      const anchor = screenPoint(this.canvas, e.clientX, e.clientY);
      const factor = e.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR;
      this.applyZoom(this.zoom * factor, anchor);
    } else {
      // Standard scroll: wheel down → view down → world offset grows.
      this.panBy(-e.deltaX, -e.deltaY);
    }
  };

  spaceDownHandler = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLElement && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
    if (e.code === "Space" && !e.repeat) {
      this.spaceDown = true;
      this.updateCursor();
    } else if (e.key === "Escape" && !e.repeat && this.selectedShapeId) {
      this.selectedShapeId = null;
      this.clearCanvas();
    }
  };

  spaceUpHandler = (e: KeyboardEvent) => {
    if (e.code === "Space") {
      this.spaceDown = false;
      this.updateCursor();
    }
  };

  resetModifiers = () => {
    if (this.lasing) {
      this.lasing = false;
      this.scheduleCursorRedraw();
    }
    if (this.spaceDown || this.panning) {
      this.spaceDown = false;
      this.panning = false;
      this.updateCursor();
    }
  };

  touchStartHandler = (e: TouchEvent) => {
    if (e.touches.length === 1) {
      this.isPinching = false;
      const t = e.touches[0]!;
      this.lastTouchClient = { x: t.clientX, y: t.clientY };
      const fakeEvent = {
        button: 0,
        clientX: t.clientX,
        clientY: t.clientY,
        preventDefault: () => {
          if (e.cancelable) e.preventDefault();
        },
      } as unknown as MouseEvent;
      this.mouseDownHandler(fakeEvent);
    } else if (e.touches.length === 2) {
      this.isPinching = true;
      if (this.clicked) {
        this.clicked = false;
        this.points = [];
        this.clearCanvas();
      }
      const t0 = e.touches[0]!;
      const t1 = e.touches[1]!;
      const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      const midX = (t0.clientX + t1.clientX) / 2;
      const midY = (t0.clientY + t1.clientY) / 2;
      this.touchStartDist = dist;
      this.touchStartZoom = this.zoom;
      this.touchStartMid = screenPoint(this.canvas, midX, midY);
      this.touchLastMid = { x: midX, y: midY };
    }
  };

  touchMoveHandler = (e: TouchEvent) => {
    if (e.cancelable) e.preventDefault();
    if (this.isPinching || e.touches.length >= 2) {
      if (e.touches.length >= 2) {
        const t0 = e.touches[0]!;
        const t1 = e.touches[1]!;
        const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
        const midX = (t0.clientX + t1.clientX) / 2;
        const midY = (t0.clientY + t1.clientY) / 2;

        if (this.touchStartDist > 0) {
          const scale = dist / this.touchStartDist;
          const targetZoom = this.touchStartZoom * scale;
          this.applyZoom(targetZoom, this.touchStartMid);
        }

        const dx = midX - this.touchLastMid.x;
        const dy = midY - this.touchLastMid.y;
        if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
          this.panBy(dx, dy);
          this.touchLastMid = { x: midX, y: midY };
        }
      }
    } else if (e.touches.length === 1 && !this.isPinching) {
      const t = e.touches[0]!;
      this.lastTouchClient = { x: t.clientX, y: t.clientY };
      const fakeEvent = {
        clientX: t.clientX,
        clientY: t.clientY,
        shiftKey: false,
      } as unknown as MouseEvent;
      this.mouseMoveHandler(fakeEvent);
    }
  };

  touchEndHandler = (e: TouchEvent) => {
    if (e.touches.length === 0) {
      if (this.isPinching) {
        this.isPinching = false;
        this.touchStartDist = 0;
      } else {
        const fakeEvent = {
          clientX: this.lastTouchClient.x,
          clientY: this.lastTouchClient.y,
        } as unknown as MouseEvent;
        this.mouseUpHandler(fakeEvent);
      }
    } else if (e.touches.length === 1 && this.isPinching) {
      this.isPinching = false;
      this.touchStartDist = 0;
    }
  };

  initMouseHandlers = () => {
    this.canvas?.addEventListener("mousedown", this.mouseDownHandler);
    this.canvas?.addEventListener("touchstart", this.touchStartHandler, { passive: false });
    this.canvas?.addEventListener("touchmove", this.touchMoveHandler, { passive: false });
    this.canvas?.addEventListener("touchend", this.touchEndHandler, { passive: false });
    this.canvas?.addEventListener("touchcancel", this.touchEndHandler, { passive: false });
    this.canvas?.addEventListener("wheel", this.wheelHandler, { passive: false });
    this.canvas?.addEventListener("mouseleave", this.mouseLeaveHandler);
    window.addEventListener("mousemove", this.mouseMoveHandler);
    window.addEventListener("mouseup", this.mouseUpHandler);
    window.addEventListener("keydown", this.spaceDownHandler);
    window.addEventListener("keyup", this.spaceUpHandler);
    window.addEventListener("blur", this.resetModifiers);
  };

  mouseLeaveHandler = () => {
    if (this.hoveredShapeId === null && this.hoveredResizeHandle === null) return;
    this.hoveredShapeId = null;
    this.hoveredResizeHandle = null;
    this.updateCursor();
    this.scheduleRedraw();
  };
}

function canvasCenter(canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect();
  const cw = rect.width || canvas.clientWidth || 800;
  const ch = rect.height || canvas.clientHeight || 600;
  return { x: cw / 2, y: ch / 2 };
}

// Stable per-stroke identity so an eraser can name the exact line to delete,
// even before the server round-trip for the freshly drawn shape resolves.
function newShapeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

// Shortest Euclidean distance from point (px, py) to segment a–b.
function distToSegment(
  a: { x: number; y: number },
  b: { x: number; y: number },
  px: number,
  py: number
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - a.x, py - a.y);
  let t = ((px - a.x) * dx + (py - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
}

function screenPoint(canvas: HTMLCanvasElement, clientX: number, clientY: number) {
  const rect = canvas.getBoundingClientRect();
  return { x: clientX - rect.left, y: clientY - rect.top };
}

// Stable per-user accent colour derived from their name.
function presenceColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  return `hsl(${h % 360}, 72%, 52%)`;
}
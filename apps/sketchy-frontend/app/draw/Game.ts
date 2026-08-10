import { Tool } from "../components/Canvas";
import { getExistingShapes } from "./http";

export type Shape =
  | {
      id: string;
      type: "rect";
      x: number;
      y: number;
      width: number;
      height: number;
      color: string;
    }
  | {
      id: string;
      type: "circle";
      centerX: number;
      centerY: number;
      radius: number;
      color: string;
    }
  | {
      id: string;
      type: "pencil";
      points: { x: number; y: number }[];
      color: string;
    }
  | {
      id: string;
      type: "arrow";
      startX: number;
      startY: number;
      endX: number;
      endY: number;
      color: string;
    }
  | {
      id: string;
      type: "text";
      x: number;
      y: number;
      text: string;
      fontSize: number;
      color: string;
    }
  | {
      id: string;
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

const FONT_FAMILY = "ui-sans-serif, system-ui, sans-serif";
const TEXT_LINE_HEIGHT = 1.3;
// Default artboard footprint for an image dropped without a drag gesture.
const IMAGE_DEFAULT_WIDTH = 200;
const MIN_SHAPE_DIM = 4;
const HANDLE_SIZE = 8;
const HANDLE_HIT = 8;
const UPDATE_THROTTLE_MS = 60;

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
  private clicked: boolean;
  private startX = 0;
  private startY = 0;
  private points: { x: number; y: number }[] = [];
  private selectedTool: Tool = "circle";
  private strokeColor: string = DEFAULT_COLOR;
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

  // Presence: everyone else's cursors, keyed by userId, with their name.
  private remoteCursors = new Map<string, RemoteCursor>();
  private lastPointerSent = 0;

  // Eraser: id of the shape currently under the cursor, if any.
  private hoveredShapeId: string | null = null;

  // Selection for pointer mode: which shape is grabbed + what drag is happening.
  private selectedShapeId: string | null = null;
  private moveDrag: { shape: Shape; start: { x: number; y: number } } | null = null;
  private resizeDrag: {
    shape: Shape;
    origBounds: Bounds;
    handle: HandleKey;
  } | null = null;
  private bandSelect: { start: { x: number; y: number } } | null = null;
  private bandCurrent: { x: number; y: number } | null = null;
  private lastUpdateSent = 0;
  private imagePlacementCount = 0;

  private imageCache = new Map<string, HTMLImageElement>();

  private onViewChange: ((view: ViewState) => void) | null;
  private onStartText: ((x: number, y: number) => void) | null;
  private onPreMouseDown: (() => void) | null;

  constructor(
    canvas: HTMLCanvasElement,
    roomId: string,
    socket: WebSocket,
    opts: {
      onViewChange?: (view: ViewState) => void;
      onStartText?: (x: number, y: number) => void;
      onPreMouseDown?: () => void;
    } = {}
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.existingShapes = [];
    this.roomId = roomId;
    this.socket = socket;
    this.clicked = false;
    this.onViewChange = opts.onViewChange ?? null;
    this.onStartText = opts.onStartText ?? null;
    this.onPreMouseDown = opts.onPreMouseDown ?? null;
    this.configureCanvas();
    this.initHandlers();
    this.initMouseHandlers();
    // Paint the empty board synchronously so the canvas is visible immediately,
    // long before the network round-trip for existing shapes resolves.
    this.clearCanvas();
    this.init().catch((err) => console.error("init() failed:", err));
  }

  setTool(tool: Tool) {
    this.selectedTool = tool;
    if (tool !== "eraser" && this.hoveredShapeId !== null) {
      this.hoveredShapeId = null;
      this.clearCanvas();
    }
  }

  setColor(color: string) {
    this.strokeColor = color;
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
        type: "image",
        x: cx - width / 2,
        y: cy - height / 2,
        width,
        height,
        dataUrl,
      };
      this.existingShapes.push(shape);
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

  // Text tool: commit a finished editor buffer as a text shape.
  commitText(x: number, y: number, text: string, fontSize: number, color: string) {
    const trimmed = text.trim();
    if (trimmed.length === 0) return;
    const shape: Shape = {
      id: newShapeId(),
      type: "text",
      x,
      y,
      text,
      fontSize,
      color,
    };
    this.addShape(shape);
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

  // Center the board on whatever has been drawn and reset to 1:1.
  fitView() {
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
    this.zoom = 1;
    const cw = this.canvas.clientWidth || 1;
    const ch = this.canvas.clientHeight || 1;
    if (this.existingShapes.length === 0) {
      this.offsetX = 0;
      this.offsetY = 0;
    } else {
      this.offsetX = (minX + maxX) / 2 - cw / 2;
      this.offsetY = (minY + maxY) / 2 - ch / 2;
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
    const cw = this.canvas.clientWidth || 1;
    const ch = this.canvas.clientHeight || 1;
    const halfW = cw / this.zoom / 2;
    const halfH = ch / this.zoom / 2;
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
    this.existingShapes = await getExistingShapes(this.roomId);
    this.clearCanvas();
    // Land the camera on the existing ink, like a real drafting room.
    this.fitView();
  }

  destroy() {
    this.canvas?.removeEventListener("mousedown", this.mouseDownHandler);
    this.canvas?.removeEventListener("wheel", this.wheelHandler);
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
      if (message.type === "shape" && message.shape) {
        this.upsertShape(message.shape);
        this.clearCanvas();
      } else if (message.type === "update" && message.shape) {
        // A room-mate dragged a shape; refresh it in place by id.
        this.upsertShape(message.shape);
        this.clearCanvas();
      } else if (message.type === "clear") {
        this.existingShapes = [];
        this.selectedShapeId = null;
        this.clearCanvas();
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
        this.clearCanvas();
      } else if (message.type === "pointer") {
        this.remoteCursors.set(message.userId, {
          name: message.name,
          x: message.x,
          y: message.y,
        });
        this.clearCanvas();
      } else if (message.type === "presence_members") {
        (message.members || []).forEach((m: { userId: string; name: string; x: number | null; y: number | null }) => {
          this.setRemoteCursor(m.userId, m.name, m.x, m.y);
        });
        this.clearCanvas();
      } else if (message.type === "presence_enter") {
        this.setRemoteCursor(message.userId, message.name, message.x, message.y);
      } else if (message.type === "presence_leave") {
        this.remoteCursors.delete(message.userId);
        this.clearCanvas();
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

  // Throttled pointer telemetry so the room sees our cursor.
  sendPointer(x: number, y: number) {
    const now = Date.now();
    if (now - this.lastPointerSent < 35) return;
    this.lastPointerSent = now;
    this.socket.send(
      JSON.stringify({ type: "pointer", roomId: this.roomId, x, y })
    );
  }

  clearBoard() {
    this.existingShapes = [];
    this.selectedShapeId = null;
    this.clearCanvas();
    this.socket.send(
      JSON.stringify({ type: "clear", roomId: this.roomId })
    );
  }

  private addShape(shape: Shape) {
    this.existingShapes.push(shape);
    this.socket.send(
      JSON.stringify({ type: "shape", shape, roomId: this.roomId })
    );
  }

  // Eraser: remove whatever shape is under a world-space point and tell the
  // room so the deletion lands for everyone at the same time.
  private eraseShapeAt(wx: number, wy: number) {
    const target = this.shapeAt(wx, wy);
    if (!target) return;
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
      const size = this.textSize(s.text, s.fontSize);
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
      const head = this.arrowHead(b, a);
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

  clearCanvas() {
    const w = this.canvas.clientWidth || 1;
    const h = this.canvas.clientHeight || 1;
    // Paper stays screen-fixed; only grid + ink are transformed.
    this.ctx?.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    this.ctx.clearRect(0, 0, w, h);
    this.ctx.fillStyle = "#f8f6f1";
    this.ctx.fillRect(0, 0, w, h);

    this.applyWorldTransform();
    this.drawGrid(w, h);

    this.existingShapes.map((shape) => {
      this.drawShape(shape);
    });

    // In eraser mode, flag the line under the cursor before it is erased.
    this.drawHoveredShape();
    // In pointer mode, frame the picked shape with resize handles.
    this.drawSelection();

    // Pointer-mode rubber band while box-selecting.
    this.drawBand();

    // Presence cursors live in screen space on top of the paper.
    this.drawRemoteCursors();

    // The caller (in-progress drag previews) draws in world space, so always
    // leave the context in the world transform — never a leaked screen one.
    this.applyWorldTransform();
  }

  private drawRemoteCursors() {
    if (this.remoteCursors.size === 0) return;
    const cw = this.canvas.clientWidth || 1;
    const ch = this.canvas.clientHeight || 1;
    this.ctx.save();
    this.ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    this.remoteCursors.forEach((c) => {
      if (c.x === null || c.y === null) return;
      const sx = (c.x - this.offsetX) * this.zoom;
      const sy = (c.y - this.offsetY) * this.zoom;
      if (sx < -60 || sx > cw + 60 || sy < -40 || sy > ch + 40) return;
      this.drawPresenceCursor(sx, sy, c.name);
    });
    this.ctx.restore();
  }

  private drawPresenceCursor(sx: number, sy: number, name: string) {
    const color = presenceColor(name);
    this.ctx.fillStyle = color;
    // Cursor arrow, tip at (sx, sy).
    this.ctx.beginPath();
    this.ctx.moveTo(sx, sy);
    this.ctx.lineTo(sx + 12, sy + 15);
    this.ctx.lineTo(sx + 8, sy + 16);
    this.ctx.lineTo(sx + 10, sy + 24);
    this.ctx.lineTo(sx + 6.5, sy + 23);
    this.ctx.lineTo(sx + 4.5, sy + 17);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.strokeStyle = "rgba(255,255,255,0.9)";
    this.ctx.lineWidth = 1;
    this.ctx.stroke();

    // Name pill plate.
    const label = name || "guest";
    const px = sx + 16;
    const py = sy + 12;
    this.ctx.font = "600 12px ui-sans-serif, system-ui, sans-serif";
    const text = label;
    const textW = this.ctx.measureText(text).width;
    const pillW = textW + 12 + 20;
    const pillH = 20;
    this.ctx.fillStyle = "rgba(28, 28, 36, 0.92)";
    this.ctx.beginPath();
    this.ctx.roundRect(px, py, pillW, pillH, 6);
    this.ctx.fill();

    // Initial chip.
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(px + 10, py + pillH / 2, 7, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.fillStyle = "#fff";
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    this.ctx.fillText(label.charAt(0).toUpperCase(), px + 10, py + pillH / 2 + 0.5);
    this.ctx.textAlign = "left";
    this.ctx.textBaseline = "alphabetic";
    this.ctx.fillText(text, px + 24, py + 14);
  }

  private applyWorldTransform() {
    const s = this.scale * this.zoom;
    this.ctx.setTransform(s, 0, 0, s, -this.offsetX * s, -this.offsetY * s);
  }

  private drawGrid(w: number, h: number) {
    const top = this.offsetY;
    const bottom = this.offsetY + h / this.zoom;
    const left = this.offsetX;
    const right = this.offsetX + w / this.zoom;
    this.ctx.strokeStyle = "rgba(24, 24, 26, 0.05)";
    this.ctx.lineWidth = 1 / this.zoom;
    for (let x = Math.floor(left / GRID_STEP) * GRID_STEP; x <= right; x += GRID_STEP) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, top);
      this.ctx.lineTo(x, bottom);
      this.ctx.stroke();
    }
    for (let y = Math.floor(top / GRID_STEP) * GRID_STEP; y <= bottom; y += GRID_STEP) {
      this.ctx.beginPath();
      this.ctx.moveTo(left, y);
      this.ctx.lineTo(right, y);
      this.ctx.stroke();
    }
    // The finite edge of the board — a faint drafting frame.
    this.ctx.strokeStyle = "rgba(24, 24, 26, 0.12)";
    this.ctx.lineWidth = 2 / this.zoom;
    this.ctx.strokeRect(
      -WORLD_LIMIT,
      -WORLD_LIMIT,
      WORLD_LIMIT * 2,
      WORLD_LIMIT * 2
    );
  }

  private drawShape(shape: Shape) {
    this.ctx.strokeStyle = "color" in shape ? shape.color : DEFAULT_COLOR;
    this.ctx.lineWidth = 2 / this.zoom;
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";
    if (shape.type === "rect") {
      this.ctx?.strokeRect(shape.x, shape.y, shape.width, shape.height);
    } else if (shape.type === "circle") {
      this.ctx.beginPath();
      this.ctx.arc(shape.centerX, shape.centerY, shape.radius, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.closePath();
    } else if (shape.type === "pencil") {
      if (shape.points.length < 2) {
        return;
      }
      this.ctx.beginPath();
      this.ctx.moveTo(shape.points[0]!.x, shape.points[0]!.y);
      for (let i = 1; i < shape.points.length; i++) {
        this.ctx.lineTo(shape.points[i]!.x, shape.points[i]!.y);
      }
      this.ctx.stroke();
      this.ctx.closePath();
    } else if (shape.type === "arrow") {
      this.drawArrow(
        { x: shape.startX, y: shape.startY },
        { x: shape.endX, y: shape.endY }
      );
    } else if (shape.type === "text") {
      this.ctx.fillStyle = shape.color || DEFAULT_COLOR;
      this.drawText(shape.text, shape.x, shape.y, shape.fontSize);
    } else if (shape.type === "image") {
      const img = this.imageFor(shape.dataUrl);
      if (img && img.naturalWidth > 0) {
        try {
          this.ctx.drawImage(img, shape.x, shape.y, shape.width, shape.height);
        } catch {
          // Data URL failed to decode; skip quietly.
        }
      }
    }
  }

  // Two feathered back-edges that make the arrowhead at the tip.
  private arrowHead(end: { x: number; y: number }, start: { x: number; y: number }) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const len = Math.hypot(dx, dy);
    const ux = len < 1e-6 ? 1 : dx / len;
    const uy = len < 1e-6 ? 0 : dy / len;
    const headLen = 14;
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
    return { a, b };
  }

  // Shaft plus a solid, filled arrowhead at the tip.
  private drawArrow(start: { x: number; y: number }, end: { x: number; y: number }) {
    this.ctx.beginPath();
    this.ctx.moveTo(start.x, start.y);
    this.ctx.lineTo(end.x, end.y);
    this.ctx.stroke();
    const head = this.arrowHead(end, start);
    this.ctx.fillStyle = this.ctx.strokeStyle;
    this.ctx.beginPath();
    this.ctx.moveTo(end.x, end.y);
    this.ctx.lineTo(head.a.x, head.a.y);
    this.ctx.lineTo(head.b.x, head.b.y);
    this.ctx.closePath();
    this.ctx.fill();
  }

  private drawText(text: string, x: number, y: number, fontSize: number) {
    this.ctx.font = `${fontSize}px ${FONT_FAMILY}`;
    this.ctx.textBaseline = "top";
    this.ctx.textAlign = "left";
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      this.ctx.fillText(lines[i]!, x, y + i * fontSize * TEXT_LINE_HEIGHT);
    }
  }

  private textSize(text: string, fontSize: number): { width: number; height: number } {
    this.ctx.font = `${fontSize}px ${FONT_FAMILY}`;
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

  private drawHoveredShape() {
    const s = this.existingShapes.find((x) => x.id === this.hoveredShapeId);
    if (!s) return;
    this.ctx.save();
    this.ctx.strokeStyle = "rgba(224, 49, 49, 0.95)";
    this.ctx.fillStyle = "rgba(224, 49, 49, 0.1)";
    this.ctx.lineWidth = 3 / this.zoom;
    this.ctx.setLineDash([7 / this.zoom, 5 / this.zoom]);
    if (s.type === "rect") {
      this.ctx.fillRect(s.x, s.y, s.width, s.height);
      this.ctx.strokeRect(s.x, s.y, s.width, s.height);
    } else if (s.type === "circle") {
      this.ctx.beginPath();
      this.ctx.arc(s.centerX, s.centerY, s.radius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();
      this.ctx.closePath();
    } else if (s.type === "pencil") {
      if (s.points.length >= 2) {
        this.ctx.beginPath();
        this.ctx.moveTo(s.points[0]!.x, s.points[0]!.y);
        for (let i = 1; i < s.points.length; i++) {
          this.ctx.lineTo(s.points[i]!.x, s.points[i]!.y);
        }
        this.ctx.stroke();
        this.ctx.closePath();
      }
    } else if (s.type === "arrow") {
      const start = { x: s.startX, y: s.startY };
      const end = { x: s.endX, y: s.endY };
      this.ctx.beginPath();
      this.ctx.moveTo(start.x, start.y);
      this.ctx.lineTo(end.x, end.y);
      this.ctx.lineTo(this.arrowHead(end, start).a.x, this.arrowHead(end, start).a.y);
      this.ctx.moveTo(end.x, end.y);
      this.ctx.lineTo(this.arrowHead(end, start).b.x, this.arrowHead(end, start).b.y);
      this.ctx.stroke();
      this.ctx.closePath();
    } else if (s.type === "text") {
      const size = this.textSize(s.text, s.fontSize);
      this.ctx.fillRect(s.x, s.y, size.width, size.height);
      this.ctx.strokeRect(s.x, s.y, size.width, size.height);
    } else if (s.type === "image") {
      this.ctx.fillRect(s.x, s.y, s.width, s.height);
      this.ctx.strokeRect(s.x, s.y, s.width, s.height);
    }
    this.ctx.restore();
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
      const size = this.textSize(s.text, s.fontSize);
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
    if (hit) {
      if (this.selectedShapeId === hit.id) {
        const handle = this.hitHandle(hit.id, p.x, p.y);
        if (handle) {
          this.resizeDrag = {
            shape: hit,
            origBounds: this.shapeBounds(hit),
            handle,
          };
          this.clicked = true;
          this.clearCanvas();
          return;
        }
      }
      this.selectedShapeId = hit.id;
      this.moveDrag = { shape: hit, start: { x: p.x, y: p.y } };
      this.clicked = true;
    } else {
      this.selectedShapeId = null;
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

  private drawSelection() {
    const s = this.getSelectedShape();
    if (!s) return;
    const b = this.shapeBounds(s);
    const handle = this.handlePositions(b);
    this.ctx.save();
    this.ctx.setLineDash([6 / this.zoom, 4 / this.zoom]);
    this.ctx.strokeStyle = "#2f6bff";
    this.ctx.lineWidth = 1.5 / this.zoom;
    this.ctx.strokeRect(b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY);
    this.ctx.restore();

    const size = HANDLE_SIZE / this.zoom;
    for (const pos of handle) {
      this.ctx.save();
      this.ctx.fillStyle = "#ffffff";
      this.ctx.strokeStyle = "#2f6bff";
      this.ctx.lineWidth = 1.5 / this.zoom;
      this.ctx.fillRect(pos.x - size / 2, pos.y - size / 2, size, size);
      this.ctx.strokeRect(pos.x - size / 2, pos.y - size / 2, size, size);
      this.ctx.restore();
    }
  }

  private computeResizeBounds(
    orig: Bounds,
    handle: HandleKey,
    mx: number,
    my: number,
    lockAspect: boolean
  ): Bounds {
    const dMinX = handle.includes("w");
    const dMaxX = handle.includes("e");
    const dMinY = handle.includes("n");
    const dMaxY = handle.includes("s");
    let minX = orig.minX;
    let maxX = orig.maxX;
    let minY = orig.minY;
    let maxY = orig.maxY;
    if (dMinX) minX = mx;
    if (dMaxX) maxX = mx;
    if (dMinY) minY = my;
    if (dMaxY) maxY = my;
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

  private applyBoundsToShape(s: Shape, b: Bounds, orig: Bounds) {
    if (s.type === "rect" || s.type === "image") {
      s.x = b.minX;
      s.y = b.minY;
      s.width = b.maxX - b.minX;
      s.height = b.maxY - b.minY;
    } else if (s.type === "circle") {
      const scale = (b.maxX - b.minX) / (orig.maxX - orig.minX || 1);
      s.radius = Math.max(MIN_SHAPE_DIM / 2, s.radius * scale);
      s.centerX = (b.minX + b.maxX) / 2;
      s.centerY = (b.minY + b.maxY) / 2;
    } else if (s.type === "arrow") {
      const ow = orig.maxX - orig.minX || 1;
      const oh = orig.maxY - orig.minY || 1;
      const nw = b.maxX - b.minX;
      const nh = b.maxY - b.minY;
      s.startX = b.minX + ((s.startX - orig.minX) / ow) * nw;
      s.startY = b.minY + ((s.startY - orig.minY) / oh) * nh;
      s.endX = b.minX + ((s.endX - orig.minX) / ow) * nw;
      s.endY = b.minY + ((s.endY - orig.minY) / oh) * nh;
    } else if (s.type === "text") {
      const scale = (b.maxX - b.minX) / (orig.maxX - orig.minX || 1);
      s.fontSize = Math.max(8, Math.round(s.fontSize * scale));
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

  private drawBand() {
    if (!this.bandSelect || !this.bandCurrent) return;
    const b = this.bandBox();
    this.ctx.save();
    this.ctx.fillStyle = "rgba(47, 107, 255, 0.08)";
    this.ctx.strokeStyle = "#2f6bff";
    this.ctx.lineWidth = 1.5 / this.zoom;
    this.ctx.setLineDash([5 / this.zoom, 3 / this.zoom]);
    this.ctx.fillRect(b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY);
    this.ctx.strokeRect(b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY);
    this.ctx.restore();
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

  private broadcastUpdate(shape: Shape) {
    const now = Date.now();
    if (now - this.lastUpdateSent < UPDATE_THROTTLE_MS) return;
    this.lastUpdateSent = now;
    this.sendShapeUpdate(shape);
  }

  private updateCursor() {
    if (this.panning) this.canvas.style.cursor = "grabbing";
    else if (this.panTool || this.spaceDown) this.canvas.style.cursor = "grab";
    else if (this.selectedTool === "select" && this.resizeDrag) this.canvas.style.cursor = "nwse-resize";
    else if (this.selectedTool === "select") this.canvas.style.cursor = "default";
    else this.canvas.style.cursor = "";
  }

  private panBy(dxScreen: number, dyScreen: number) {
    this.offsetX -= dxScreen / this.zoom;
    this.offsetY -= dyScreen / this.zoom;
    this.clampView();
    this.clearCanvas();
    this.emitView();
  }

  mouseUpHandler = (e: MouseEvent) => {
    if (this.panning) {
      this.panning = false;
      this.updateCursor();
      return;
    }
    if (!this.clicked) return;

    this.clicked = false;

    const { x, y } = this.mapToCanvas(e.clientX, e.clientY);

    if (this.selectedTool === "select") {
      if (this.resizeDrag) {
        this.sendShapeUpdate(this.resizeDrag.shape);
        this.resizeDrag = null;
        this.updateCursor();
        this.clearCanvas();
      } else if (this.moveDrag) {
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
      };
    } else if (selectedTool === "pencil") {
      shape = {
        id,
        type: "pencil",
        points: this.points,
        color: this.strokeColor,
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
      };
    }

    if (!shape) {
      return;
    }

    this.existingShapes.push(shape);

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

    this.onPreMouseDown?.();

    const p = this.mapToCanvas(e.clientX, e.clientY);

    if (this.selectedTool === "select") {
      this.startSelectDrag(p);
      return;
    }

    if (this.selectedTool === "text") {
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
    if (this.selectedTool === "select") {
      if (!this.clicked) return;
      if (this.resizeDrag) {
        const lock = this.resizeDrag.shape.type === "image" || e.shiftKey;
        const b = this.computeResizeBounds(
          this.resizeDrag.origBounds,
          this.resizeDrag.handle,
          p.x,
          p.y,
          lock
        );
        this.applyBoundsToShape(this.resizeDrag.shape, b, this.resizeDrag.origBounds);
        this.updateCursor();
        this.clearCanvas();
        this.broadcastUpdate(this.resizeDrag.shape);
        return;
      }
      if (this.moveDrag) {
        this.moveShapeBy(this.moveDrag.shape, p.x - this.moveDrag.start.x, p.y - this.moveDrag.start.y);
        this.moveDrag.start = { x: p.x, y: p.y };
        this.clearCanvas();
        this.broadcastUpdate(this.moveDrag.shape);
        return;
      }
      if (this.bandSelect) {
        this.bandCurrent = { x: p.x, y: p.y };
        this.clearCanvas();
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
    this.ctx.lineWidth = 2 / this.zoom;
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
        { x: this.startX, y: this.startY },
        { x: p.x, y: p.y }
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
    if (this.spaceDown || this.panning) {
      this.spaceDown = false;
      this.panning = false;
      this.updateCursor();
    }
  };

  initMouseHandlers = () => {
    this.canvas?.addEventListener("mousedown", this.mouseDownHandler);
    this.canvas?.addEventListener("wheel", this.wheelHandler, { passive: false });
    window.addEventListener("mousemove", this.mouseMoveHandler);
    window.addEventListener("mouseup", this.mouseUpHandler);
    window.addEventListener("keydown", this.spaceDownHandler);
    window.addEventListener("keyup", this.spaceUpHandler);
    window.addEventListener("blur", this.resetModifiers);
  };
}

function canvasCenter(canvas: HTMLCanvasElement) {
  return { x: (canvas.clientWidth || 1) / 2, y: (canvas.clientHeight || 1) / 2 };
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
import { Tool } from "../components/Canvas";
import { getExistingShapes } from "./http";

export type Shape =
  | {
      type: "rect";
      x: number;
      y: number;
      width: number;
      height: number;
      color: string;
    }
  | {
      type: "circle";
      centerX: number;
      centerY: number;
      radius: number;
      color: string;
    }
  | {
      type: "pencil";
      points: { x: number; y: number }[];
      color: string;
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

// View state for the infinite drafting table: zoom + world-space pan offset.
export interface ViewState {
  zoom: number;
  offsetX: number;
  offsetY: number;
}

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;
const ZOOM_FACTOR = 1.12;
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

  private onViewChange: ((view: ViewState) => void) | null;

  constructor(
    canvas: HTMLCanvasElement,
    roomId: string,
    socket: WebSocket,
    opts: { onViewChange?: (view: ViewState) => void } = {}
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.existingShapes = [];
    this.roomId = roomId;
    this.socket = socket;
    this.clicked = false;
    this.onViewChange = opts.onViewChange ?? null;
    this.configureCanvas();
    this.initHandlers();
    this.initMouseHandlers();
    // Paint the empty board synchronously so the canvas is visible immediately,
    // long before the network round-trip for existing shapes resolves.
    this.clearCanvas();
    this.init().catch((err) => console.error("init() failed:", err));
  }

  setTool(tool: "rect" | "circle" | "pencil") {
    this.selectedTool = tool;
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
        this.existingShapes.push(message.shape);
        this.clearCanvas();
      } else if (message.type === "clear") {
        this.existingShapes = [];
        this.clearCanvas();
      }
    };
  }

  clearBoard() {
    this.existingShapes = [];
    this.clearCanvas();
    this.socket.send(
      JSON.stringify({ type: "clear", roomId: this.roomId })
    );
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
    this.ctx.strokeStyle = shape.color || DEFAULT_COLOR;
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
    }
  }

  private shapeBounds(s: Shape) {
    if (s.type === "rect") {
      return { minX: s.x, minY: s.y, maxX: s.x + s.width, maxY: s.y + s.height };
    }
    if (s.type === "circle") {
      return {
        minX: s.centerX - s.radius,
        minY: s.centerY - s.radius,
        maxX: s.centerX + s.radius,
        maxY: s.centerY + s.radius,
      };
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

  private updateCursor() {
    if (this.panning) this.canvas.style.cursor = "grabbing";
    else if (this.panTool || this.spaceDown) this.canvas.style.cursor = "grab";
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
    const width = x - this.startX;
    const height = y - this.startY;

    const selectedTool = this.selectedTool;

    let shape: Shape | null = null;

    if (selectedTool === "rect") {
      shape = {
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
        type: "circle",
        radius: radius,
        centerX: this.startX + width / 2,
        centerY: this.startY + height / 2,
        color: this.strokeColor,
      };
    } else if (selectedTool === "pencil") {
      shape = {
        type: "pencil",
        points: this.points,
        color: this.strokeColor,
      };
      this.points = [];
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

    this.clicked = true;
    const p = this.mapToCanvas(e.clientX, e.clientY);
    this.startX = p.x;
    this.startY = p.y;
    this.points = [{ x: p.x, y: p.y }];
  };

  mouseMoveHandler = (e: MouseEvent) => {
    if (this.panning) {
      this.panBy(e.clientX - this.panLastX, e.clientY - this.panLastY);
      this.panLastX = e.clientX;
      this.panLastY = e.clientY;
      return;
    }
    if (!this.clicked) {
      return;
    }
    const p = this.mapToCanvas(e.clientX, e.clientY);
    const width = p.x - this.startX;
    const height = p.y - this.startY;
    this.clearCanvas();
    this.ctx.strokeStyle = this.strokeColor;
    this.ctx.lineWidth = 2 / this.zoom;
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
    }
  };

  wheelHandler = (e: WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey || e.altKey) {
      const anchor = screenPoint(this.canvas, e.clientX, e.clientY);
      const factor = e.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR;
      this.applyZoom(this.zoom * factor, anchor);
    } else {
      // Standard scroll: wheel down → view down → world offset grows.
      this.panBy(-e.deltaX, -e.deltaY);
    }
  };

  spaceDownHandler = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLElement && e.target.tagName === "INPUT") return;
    if (e.code === "Space" && !e.repeat) {
      this.spaceDown = true;
      this.updateCursor();
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

function screenPoint(canvas: HTMLCanvasElement, clientX: number, clientY: number) {
  const rect = canvas.getBoundingClientRect();
  return { x: clientX - rect.left, y: clientY - rect.top };
}
import { Tool } from "../components/Canvas";
import { getExistingShapes } from "./http";

export type Shape =
  | {
      type: "rect";
      x: number;
      y: number;
      width: number;
      height: number;
    }
  | {
      type: "circle";
      centerX: number;
      centerY: number;
      radius: number;
    }
  | {
      type: "pencil";
      points: { x: number; y: number }[];
    };

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
  private scale = 1;

  constructor(canvas: HTMLCanvasElement, roomId: string, socket: WebSocket) {
    this.canvas = canvas;
    this.ctx = canvas?.getContext("2d")!;
    this.existingShapes = [];
    this.roomId = roomId;
    this.socket = socket;
    this.clicked = false;
    this.configureCanvas();
    this.initHandlers();
    this.initMouseHandlers();
    this.init(); // Move this to the end so roomId is set before init() runs
  }

  setTool(tool: "rect" | "circle" | "pencil") {
    this.selectedTool = tool;
  }

  // Map viewport client coords to actual canvas pixels (handles DPR + offset/scaling)
  private mapToCanvas(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const x = (clientX - rect.left) * this.scale;
    const y = (clientY - rect.top) * this.scale;
    return { x, y };
  }

  private configureCanvas() {
    this.scale = window.devicePixelRatio || 1;
    const width = this.canvas.clientWidth || this.canvas.width;
    const height = this.canvas.clientHeight || this.canvas.height;
    this.canvas.width = width * this.scale;
    this.canvas.height = height * this.scale;
    this.ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
  }

  async init() {
    this.existingShapes = await getExistingShapes(this.roomId);
    this.clearCanvas();
  }

  destroy() {
    this.canvas?.removeEventListener("mousedown", this.mouseDownHandler);
    this.canvas?.removeEventListener("mouseup", this.mouseUpHandler);
    this.canvas?.removeEventListener("mousemove", this.mouseMoveHandler);
  }

  initHandlers() {
    this.socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "shape" && message.shape) {
        this.existingShapes.push(message.shape);
        this.clearCanvas();
      }
    };
  }

  clearCanvas() {
    this.ctx?.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = "rgba(0, 0, 0)";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.existingShapes.map((shape) => {
      this.drawShape(shape);
    });
  }

  private drawShape(shape: Shape) {
    this.ctx.strokeStyle = "rgba(255, 255, 255)";
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

  mouseUpHandler = (e: MouseEvent) => {
    this.clicked = false;

    const { x, y } = this.mapToCanvas(e.clientX, e.clientY);
    let width = x - this.startX;
    let height = y - this.startY;

    const selectedTool = this.selectedTool;

    let shape: Shape | null = null;

    if (selectedTool === "rect") {
      shape = {
        type: "rect",
        x: this.startX,
        y: this.startY,
        width: width,
        height: height,
      };
    } else if (selectedTool === "circle") {
      const radius = Math.max(Math.abs(width), Math.abs(height)) / 2;
      shape = {
        type: "circle",
        radius: radius,
        centerX: this.startX + width / 2,
        centerY: this.startY + height / 2,
      };
    } else if (selectedTool === "pencil") {
      shape = {
        type: "pencil",
        points: this.points,
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
    this.clicked = true;
    const p = this.mapToCanvas(e.clientX, e.clientY);
    this.startX = p.x;
    this.startY = p.y;
    this.points = [{ x: p.x, y: p.y }];
  };

  mouseMoveHandler = (e: MouseEvent) => {
    if (this.clicked) {
      const p = this.mapToCanvas(e.clientX, e.clientY);
      let width = p.x - this.startX;
      let height = p.y - this.startY;
      this.clearCanvas();
      this.ctx.strokeStyle = "rgba(255, 255, 255)";
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
    }
  };

  initMouseHandlers = () => {
    this.canvas?.addEventListener("mousedown", this.mouseDownHandler);
    this.canvas?.addEventListener("mouseup", this.mouseUpHandler);
    this.canvas?.addEventListener("mousemove", this.mouseMoveHandler);
  };
}
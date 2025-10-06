import { useRef, useEffect } from "react";
import initDraw from "../draw/index";

export default function Canvas({ roomId, socket }: { roomId: string, socket: WebSocket }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      initDraw(canvasRef.current, roomId, socket);
    }
  }, [canvasRef]);

  return (
    <div>
      <canvas
        className="bg-neutral-300 "
        ref={canvasRef}
        width={1439}
        height={810}
      ></canvas>
      <div
        className="absolute top-0 left-0 bg-neutral-300
      text-black"
      >
        <button>rectangle</button> &nbsp; &nbsp;
        <button>circle</button>
      </div>
    </div>
  );
}

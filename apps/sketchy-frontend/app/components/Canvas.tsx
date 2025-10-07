import { useRef, useEffect, useState } from "react";
import initDraw from "../draw/index";
import { IconButton } from "../components/IconButton"
import { Circle, Pencil, RectangleHorizontal } from "lucide-react";

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
      <TopBar/>
    </div>
  );
}


function TopBar () {

  type Shape = "pencil" | "rect" | "circle";

  const [selectedTool, setSelectedTool] = useState<Shape>("pencil");

  useEffect(() => {
    //@ts-ignore
    window.selectedTool = selectedTool
  },[selectedTool])

  return (
    <div
      className="absolute top-4 left-165  flex gap-4
      text-black"
    >
      <IconButton
        activated={selectedTool === "pencil"}
        icon={<Pencil />}
        onClick={() => {
          setSelectedTool("pencil");
        }}
      />
      <IconButton
        activated={selectedTool === "rect"}
        icon={<RectangleHorizontal />}
        onClick={() => {
          setSelectedTool("rect");
        }}
      />
      <IconButton
        activated={selectedTool === "circle"}
        icon={<Circle />}
        onClick={() => {
          setSelectedTool("circle");
        }}
      />
    </div>
  );
}
import { useRef, useEffect, useState } from "react";
import initDraw from "../draw/index";
import { IconButton } from "../components/IconButton";
import { Circle, Pencil, RectangleHorizontal } from "lucide-react";
import { Game } from "../draw/Game";

export default function Canvas({
  roomId,
  socket,
}: {
  roomId: string;
  socket: WebSocket;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedTool, setSelectedTool] = useState<Tool>("pencil");
  const [game, setGame] = useState<Game>();

  useEffect(() => {
    if (canvasRef.current) {
      const g = new Game(canvasRef.current, roomId, socket);
      setGame(g);

       return () => {
         g.destroy();
       };

    }
  }, [canvasRef]);

  useEffect(() => {
    game?.setTool(selectedTool)
  }, [selectedTool, game]);

  return (
    <div>
      <canvas
        className="bg-neutral-300 "
        ref={canvasRef}
        width={1439}
        height={810}
      ></canvas>
      <TopBar selectedTool={selectedTool} setSelectedTool={setSelectedTool} />
    </div>
  );
}

export type Tool = "pencil" | "rect" | "circle";

interface TopBarProps {
  selectedTool: Tool;
  setSelectedTool: (tool: Tool) => void;
}

function TopBar({ selectedTool, setSelectedTool }: TopBarProps) {
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

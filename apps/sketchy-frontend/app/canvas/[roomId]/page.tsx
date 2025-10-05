"use client";

import { useEffect, useRef } from "react";

export default function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");

    let clicked = false;
    let startX = 0;
    let startY = 0;

    canvas?.addEventListener("mousedown", (e) => {
      clicked = true;
      startX = e.clientX;
      startY = e.clientY;
    });

    canvas?.addEventListener("mouseup", (e) => {
      clicked = false;
    });

    canvas?.addEventListener("mousemove", (e) => {
      let width = e.clientX - startX;
      let height = e.clientY - startY;

      if (clicked) {
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
        ctx?.strokeRect(startX, startY, width, height);
      }
    });
  }, [canvasRef]);

  return (
    <div>
      <canvas
        className="bg-neutral-300 "
        ref={canvasRef}
        width={1000}
        height={1000}
      ></canvas>
    </div>
  );
}

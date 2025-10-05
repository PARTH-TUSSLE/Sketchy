type Shape =
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
    };

export default function initDraw(canvas: HTMLCanvasElement) {
  const ctx = canvas?.getContext("2d");
  let existingShapes: Shape[] = [];

  if (!ctx || !canvas) {
    return;
  }

  ctx.fillStyle = "rgba(0, 0, 0)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

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

    let width = e.clientX - startX;
    let height = e.clientY - startY;

    existingShapes.push({
      type: "rect",
      x: startX,
      y: startY,
      width: width,
      height: height,
    });
  });

  canvas?.addEventListener("mousemove", (e) => {


    if (clicked) {
          let width = e.clientX - startX;
          let height = e.clientY - startY;
          clearCanvas(existingShapes, ctx, canvas);
          ctx.strokeStyle = "rgba(255, 255, 255)";
          ctx?.strokeRect(startX, startY, width, height); 
    }
  });
}

function clearCanvas(
  existingShapes: Shape[],
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement
) {
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "rgba(0, 0, 0)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      existingShapes.map( ( shape ) => {
        if (shape.type === "rect") {
          ctx.strokeStyle = "rgba(255, 255, 255)";
          ctx?.strokeRect(shape.x, shape.y, shape.width, shape.height);          
        }
      } )

}

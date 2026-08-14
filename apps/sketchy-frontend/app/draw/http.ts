import axios from "axios";
import { BACKEND_URL } from "../config";
import { getToken } from "../lib/auth";
import { Shape } from "./Game";

export const DEFAULT_PAPER = "#f8f6f1";

export async function getExistingShapes(roomId: string): Promise<{
  shapes: Shape[];
  backgroundColor: string;
}> {
  const token = getToken();

  const res = await axios.get(`${BACKEND_URL}/shapes/${roomId}`, {
    headers: token ? { Authorization: token } : {},
  });

  const shapes = (res.data.shapes || []) as {
    id: number;
    type: string;
    payload: Shape;
  }[];

  // Backfill a stable identity for shapes persisted before the eraser existed
  // (their payload has no id) using the row's own numeric id — otherwise the
  // eraser would mistake every legacy shape for "the same shapeless line" and
  // wipe the whole board in one click.
  return {
    shapes: shapes.map((s) => {
      const payload = s.payload;
      if (typeof payload.id === "string" && payload.id.length > 0) return payload;
      return { ...payload, id: String(s.id) };
    }),
    backgroundColor:
      typeof res.data.backgroundColor === "string" && res.data.backgroundColor.length > 0
        ? res.data.backgroundColor
        : DEFAULT_PAPER,
  };
}
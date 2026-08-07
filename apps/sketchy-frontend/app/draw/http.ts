import axios from "axios";
import { BACKEND_URL } from "../config";
import { getToken } from "../lib/auth";
import { Shape } from "./Game";

export async function getExistingShapes(roomId: string): Promise<Shape[]> {
  const token = getToken();

  const res = await axios.get(`${BACKEND_URL}/shapes/${roomId}`, {
    headers: token ? { Authorization: token } : {},
  });

  const shapes = (res.data.shapes || []) as {
    id: number;
    type: string;
    payload: Shape;
  }[];

  return shapes.map((s) => s.payload);
}
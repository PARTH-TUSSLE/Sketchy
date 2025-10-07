import axios from "axios";
import { BACKEND_URL } from "../config";

export async function getExistingShapes(roomId: string) {
  const res = await axios.get(`${BACKEND_URL}/chats/${roomId}`);
  const messages = res.data.messages || [];

  const shapes = messages
    .map((x: { message: string }) => {
      try {
        const messageData = JSON.parse(x.message);
        return messageData.shape;
      } catch {
        return null;
      }
    })
    .filter((shape: any) => shape !== null);

  return shapes;
}

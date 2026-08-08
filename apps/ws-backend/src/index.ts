import { WebSocket } from "ws";
import { WebSocketServer } from "ws";
import { JwtPayload } from "jsonwebtoken";
import Jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { prismaClient } from "@repo/db/client";
import { getJwtSecret } from "@repo/backend-common/config";
import { ChatMessageSchema } from "@repo/common/types";
import { joinRoom, leaveRoom } from "./rooms.js";
import type { User } from "./rooms.js";

dotenv.config({ path: new URL("../../../.env", import.meta.url) });

const wss = new WebSocketServer({ port: 8000 });

const HEARTBEAT_INTERVAL_MS = 30_000;

const users: User[] = [];

function checkUser(token: string): string | null {
  try {
    const decoded = Jwt.verify(token, getJwtSecret()) as JwtPayload;

    if (!decoded || typeof decoded.userId !== "string") {
      return null;
    }

    return decoded.userId;
  } catch (e) {
    return null;
  }
}

function toRoomId(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isInteger(value) && value > 0 ? value : null;
  }
  if (typeof value === "string" && !isNaN(Number(value))) {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
  }
  return null;
}

wss.on("connection", function connection(ws, request) {
  const url = request.url;

  if (!url) {
    ws.close(4000, "Missing URL");
    return;
  }

  const queryString = url.split("?")[1];
  if (!queryString) {
    ws.close(4002, "Missing query parameters");
    return;
  }

  const queryParams = new URLSearchParams(queryString);
  const token = queryParams.get("token") || "";

  const userId = checkUser(token);

  if (userId == null) {
    ws.close(4001, "Invalid or missing token");
    return;
  }

  // Remove any stale connection for the same socket
  const existing = users.find((x) => x.ws === ws);
  if (existing) {
    users.splice(users.indexOf(existing), 1);
  }

  const user: User = { userId, rooms: [], ws, isAlive: true };
  users.push(user);

  ws.on("pong", () => {
    user.isAlive = true;
  });

  ws.on("message", async function message(data) {
    let parsedData: any;
    try {
      parsedData = JSON.parse(data as unknown as string);
    } catch (error) {
      ws.send(JSON.stringify({ type: "error", msg: "Malformed JSON payload" }));
      return;
    }

    const type = parsedData?.type;
    const roomId = toRoomId(parsedData?.roomId);

    if (type === "join_room") {
      if (roomId === null) {
        return;
      }
      const next = joinRoom(user, roomId);
      user.rooms = next.rooms;
      return;
    }

    if (type === "leave_room") {
      if (roomId === null) {
        return;
      }
      // useRoom() keeps every room except the one being left (fixes the "keep the wrong room" bug)
      const next = leaveRoom(user, roomId);
      user.rooms = next.rooms;
      return;
    }

    if (type === "chat") {
      const parse = ChatMessageSchema.safeParse({
        roomId: parsedData.roomId,
        message: parsedData.message,
      });
      if (!parse.success || roomId === null) {
        return;
      }

      try {
        await prismaClient.chat.create({
          data: {
            roomId,
            message: parse.data.message,
            userId,
          },
        });
      } catch (error) {
        console.error("Failed to persist chat message:", error);
        return;
      }

      broadcast(roomId, {
        type: "chat",
        message: parse.data.message,
        roomId: roomId.toString(),
      });
      return;
    }

    if (type === "shape") {
      const shapeType = parsedData?.shape?.type;
      const payload = parsedData?.shape;

      if (roomId === null || !shapeType || typeof shapeType !== "string" || !payload) {
        return;
      }

      try {
        await prismaClient.shape.create({
          data: {
            roomId,
            type: shapeType,
            payload,
          },
        });
      } catch (error) {
        console.error("Failed to persist shape:", error);
        return;
      }

      broadcast(roomId, {
        type: "shape",
        shape: payload,
        roomId: roomId.toString(),
      });
    }
  });

  ws.on("close", () => {
    const idx = users.findIndex((x) => x.ws === ws);
    if (idx !== -1) {
      users.splice(idx, 1);
    }
  });
});

function broadcast(roomId: number, data: object) {
  const payload = JSON.stringify(data);
  users.forEach((target) => {
    if (target.rooms.includes(roomId) && target.ws.readyState === WebSocket.OPEN) {
      target.ws.send(payload);
    }
  });
}

const heartbeat = setInterval(function ping() {
  users.forEach((target) => {
    if (!target.isAlive) {
      target.ws.terminate();
      const idx = users.findIndex((x) => x.ws === target.ws);
      if (idx !== -1) {
        users.splice(idx, 1);
      }
      return;
    }
    target.isAlive = false;
    target.ws.ping();
  });
}, HEARTBEAT_INTERVAL_MS);

wss.on("close", () => {
  clearInterval(heartbeat);
});
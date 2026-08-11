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

const port = Number(process.env.PORT_WS) || 8381;
const wss = new WebSocketServer({ port });
wss.on("listening", () => console.log(`WebSocket server listening on port ${port}`));

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

  const user: User = { userId, rooms: [], ws, name: "guest", isAlive: true };
  users.push(user);

  ws.send(JSON.stringify({ type: "self", userId, name: user.name }));

  ws.on("pong", () => {
    user.isAlive = true;
  });

  // Incoming messages are queued until the display name loads, so the client's
  // very first join_room — fired the instant the socket opens — is never
  // dropped (that left users absent from the room and killed live updates),
  // and presence labels never start out as "guest".
  const pending: string[] = [];
  let ready = false;

  const message = async (data: unknown) => {
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

      // Hand the newcomer the room roster already sat at the table, with the
      // last known cursor position so their labels render immediately.
      const members = users
        .filter((u) => u !== user && u.rooms.includes(roomId))
        .map((u) => ({
          userId: u.userId,
          name: u.name,
          x: u.lastPointer?.x ?? null,
          y: u.lastPointer?.y ?? null,
        }));
      ws.send(
        JSON.stringify({ type: "presence_members", roomId, members })
      );

      // …and tell everyone already here who just arrived.
      broadcast(
        roomId,
        {
          type: "presence_enter",
          roomId,
          userId: user.userId,
          name: user.name,
          x: user.lastPointer?.x ?? null,
          y: user.lastPointer?.y ?? null,
        },
        except(ws)
      );
      return;
    }

    if (type === "leave_room") {
      if (roomId === null) {
        return;
      }
      // useRoom() keeps every room except the one being left (fixes the "keep the wrong room" bug)
      const next = leaveRoom(user, roomId);
      user.rooms = next.rooms;
      broadcast(
        roomId,
        { type: "presence_leave", roomId, userId: user.userId },
        except(ws)
      );
      return;
    }

    if (type === "pointer") {
      if (roomId === null) {
        return;
      }
      const x = Number(parsedData?.x);
      const y = Number(parsedData?.y);
      if (!isFinite(x) || !isFinite(y)) {
        return;
      }
      user.lastPointer = { x, y };
      broadcast(
        roomId,
        {
          type: "pointer",
          roomId,
          userId: user.userId,
          name: user.name,
          x,
          y,
        },
        except(ws)
      );
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

      // Tell the room before touching the database so a slow write can never
      // delay what everyone sees, and don't echo back to the artist — their
      // canvas already painted the shape locally.
      broadcast(
        roomId,
        {
          type: "shape",
          shape: payload,
          roomId: roomId.toString(),
        },
        except(ws)
      );

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
      }
    }

    if (type === "update") {
      const shape = parsedData?.shape;
      const shapeType = shape?.type;
      const shapeId = shape?.id;
      if (roomId === null || !shape || typeof shapeId !== "string" || typeof shapeType !== "string") {
        return;
      }

      // Broadcast first and skip the sender. Persisting every throttled drag
      // snapshot can take tens of milliseconds, and if the echo to the artist
      // were gated on that write, out-of-order stale snapshots would land after
      // their drag finished and snap the shape back to an older spot.
      broadcast(
        roomId,
        {
          type: "update",
          shape,
          roomId: roomId.toString(),
        },
        except(ws)
      );

      try {
        // Shapes are keyed by the client uuid stored inside payload.id;
        // legacy strokes loaded before the eraser existed carry only the row's
        // numeric id, so match on whichever the client is talking about.
        const numericId = /^\d+$/.test(shapeId) ? Number(shapeId) : null;
        await prismaClient.shape.updateMany({
          where: {
            roomId,
            OR: [
              { payload: { path: ["id"], equals: shapeId } },
              ...(numericId !== null ? [{ id: numericId }] : []),
            ],
          },
          data: { type: shapeType, payload: shape },
        });
      } catch (error) {
        console.error("Failed to update shape:", error);
      }
      return;
    }

    if (type === "erase") {
      const shapeId = parsedData?.shapeId;
      if (roomId === null || typeof shapeId !== "string" || shapeId.length === 0) {
        return;
      }

      broadcast(
        roomId,
        { type: "erase", shapeId, roomId: roomId.toString() },
        except(ws)
      );

      try {
        // New strokes are keyed by the client uuid stored inside payload.id;
        // legacy strokes loaded before the eraser existed carry only the row's
        // numeric id, so match on whichever the client is talking about.
        const numericId = /^\d+$/.test(shapeId) ? Number(shapeId) : null;
        await prismaClient.shape.deleteMany({
          where: {
            roomId,
            OR: [
              { payload: { path: ["id"], equals: shapeId } },
              ...(numericId !== null ? [{ id: numericId }] : []),
            ],
          },
        });
      } catch (error) {
        console.error("Failed to erase shape:", error);
      }
      return;
    }

    if (type === "clear") {
      if (roomId === null) {
        return;
      }

      broadcast(
        roomId,
        { type: "clear", roomId: roomId.toString() },
        except(ws)
      );

      try {
        await prismaClient.shape.deleteMany({
          where: { roomId },
        });
      } catch (error) {
        console.error("Failed to clear shapes:", error);
      }
    }
  }

  ws.on("message", (raw) => {
    if (ready) message(raw);
    else pending.push(raw.toString());
  });

  ws.on("close", () => {
    const idx = users.findIndex((x) => x.ws === ws);
    if (idx !== -1) {
      const leaver = users[idx]!;
      users.splice(idx, 1);
      leaver.rooms.forEach((roomId) => {
        broadcast(
          roomId,
          { type: "presence_leave", roomId, userId: leaver.userId },
          except(ws)
        );
      });
    }
  });

  // Load the display name in the background, then drain the queue so the real
  // user name is used even for messages that arrived during the lookup.
  const drain = () => {
    ready = true;
    while (pending.length) message(pending.shift()!);
  };
  prismaClient.user
    .findUnique({ where: { id: userId }, select: { name: true } })
    .then((record) => {
      if (record?.name) {
        user.name = record.name;
        ws.send(JSON.stringify({ type: "self", userId, name: user.name }));
      }
    })
    .catch((error) => console.error("Failed to load user name:", error))
    .finally(drain);
});

function except(ws: WebSocket): Set<WebSocket> {
  return new Set([ws]);
}

function broadcast(roomId: number, data: object, skip?: Set<WebSocket>) {
  const payload = JSON.stringify(data);
  users.forEach((target) => {
    if (
      target.rooms.includes(roomId) &&
      target.ws.readyState === WebSocket.OPEN &&
      !skip?.has(target.ws)
    ) {
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
import { WebSocketServer } from "ws";
import Jwt, { JwtPayload } from "jsonwebtoken";
import WebSocket from "ws";
import "dotenv/config";
import { prismaClient } from "@repo/db/client";

const JWT_SECRET = process.env.JWT_SECRET || "qwertyuiopasdfghjklzxcvbnm";

const wss = new WebSocketServer({ port: 8000 });

interface User {
  ws: WebSocket;
  rooms: string[];
  userId: string;
}

const users: User[] = [];

function checkUser(token: string): string | null {
  try {
    const decoded = Jwt.verify(token, JWT_SECRET);

    if (typeof decoded == "string") {
      return null;
    }

    if (!decoded || !decoded.userId) {
      return null;
    }

    return decoded.userId;
  } catch (e) {
    return null;
  }
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

  users.push({
    userId,
    rooms: [],
    ws,
  });

  ws.on("message", async function message(data) {
    const parsedData = JSON.parse(data as unknown as string);

    if (parsedData.type === "join_room") {
      const user = users.find((x) => x.ws === ws);
      user?.rooms.push(parsedData.roomId);
    }

    if (parsedData.type === "leave_room") {
      const user = users.find((x) => x.ws === ws);

      if (!user) {
        return;
      }

      user.rooms = user?.rooms.filter((x) => x === parsedData.room);
    }

    if (parsedData.type === "chat") {
      const roomId = parsedData.roomId;
      const message = parsedData.message;

       try {
           await prismaClient.chat.create({
             data: {
               roomId,
               message,
               userId,
             },
           });    
       } catch (error) {
        return null
       }

      users.forEach((user) => {
        if (user.rooms.includes(roomId)) {
          user.ws.send(
            JSON.stringify({
              type: "chat",
              message: message,
              roomId,
            })
          );
        }
      });
    }


  });
});

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Jwt from "jsonwebtoken";
import { middleware } from "./middleware.js";
import { rateLimiter } from "./rateLimit.js";
import { getJwtSecret, hashPassword, verifyPassword } from "@repo/backend-common/config";
import { prismaClient } from "@repo/db/client";
import {
  CreateUserSchema,
  SignInSchema,
  CreateRoomSchema,
} from "@repo/common/types";

dotenv.config({ path: new URL("../../../.env", import.meta.url) });

const app = express();
const port = Number(process.env.PORT_HTTP) || 8380;

app.use(
  cors({
    origin: ["http://localhost:3000"],
    credentials: true,
  })
);
app.use(express.json());

app.post("/signup", rateLimiter, async (req, res) => {
  const parsedData = CreateUserSchema.safeParse(req.body);
  if (!parsedData.success) {
    return res.status(400).json({
      error: parsedData.error.flatten(),
    });
  }

  const { email, password, name } = parsedData.data;

  try {
    const user = await prismaClient.user.create({
      data: {
        email,
        password: hashPassword(password),
        name,
      },
    });

    return res.json({
      userId: user.id,
    });
  } catch (e) {
    return res.status(409).json({
      msg: "User already exists !",
    });
  }
});

app.post("/signin", rateLimiter, async (req, res) => {
  const parsedData = SignInSchema.safeParse(req.body);
  if (!parsedData.success) {
    return res.status(400).json({
      error: parsedData.error.flatten(),
    });
  }

  const { email, password } = parsedData.data;

  const user = await prismaClient.user.findUnique({
    where: { email },
  });

  if (!user || !verifyPassword(password, user.password)) {
    return res.status(401).json({
      msg: "Invalid email or password",
    });
  }

  const token = Jwt.sign({ userId: user.id }, getJwtSecret(), {
    expiresIn: "2h",
  });
  res.json({ token });
});

app.post("/room", middleware, async (req, res) => {
  const parsedData = CreateRoomSchema.safeParse(req.body);
  if (!parsedData.success) {
    return res.status(400).json({
      error: parsedData.error.flatten(),
    });
  }

  const userId = req.userId!;

  try {
    const room = await prismaClient.room.create({
      data: {
        slug: parsedData.data.name,
        adminId: userId,
      },
    });

    return res.json({
      roomId: room.id,
    });
  } catch (e) {
    return res.status(409).json({
      msg: "Room already exists with this name",
    });
  }
});

app.get("/room/:slug", async (req, res) => {
  const { slug } = req.params;
  if (!slug) {
    return res.status(400).json({ msg: "Missing room slug" });
  }

  const room = await prismaClient.room.findFirst({
    where: { slug },
  });

  return res.json({ room });
});

app.get("/chats/:roomId", middleware, async (req, res) => {
  const roomId = req.params.roomId;

  if (!roomId) {
    return res.status(400).json({ msg: "Missing room id" });
  }

  try {
    // Try to find room by slug first, then by numeric ID
    let room = await prismaClient.room.findUnique({
      where: { slug: roomId },
    });

    if (!room && !isNaN(Number(roomId))) {
      room = await prismaClient.room.findUnique({
        where: { id: Number(roomId) },
      });
    }

    if (!room) {
      return res.json({ messages: [] });
    }

    const messages = await prismaClient.chat.findMany({
      where: { roomId: room.id },
      orderBy: { id: "asc" },
      take: 1000,
    });

    return res.json({ messages });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ msg: "Failed to load chats" });
  }
});

app.get("/shapes/:roomId", middleware, async (req, res) => {
  const { roomId } = req.params;
  if (!roomId) {
    return res.status(400).json({ msg: "Missing room id" });
  }

  try {
    let room = await prismaClient.room.findUnique({
      where: { slug: roomId },
    });

    if (!room && !isNaN(Number(roomId))) {
      room = await prismaClient.room.findUnique({
        where: { id: Number(roomId) },
      });
    }

    if (!room) {
      return res.json({ shapes: [] });
    }

    const shapes = await prismaClient.shape.findMany({
      where: { roomId: room.id },
      orderBy: { id: "asc" },
      take: 5000,
    });

    return res.json({ shapes });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ msg: "Failed to load shapes" });
  }
});

app.listen(port, () => {
  console.log(`App is listening on port ${port}`);
});
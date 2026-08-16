import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Jwt, { type JwtPayload } from "jsonwebtoken";
import { middleware } from "./middleware.js";
import { rateLimiter } from "./rateLimit.js";
import { getJwtSecret, hashPassword, verifyPassword } from "@repo/backend-common/config";
import { prismaClient } from "@repo/db/client";
import {
  CreateUserSchema,
  SignInSchema,
  CreateRoomSchema,
  UpdateProfileSchema,
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
app.use(express.json({ limit: "10mb" }));

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
  const refreshToken = Jwt.sign(
    { userId: user.id, type: "refresh" },
    getJwtSecret(),
    { expiresIn: "30d" }
  );
  res.json({ token, refreshToken });
});

// Swap a still-valid refresh token for a fresh access token (and a fresh
// refresh token), so long-lived whiteboard sessions never hard-stop at the
// two-hour mark. Each exchange issues a new pair, keeping the stored session
// forward-renewed rather than accumulating indefinitely.
app.post("/auth/refresh", rateLimiter, async (req, res) => {
  const { refreshToken } = req.body ?? {};
  if (typeof refreshToken !== "string" || refreshToken.length === 0) {
    return res.status(400).json({ msg: "Missing refresh token" });
  }

  let payload: JwtPayload;
  try {
    payload = Jwt.verify(refreshToken, getJwtSecret()) as JwtPayload;
  } catch {
    return res.status(401).json({ msg: "Invalid or expired refresh token" });
  }

  if (payload?.type !== "refresh" || typeof payload.userId !== "string") {
    return res.status(401).json({ msg: "Invalid refresh token" });
  }

  const user = await prismaClient.user.findUnique({
    where: { id: payload.userId },
  });
  if (!user) {
    return res.status(401).json({ msg: "Account no longer exists" });
  }

  const nextToken = Jwt.sign({ userId: user.id }, getJwtSecret(), {
    expiresIn: "2h",
  });
  const nextRefresh = Jwt.sign(
    { userId: user.id, type: "refresh" },
    getJwtSecret(),
    { expiresIn: "30d" }
  );
  res.json({ token: nextToken, refreshToken: nextRefresh });
});

app.get("/me", middleware, async (req, res) => {
  try {
    const user = await prismaClient.user.findUnique({
      where: { id: req.userId! },
      select: { id: true, email: true, name: true, photo: true },
    });
    if (!user) {
      return res.status(401).json({ msg: "Account no longer exists" });
    }

    const rooms = await prismaClient.room.findMany({
      where: { adminId: user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, slug: true, backgroundColor: true, createdAt: true },
    });

    return res.json({ user, rooms });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ msg: "Failed to load profile" });
  }
});

app.patch("/me", middleware, async (req, res) => {
  const parsed = UpdateProfileSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const photo = parsed.data.photo;
  if (photo !== undefined && photo !== null && photo.length > 0) {
    // Accept only base64 image data URLs (the browser upload path), never a
    // raw external URL. The ~6.7 MB ceiling matches the 5 MB file cap.
    const isImageDataUrl = /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(photo);
    if (!isImageDataUrl) {
      return res.status(400).json({ msg: "Photo must be an uploaded image" });
    }
    if (photo.length > 7_200_000) {
      return res.status(400).json({ msg: "Photo must be 5 MB or smaller" });
    }
  }

  try {
    const user = await prismaClient.user.update({
      where: { id: req.userId! },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(photo !== undefined ? { photo } : {}),
      },
      select: { id: true, email: true, name: true, photo: true },
    });

    return res.json({ user });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ msg: "Failed to update profile" });
  }
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

    return res.json({
      shapes,
      backgroundColor: room.backgroundColor,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ msg: "Failed to load shapes" });
  }
});

app.listen(port, () => {
  console.log(`App is listening on port ${port}`);
});
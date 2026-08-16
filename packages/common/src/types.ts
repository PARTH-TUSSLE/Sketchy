import z from "zod";

export const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1),
});

export const SignInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const CreateRoomSchema = z.object({
  name: z.string().min(3).max(30),
});

export const UpdateProfileSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  // Uploaded avatar images arrive as base64 data URLs (5 MB file cap).
  photo: z.string().max(7_200_000).nullish(),
});

export const RoomIdSchema = z.object({
  roomId: z.union([z.string().min(1), z.number().int().positive()]),
});

export const ChatMessageSchema = z.object({
  roomId: z.union([z.string().min(1), z.number().int().positive()]),
  message: z.string().min(1).max(4000),
});
import express from "express";
import Jwt from "jsonwebtoken";
import { middleware } from "./middleware.js";
import { JWT_SECRET } from "@repo/backend-common/config"
import {
  CreateUserSchema,
  SignInSchema,
  CreateRoomSchema,
} from "@repo/common/types";

const app = express();
const port = 8080;

app.post("/signup", (req, res) => {
  const data = CreateUserSchema.safeParse(req.body);
  if (!data.success) {
    return res.json({
      "message": "Incorrect inputs"
    })
  }
});

app.post("/signin", (req, res) => {
  const userId = 1;
  if (!JWT_SECRET) {
    return res
      .status(500)
      .json({ error: "JWT_SECRET is not defined in environment variables." });
  }
  const token = Jwt.sign({ userId }, JWT_SECRET);
  res.json({ token });
});

app.post("/room", middleware, (req, res) => {
  const data = CreateRoomSchema.safeParse(req.body);
  if (!data.success) {
    return res.json({
      message: "Incorrect inputs",
    });
  }
});

app.listen(port, () => {
  console.log(`App is listening on port ${port}`);
});
 
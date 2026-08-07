import { NextFunction, Request, Response } from "express";
import Jwt from "jsonwebtoken";
import { getJwtSecret } from "@repo/backend-common/config";

export function middleware(req: Request, res: Response, next: NextFunction) {
  const token = req.headers["authorization"];

  if (!token || typeof token !== "string") {
    return res
      .status(401)
      .json({ msg: "Authorization token is missing or invalid" });
  }

  try {
    const decoded = Jwt.verify(token, getJwtSecret());

    if (typeof decoded === "string" || decoded.userId === undefined) {
      return res.status(401).json({ msg: "Unauthorized!" });
    }

    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({
      msg: "Invalid or expired token",
    });
  }
}
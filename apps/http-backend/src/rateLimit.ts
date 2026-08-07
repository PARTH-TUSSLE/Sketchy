import { Request, Response, NextFunction } from "express";

const windowMs = 15 * 60 * 1000;
const max = 20;

const hits = new Map<string, { count: number; resetAt: number }>();

export function rateLimiter(req: Request, res: Response, next: NextFunction) {
  const key = req.ip || "unknown";
  const now = Date.now();
  const record = hits.get(key);

  if (!record || record.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return next();
  }

  record.count += 1;
  if (record.count > max) {
    return res
      .status(429)
      .json({ msg: "Too many attempts, please try again later" });
  }

  next();
}
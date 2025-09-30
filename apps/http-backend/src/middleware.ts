import { NextFunction, Request, Response } from "express";
import  Jwt  from "jsonwebtoken";
import { JWT_SECRET } from "@repo/backend-common/config";


export function middleware (req: Request, res: Response, next: NextFunction) {
  const token = req.headers["authorization"];

  if (!JWT_SECRET) {
    return res.json({
      msg: "Jwt secret is not defined",
    });
  }

  if (!token || typeof token !== "string") {
    return res.status(401).json({ msg: "Authorization token is missing or invalid" });
  }

  const decoded = Jwt.verify(token, JWT_SECRET);

  if(decoded){
    //@ts-ignore
    req.userId = decoded.userId;
  } else {
    res.json({
      msg: "Unauthorized!"
    })
  }

}
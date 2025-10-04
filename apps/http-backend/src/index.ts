import express from "express";
import cors from "cors";
import Jwt from "jsonwebtoken";
import { middleware } from "./middleware.js";
import { JWT_SECRET } from "@repo/backend-common/config"
import { prismaClient } from "@repo/db/client";
import {
  CreateUserSchema,
  SignInSchema,
  CreateRoomSchema,
} from "@repo/common/types";

const app = express();
const port = 8080;
app.use(cors());
app.use(express.json());

app.post("/signup",async (req, res) => {
  const parsedData = CreateUserSchema.safeParse(req.body);
  if (!parsedData.success) {
    console.log(parsedData.error)
    return res.json({
      message: "Incorrect inputs",
    });
  }

  try {
    const user = await prismaClient.user.create({
      data: {
        email: parsedData.data.username,
        password: parsedData.data.password,
        name: parsedData.data.name,
      },
    }); 

    res.json({
      userId: user.id
    })

  } catch (e) {
    res.status(411).json({
      "msg": "User already exists !"
    })
  }
  
});

app.post("/signin", async (req, res) => {

  const parsedData = SignInSchema.safeParse(req.body);
  if (!parsedData.success) {
    console.log(parsedData.error);
    return res.json({
      message: "Incorrect inputs",
    });
  }

  const user = await prismaClient.user.findFirst({
    where:{
      email: parsedData.data.username,
      password: parsedData.data.password
    }
  })

  if (!user) {
    return res.status(403).json({
      "msg": "Not Authorized !"
    })
  }

  const token = Jwt.sign({ userId: user?.id }, JWT_SECRET);
  res.json({ token });
});

app.post("/room", middleware, async (req, res) => {
  const parsedData = CreateRoomSchema.safeParse(req.body);
  if (!parsedData.success) {
    return res.json({
      message: "Incorrect inputs",
    });
  }

  //@ts-ignore
  const userId = req.userID;

  try {
    const room = await prismaClient.room.create({
        data: {
          slug: parsedData.data.name,
          adminId: userId,
        },
      });

      res.json({
        roomId: room.id
      })

  } catch (e) {
   
    res.status(411).json({
      "msg": "Room already exists with this name"
    })

  }

});

app.get("/chats/:roomId", async (req, res) => {

  try {
      const { roomId } = req.params;

      const messages = await prismaClient.chat.findMany({
        where: {
          roomId: Number(roomId),
        },
        orderBy: {
          id: "asc"
        },
        take: 50,
      });

      res.json({
        messages,
      });
  } catch (error) {
    res.send({
      error
    })
  }

})

app.get("/room/:slug", async (req, res) => {
  const { slug } = req.params;

  const room = await prismaClient.room.findFirst({
    where: {
      slug: slug
    },
  });

  res.json({
    room
  });
});

app.listen(port, () => {
  console.log(`App is listening on port ${port}`);
});
 
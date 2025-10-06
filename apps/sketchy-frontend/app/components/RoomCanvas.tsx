"use client"
import { useEffect, useRef, useState } from "react";
import { WS_URL } from "../config";
import Canvas from "../components/Canvas"


export default function RoomCanvas ( {roomId}: { roomId : string} ) {
   const [socket, setSocket] = useState<WebSocket | null>(null)
   

   useEffect(() => {
    const ws = new WebSocket(
      `${WS_URL}?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmNGNiY2ViMy02ODBlLTRjNjktODkyNC0yMWZjNGQwNGFiYTYiLCJpYXQiOjE3NTk3NDMxNTh9.Zp_D8-nHb5ETopr2AY-rQ1kNI0ZdEPnxuUWtSlX6dB4`
    );
    ws.onopen = () => {
      setSocket(ws);
      ws.send(JSON.stringify({
        type: "join_room",
        roomId
      }))
    }
   }, [])

   


   if (!socket) {
    return <div>connecting to the server ....</div>;
   }

   return (
     <div>
       <Canvas roomId={roomId} socket={socket} />
     </div>
   );
}
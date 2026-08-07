"use client";
import { useEffect, useState } from "react";
import { WS_URL } from "../config";
import Canvas from "../components/Canvas";
import { getToken } from "../lib/auth";

export default function RoomCanvas({ roomId }: { roomId: string }) {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setError("Not authenticated. Please sign in first.");
      return;
    }

    const ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`);

    ws.onopen = () => {
      setSocket(ws);
      ws.send(
        JSON.stringify({
          type: "join_room",
          roomId,
        })
      );
    };

    ws.onerror = () => {
      setError("WebSocket connection failed");
    };

    return () => {
      ws.close();
    };
  }, [roomId]);

  if (error) {
    return <div>{error}</div>;
  }

  if (!socket) {
    return <div>connecting to the server ....</div>;
  }

  return (
    <div>
      <Canvas roomId={roomId} socket={socket} />
    </div>
  );
}
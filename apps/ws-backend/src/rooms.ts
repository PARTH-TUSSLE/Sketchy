import type { WebSocket } from "ws";

export interface User {
  ws: WebSocket;
  rooms: number[];
  userId: string;
  isAlive: boolean;
}

export function joinRoom(user: User, roomId: number): User {
  if (!user.rooms.includes(roomId)) {
    return { ...user, rooms: [...user.rooms, roomId] };
  }
  return user;
}

export function leaveRoom(user: User, roomId: number): User {
  return { ...user, rooms: user.rooms.filter((r) => r !== roomId) };
}
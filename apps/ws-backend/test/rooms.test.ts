import { test } from "node:test";
import assert from "node:assert/strict";
import { joinRoom, leaveRoom } from "../src/rooms.ts";
import type { User } from "../src/rooms.ts";

function makeUser(rooms: number[] = []): User {
  return { ws: {} as any, rooms, userId: "u1", isAlive: true };
}

test("joinRoom adds a room once", () => {
  const user = makeUser();
  const joined = joinRoom(user, 3);
  assert.deepEqual(joined.rooms, [3]);
  const again = joinRoom(joined, 3);
  assert.deepEqual(again.rooms, [3], "should not duplicate");
});

test("leaveRoom removes only the requested room", () => {
  const user = makeUser([1, 2, 3]);
  const left = leaveRoom(user, 2);
  assert.deepEqual(left.rooms, [1, 3]);
});

test("leaveRoom keeps all others (regression for the 'keep wrong room' bug)", () => {
  const user = makeUser([1, 2]);
  const left = leaveRoom(user, 1);
  assert.deepEqual(left.rooms, [2]);
});
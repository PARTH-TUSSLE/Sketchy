"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import axios from "axios";
import { TriangleAlert, RefreshCw } from "lucide-react";
import { BACKEND_URL, WS_URL } from "../config";
import Canvas from "../components/Canvas";
import { getToken } from "../lib/auth";

type ConnState =
  | { status: "connecting" }
  | { status: "joined"; socket: WebSocket }
  | { status: "no-token" }
  | { status: "network" }
  | { status: "missing" };

const MAX_RETRIES = 3;
const RETRY_AFTER_MS = 1500;

function decodeRoomId(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function encodeRoomId(roomId: string): string {
  return encodeURIComponent(roomId);
}

const NUMERIC_ID = /^\d+$/;

export default function RoomCanvas({ roomId }: { roomId: string }) {
  const roomKey = decodeRoomId(roomId);
  const [conn, setConn] = useState<ConnState>({ status: "connecting" });
  const [attempt, setAttempt] = useState(0);
  const [roomIdNum, setRoomIdNum] = useState<number | null>(null);
  const timeouts = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Resolve the slug/name to the numeric room id the socket actually works with.
  // Joining by name bypasses the numeric path, so without this the websocket
  // `join_room` message is silently dropped (toRoomId rejects non-numeric).
  useEffect(() => {
    let disposed = false;

    (async () => {
      if (NUMERIC_ID.test(roomKey)) {
        setRoomIdNum(Number(roomKey));
        return;
      }
      try {
        const res = await axios.get(
          `${BACKEND_URL}/room/${encodeRoomId(roomKey)}`
        );
        const room = res.data?.room;
        if (!disposed && room && NUMERIC_ID.test(String(room.id))) {
          setRoomIdNum(Number(room.id));
        } else if (!disposed) {
          setConn({ status: "missing" });
        }
      } catch {
        if (!disposed) setConn({ status: "missing" });
      }
    })();

    return () => {
      disposed = true;
    };
  }, [roomKey]);

  useEffect(() => {
    let disposed = false;
    let socket: WebSocket | null = null;

    const open = (n: number) => {
      const token = getToken();
      if (!token) {
        setConn({ status: "no-token" });
        return;
      }
      if (roomIdNum === null) return;

      socket = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`);

      socket.onopen = () => {
        socket?.send(JSON.stringify({ type: "join_room", roomId: roomIdNum }));
        if (!disposed && socket) setConn({ status: "joined", socket });
      };

      socket.onclose = (e) => {
        if (disposed) return;
        if (e.code === 4001) {
          setConn({ status: "no-token" });
          return;
        }
        if (n < MAX_RETRIES) {
          setConn({ status: "connecting" });
          const t = setTimeout(() => open(n + 1), RETRY_AFTER_MS);
          timeouts.current.push(t);
        } else {
          setConn({ status: "network" });
        }
      };
    };

    if (roomIdNum !== null) open(0);

    return () => {
      disposed = true;
      timeouts.current.forEach(clearTimeout);
      timeouts.current = [];
      socket?.close();
    };
  }, [roomIdNum, attempt]);

  const retry = () => {
    setConn({ status: "connecting" });
    setAttempt((a) => a + 1);
  };

  if (conn.status === "no-token") {
    return (
      <Shell title="Sign in to open the board">
        <p>
          Rooms are behind a sign-in, so only people you invite can sketch with
          you. Sign in and we&apos;ll bring you straight back here.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href={`/signin?next=/canvas/${encodeRoomId(roomKey)}`}
            className="btn btn-ink"
          >
            Sign in
          </Link>
          <Link href="/signup" className="btn btn-paper">
            Create account
          </Link>
        </div>
      </Shell>
    );
  }

  if (conn.status === "missing") {
    return (
      <Shell title="We couldn&apos;t find that board">
        <p>
          No room matches &quot;{roomKey}&quot;. Double-check the name, or start a new
          one from the landing page.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/new-room" className="btn btn-ink">
            Name a new room
          </Link>
          <Link href="/" className="btn btn-paper">
            Back to landing
          </Link>
        </div>
      </Shell>
    );
  }

  if (conn.status === "network") {
    return (
      <Shell title="The studio is unreachable right now">
        <p>
          We tried {MAX_RETRIES} times and the studio didn&apos;t answer. Make
          sure the ws-backend (port 8381) is running, then reconnect. Your
          drawing is safe — it lives on the server.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button onClick={retry} className="btn btn-ink">
            <RefreshCw size={16} /> Reconnect
          </button>
          <Link href="/" className="btn btn-paper">
            Back to landing
          </Link>
        </div>
      </Shell>
    );
  }

  if (conn.status === "connecting") {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center gap-5 bg-[#141419] text-paper">
        <span className="live-dot h-2.5 w-2.5 rounded-full bg-marker" />
        <p className="animate-pulse font-[var(--font-plex)] text-sm tracking-[0.2em] uppercase text-paper/50">
          tracing to the room…
        </p>
      </div>
    );
  }

  return (
    <Canvas
      roomId={String(roomIdNum ?? "")}
      roomName={roomKey}
      socket={conn.socket}
    />
  );
}

function Shell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="board-grid relative flex min-h-screen items-center justify-center px-6">
      <div className="corner-marks card w-full max-w-md p-10 text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full border border-line text-ink">
          <TriangleAlert size={22} strokeWidth={1.6} />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <div className="mt-3 text-[15px] leading-relaxed text-inksoft">
          {children}
        </div>
      </div>
    </div>
  );
}
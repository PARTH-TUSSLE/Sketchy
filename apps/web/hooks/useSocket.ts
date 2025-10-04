import { useEffect, useState } from "react";
import { WS_URL } from "../app/config";



export function useSocekt () {
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState<WebSocket>();

  useEffect(() => {
    const ws = new WebSocket(
      `${WS_URL}?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmNGNiY2ViMy02ODBlLTRjNjktODkyNC0yMWZjNGQwNGFiYTYiLCJpYXQiOjE3NTk1ODI3Mzd9.pxd85Od10LMWC6Sdf4N7LlTcrEN1Sx4jdqMRPa_MVOI`
    );
    ws.onopen = () => {
      setLoading(false);
      setSocket(ws);
    }
  }, [])

  return {
    loading,
    socket
  }

}
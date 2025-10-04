"use client"

import { useEffect, useState } from "react";
import { useSocekt } from "../../hooks/useSocket"

function ChatRoomClient( {
  messages,
  id
} : {
  messages: { message: string } [],
  id: string
} ) {

  const [chats, setChats] = useState(messages);
  const [currMessage, setCurrMessage] = useState("");
  const {socket, loading} = useSocekt();

  useEffect(() => {
    if (socket && !loading) {
      socket.send(JSON.stringify({
        type: "join_room",
        roomId: id
      }));

      socket.onmessage = (event) => {
        const parsedData = JSON.parse(event.data);
        if (parsedData.type === "chat") {
          setChats( c => [...c, {message: parsedData.message}] )
        }
      }

    }

    return () => {
      socket?.close();
    }

  }, [socket, loading])

  return (
    <div>
      { chats.map( m => <div>{m.message}</div> ) }

      <input value={currMessage} type="text" placeholder="message" onChange={ (event) => {
        setCurrMessage(event.target.value)
      } } />

      <button onClick={ () => {
        socket?.send(JSON.stringify({
          type: "chat",
          roomId: id,
          message: currMessage
        }))

        setCurrMessage("");

      } } >Send</button>

    </div>
  )
}

export default ChatRoomClient

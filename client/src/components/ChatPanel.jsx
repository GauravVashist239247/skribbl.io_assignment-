import React, { useState, useRef, useEffect } from "react";
import { socket } from "../socket.js";

export default function ChatPanel({ chat }) {
  const [text, setText] = useState("");
  const messagesRef = useRef(null);

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [chat]);

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    socket.emit("guess", { text: trimmed });
    setText("");
  }

  return (
    <div className="chat-panel">
      <div className="chat-messages" ref={messagesRef}>
        {chat.map((m, i) => (
          <div className={"msg" + (m.system ? " system" : "")} key={i}>
            {m.system ? (
              m.text
            ) : (
              <>
                <span className="name">{m.playerName}:</span> {m.text}
              </>
            )}
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Type your guess..."
          autoComplete="off"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" className="btn primary">Send</button>
      </form>
    </div>
  );
}

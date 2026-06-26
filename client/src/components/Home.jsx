import React, { useState, useEffect } from "react";
import { useGame } from "../GameContext.jsx";
import { socket } from "../socket.js";

export default function Home() {
  const { state, dispatch, saveSession } = useGame();
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const prefill = params.get("room");
    if (prefill) setRoomCode(prefill);
  }, []);

  function showError(msg) {
    setError(msg);
    setTimeout(() => setError(""), 4000);
  }

  function handleCreateClick() {
    if (!name.trim()) return showError("Enter a nickname first");
    dispatch({ type: "SET_NAME", name: name.trim() });
    dispatch({ type: "SET_SCREEN", screen: "settings" });
  }

  function handleJoinClick() {
    if (!name.trim()) return showError("Enter a nickname first");
    if (!roomCode.trim()) return showError("Enter a room code");
    socket.emit(
      "join_room",
      { roomId: roomCode.trim().toUpperCase(), playerName: name.trim() },
      (res) => {
        if (!res.ok) return showError(res.error || "Failed to join room");
        saveSession(res.roomId, res.playerId);
        dispatch({
          type: "ENTERED_ROOM",
          roomId: res.roomId,
          playerId: res.playerId,
          settings: res.state.settings,
          players: res.state.players,
          phase: res.state.phase
        });
      }
    );
  }

  return (
    <div className="screen active">
      <div className="card home-card">
        <h1>🎨 Skribblz</h1>
        <p className="subtitle">Draw, guess, and have fun with friends!</p>

        <input
          type="text"
          placeholder="Your nickname"
          maxLength={16}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <div className="home-actions">
          <button className="btn primary" onClick={handleCreateClick}>
            Create Room
          </button>
          <div className="join-row">
            <input
              type="text"
              placeholder="Room code"
              maxLength={8}
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
            />
            <button className="btn secondary" onClick={handleJoinClick}>
              Join
            </button>
          </div>
        </div>

        <div className="error-text">{error}</div>
      </div>
    </div>
  );
}

import React from "react";
import { useGame } from "../GameContext.jsx";
import { socket } from "../socket.js";

export default function Lobby() {
  const { state } = useGame();
  const { roomId, players, settings, myPlayerId, isHost } = state;
  const me = players.find((p) => p.id === myPlayerId);

  function summary() {
    if (!settings) return "";
    return `${settings.rounds} rounds · ${settings.drawTime}s draw time · up to ${settings.maxPlayers} players · ${settings.hints} hints` +
      (settings.isPrivate ? " · Private" : "");
  }

  function copyLink() {
    const url = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    navigator.clipboard.writeText(url);
  }

  return (
    <div className="screen active">
      <div className="card lobby-card">
        <h2>
          Room: <span>{roomId}</span>{" "}
          <button className="btn tiny" onClick={copyLink}>Copy invite link</button>
        </h2>
        <p className="lobby-meta">{summary()}</p>

        <div className="lobby-body">
          <div className="player-list">
            {players.map((p) => (
              <div className="player-row" key={p.id}>
                <span>
                  {p.name} {p.isHost && <span className="badge">HOST</span>}
                </span>
                <span>{p.isReady ? "✅ Ready" : "⌛ Waiting"}</span>
              </div>
            ))}
          </div>
          <div className="lobby-side">
            <p>Waiting for players...</p>
            <button className="btn secondary" onClick={() => socket.emit("toggle_ready")}>
              {me?.isReady ? "Unready" : "Ready Up"}
            </button>
            {isHost && (
              <button
                className="btn primary"
                onClick={() => socket.emit("start_game")}
                disabled={players.length < 2}
              >
                Start Game
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

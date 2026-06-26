import React, { useState } from "react";
import { useGame } from "../GameContext.jsx";
import { socket } from "../socket.js";

const clamp = (v, min, max) => Math.min(max, Math.max(min, v || min));

export default function SettingsScreen() {
  const { state, dispatch, saveSession } = useGame();
  const [form, setForm] = useState({
    maxPlayers: 8,
    rounds: 3,
    drawTime: 80,
    wordCount: 3,
    hints: 2,
    isPrivate: false
  });

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleCreate() {
    const settings = {
      maxPlayers: clamp(+form.maxPlayers, 2, 20),
      rounds: clamp(+form.rounds, 2, 10),
      drawTime: clamp(+form.drawTime, 15, 240),
      wordCount: clamp(+form.wordCount, 1, 5),
      hints: clamp(+form.hints, 0, 5),
      isPrivate: form.isPrivate
    };
    socket.emit("create_room", { hostName: state.name, settings }, (res) => {
      if (!res.ok) return;
      saveSession(res.roomId, res.playerId);
      dispatch({
        type: "ENTERED_ROOM",
        roomId: res.roomId,
        playerId: res.playerId,
        settings: res.state.settings,
        players: res.state.players,
        phase: res.state.phase
      });
    });
  }

  return (
    <div className="screen active">
      <div className="card">
        <h2>Room Settings</h2>
        <div className="settings-grid">
          <label>
            Max players
            <input
              type="number" min={2} max={20}
              value={form.maxPlayers}
              onChange={(e) => update("maxPlayers", e.target.value)}
            />
          </label>
          <label>
            Rounds
            <input
              type="number" min={2} max={10}
              value={form.rounds}
              onChange={(e) => update("rounds", e.target.value)}
            />
          </label>
          <label>
            Draw time (sec)
            <input
              type="number" min={15} max={240}
              value={form.drawTime}
              onChange={(e) => update("drawTime", e.target.value)}
            />
          </label>
          <label>
            Word count
            <input
              type="number" min={1} max={5}
              value={form.wordCount}
              onChange={(e) => update("wordCount", e.target.value)}
            />
          </label>
          <label>
            Hints
            <input
              type="number" min={0} max={5}
              value={form.hints}
              onChange={(e) => update("hints", e.target.value)}
            />
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={form.isPrivate}
              onChange={(e) => update("isPrivate", e.target.checked)}
            />
            Private room
          </label>
        </div>
        <div className="btn-row">
          <button className="btn secondary" onClick={() => dispatch({ type: "SET_SCREEN", screen: "home" })}>
            Back
          </button>
          <button className="btn primary" onClick={handleCreate}>
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

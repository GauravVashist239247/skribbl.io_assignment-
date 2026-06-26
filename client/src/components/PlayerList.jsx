import React from "react";

export default function PlayerList({ players, drawerId }) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  return (
    <div className="player-sidebar">
      {sorted.map((p) => (
        <div
          key={p.id}
          className={
            "player-row" +
            (p.id === drawerId ? " drawer" : "") +
            (p.hasGuessedCorrectly ? " guessed" : "")
          }
        >
          <span>{p.id === drawerId ? "✏️ " : ""}{p.name}</span>
          <span>{p.score}</span>
        </div>
      ))}
    </div>
  );
}

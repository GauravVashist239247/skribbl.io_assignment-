import React from "react";
import { socket } from "../socket.js";
import { useGame } from "../GameContext.jsx";

export function WordChoiceOverlay({ wordOptions }) {
  const { dispatch } = useGame();
  if (!wordOptions || !wordOptions.length) return null;
  return (
    <div className="overlay">
      <div className="overlay-card">
        <h3>Choose a word to draw</h3>
        <div className="word-choice-buttons">
          {wordOptions.map((w) => (
            <button
              key={w}
              className="btn primary"
              onClick={() => {
                socket.emit("word_chosen", { word: w });
                dispatch({ type: "SET_MY_WORD", word: w });
              }}
            >
              {w}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function RoundEndOverlay({ word }) {
  if (!word) return null;
  return (
    <div className="overlay">
      <div className="overlay-card">
        <h3>The word was: {word}</h3>
        <p>Next round starting soon...</p>
      </div>
    </div>
  );
}

export function GameOverOverlay({ info, onBackHome }) {
  if (!info) return null;
  const { winner, leaderboard } = info;
  return (
    <div className="overlay">
      <div className="overlay-card">
        <h3>🏆 Game Over!</h3>
        <p>{winner ? `${winner.name} wins with ${winner.score} points!` : "No winner"}</p>
        <ol>
          {leaderboard.map((p) => (
            <li key={p.id}>{p.name} — {p.score} pts</li>
          ))}
        </ol>
        <button className="btn primary" onClick={onBackHome}>Back to Home</button>
      </div>
    </div>
  );
}

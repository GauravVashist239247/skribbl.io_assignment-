import React, { useState } from "react";
import { useGame } from "../GameContext.jsx";
import Canvas from "./Canvas.jsx";
import Toolbar from "./Toolbar.jsx";
import PlayerList from "./PlayerList.jsx";
import ChatPanel from "./ChatPanel.jsx";
import { WordChoiceOverlay, RoundEndOverlay, GameOverOverlay } from "./Overlays.jsx";

export default function GameScreen() {
  const { state, dispatch } = useGame();
  const [color, setColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(6);
  const [isErasing, setIsErasing] = useState(false);

  const isDrawer = state.drawerId === state.myPlayerId;

  const wordDisplay =
    state.phase === "choosing_word"
      ? "Choosing word..."
      : isDrawer && state.myWord
      ? state.myWord
      : state.blanks || "";

  function handleBackHome() {
    sessionStorage.removeItem("skribblz_session");
    window.location.href = window.location.pathname;
  }

  return (
    <div className="screen active">
      <div className="game-layout">
        <div className="game-top-bar">
          <div className="top-info">Round {state.round}/{state.totalRounds}</div>
          <div className="top-word">{wordDisplay}</div>
          <div className="top-timer">{state.timeLeft || "--"}</div>
        </div>

        <div className="game-main">
          <PlayerList players={state.players} drawerId={state.drawerId} />

          <div className="canvas-area">
            {state.phase === "choosing_word" && isDrawer && (
              <WordChoiceOverlay wordOptions={state.wordOptions} />
            )}
            {state.phase === "round_end" && state.roundEndInfo && (
              <RoundEndOverlay word={state.roundEndInfo.word} />
            )}
            {state.phase === "game_over" && state.gameOverInfo && (
              <GameOverOverlay info={state.gameOverInfo} onBackHome={handleBackHome} />
            )}

            <Canvas
              isDrawer={isDrawer}
              color={color}
              brushSize={brushSize}
              isErasing={isErasing}
              strokeEvent={state.strokeEvent}
              strokesHistory={state.strokesHistory}
            />

            <Toolbar
              isDrawer={isDrawer}
              color={color}
              setColor={setColor}
              brushSize={brushSize}
              setBrushSize={setBrushSize}
              isErasing={isErasing}
              setIsErasing={setIsErasing}
            />
          </div>

          <ChatPanel chat={state.chat} />
        </div>
      </div>
    </div>
  );
}

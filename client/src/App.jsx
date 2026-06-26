import React from "react";
import { GameProvider, useGame } from "./GameContext.jsx";
import Home from "./components/Home.jsx";
import SettingsScreen from "./components/SettingsScreen.jsx";
import Lobby from "./components/Lobby.jsx";
import GameScreen from "./components/GameScreen.jsx";

function Router() {
  const { state } = useGame();
  switch (state.screen) {
    case "settings":
      return <SettingsScreen />;
    case "lobby":
      return <Lobby />;
    case "game":
      return <GameScreen />;
    default:
      return <Home />;
  }
}

export default function App() {
  return (
    <GameProvider>
      <Router />
    </GameProvider>
  );
}

import React, { createContext, useContext, useReducer, useEffect, useCallback } from "react";
import { socket } from "./socket.js";

const GameContext = createContext(null);

const initialState = {
  screen: "home", // home | settings | lobby | game
  name: "",
  error: "",
  myPlayerId: null,
  roomId: null,
  isHost: false,
  players: [],
  settings: null,
  phase: "lobby",
  round: 1,
  totalRounds: 3,
  drawerId: null,
  wordOptions: [],
  blanks: "",
  myWord: "",
  timeLeft: 0,
  chat: [],
  roundEndInfo: null,
  gameOverInfo: null,
  strokeEvent: null, // last incoming stroke/clear/undo event, consumed by Canvas
  strokesHistory: [] // used to replay canvas on (re)join mid-game
};

function reducer(state, action) {
  switch (action.type) {
    case "SET_NAME":
      return { ...state, name: action.name };
    case "SET_ERROR":
      return { ...state, error: action.error };
    case "SET_SCREEN":
      return { ...state, screen: action.screen };
    case "ENTERED_ROOM": {
      const me = action.players.find((p) => p.id === action.playerId);
      return {
        ...state,
        screen: "lobby",
        myPlayerId: action.playerId,
        roomId: action.roomId,
        settings: action.settings,
        players: action.players,
        isHost: !!(me && me.isHost),
        phase: action.phase || "lobby"
      };
    }
    case "PLAYERS_UPDATED": {
      const me = action.players.find((p) => p.id === state.myPlayerId);
      return { ...state, players: action.players, isHost: !!(me && me.isHost) };
    }
    case "SETTINGS_UPDATED":
      return { ...state, settings: action.settings };
    case "ROUND_START":
      return {
        ...state,
        screen: "game",
        phase: "choosing_word",
        round: action.round,
        totalRounds: action.totalRounds,
        drawerId: action.drawerId,
        timeLeft: action.drawTime,
        blanks: "",
        myWord: "",
        wordOptions: [],
        roundEndInfo: null,
        strokeEvent: { kind: "clear" }
      };
    case "WORD_OPTIONS":
      return { ...state, wordOptions: action.wordOptions };
    case "WORD_PICKED":
      return {
        ...state,
        phase: "drawing",
        blanks: action.blanks,
        timeLeft: action.timeLeft,
        wordOptions: [],
        myWord: state.drawerId === state.myPlayerId ? state.myWord : ""
      };
    case "SET_MY_WORD":
      return { ...state, myWord: action.word };
    case "HINT":
      return { ...state, blanks: action.blanks };
    case "TIME_UPDATE":
      return { ...state, timeLeft: action.timeLeft };
    case "GUESS_RESULT_MSG":
    case "CHAT_MESSAGE":
      return { ...state, chat: [...state.chat, action.message].slice(-200) };
    case "ROUND_END":
      return {
        ...state,
        phase: "round_end",
        players: action.scores,
        roundEndInfo: { word: action.word }
      };
    case "GAME_OVER":
      return {
        ...state,
        phase: "game_over",
        players: action.leaderboard,
        gameOverInfo: { winner: action.winner, leaderboard: action.leaderboard }
      };
    case "GAME_STATE":
      return {
        ...state,
        phase: action.phase,
        drawerId: action.drawerId,
        players: action.players,
        round: action.round || state.round,
        totalRounds: action.totalRounds || state.totalRounds,
        blanks: action.blanks ?? state.blanks,
        timeLeft: action.timeLeft ?? state.timeLeft
      };
    case "STROKE_EVENT":
      return { ...state, strokeEvent: action.event };
    case "SET_STROKES_HISTORY":
      return { ...state, strokesHistory: action.strokes };
    case "RESET_TO_HOME":
      return { ...initialState };
    default:
      return state;
  }
}

export function GameProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    function onPlayerJoined({ players }) {
      dispatch({ type: "PLAYERS_UPDATED", players });
    }
    function onPlayerLeft({ players }) {
      dispatch({ type: "PLAYERS_UPDATED", players });
    }
    function onPlayerUpdated({ players }) {
      dispatch({ type: "PLAYERS_UPDATED", players });
    }
    function onSettingsUpdated(settings) {
      dispatch({ type: "SETTINGS_UPDATED", settings });
    }
    function onRoundStart(payload) {
      dispatch({ type: "ROUND_START", ...payload });
      const drawerName =
        payload.players?.find?.((p) => p.id === payload.drawerId)?.name || "Someone";
      dispatch({
        type: "CHAT_MESSAGE",
        message: { system: true, text: `${drawerName} is choosing a word...` }
      });
    }
    function onYourWordOptions({ wordOptions }) {
      dispatch({ type: "WORD_OPTIONS", wordOptions });
    }
    function onWordPicked(payload) {
      dispatch({ type: "WORD_PICKED", ...payload });
    }
    function onHint(payload) {
      dispatch({ type: "HINT", ...payload });
    }
    function onTimeUpdate(payload) {
      dispatch({ type: "TIME_UPDATE", ...payload });
    }
    function onGuessResult({ playerName, correct, points }) {
      if (correct) {
        dispatch({
          type: "CHAT_MESSAGE",
          message: { system: true, text: `🎉 ${playerName} guessed the word! +${points} pts` }
        });
      }
    }
    function onChatMessage({ playerName, text, system }) {
      dispatch({
        type: "CHAT_MESSAGE",
        message: system ? { system: true, text } : { playerName, text }
      });
    }
    function onRoundEnd(payload) {
      dispatch({ type: "ROUND_END", ...payload });
    }
    function onGameOver(payload) {
      dispatch({ type: "GAME_OVER", ...payload });
    }
    function onGameState(payload) {
      dispatch({ type: "GAME_STATE", ...payload });
    }
    function onDrawData(stroke) {
      dispatch({ type: "STROKE_EVENT", event: { kind: "stroke", stroke } });
    }
    function onCanvasClear() {
      dispatch({ type: "STROKE_EVENT", event: { kind: "clear" } });
    }
    function onDrawUndo() {
      dispatch({ type: "STROKE_EVENT", event: { kind: "undo" } });
    }

    socket.on("player_joined", onPlayerJoined);
    socket.on("player_left", onPlayerLeft);
    socket.on("player_updated", onPlayerUpdated);
    socket.on("settings_updated", onSettingsUpdated);
    socket.on("round_start", onRoundStart);
    socket.on("your_word_options", onYourWordOptions);
    socket.on("word_picked", onWordPicked);
    socket.on("hint", onHint);
    socket.on("time_update", onTimeUpdate);
    socket.on("guess_result", onGuessResult);
    socket.on("chat_message", onChatMessage);
    socket.on("round_end", onRoundEnd);
    socket.on("game_over", onGameOver);
    socket.on("game_state", onGameState);
    socket.on("draw_data", onDrawData);
    socket.on("canvas_clear", onCanvasClear);
    socket.on("draw_undo", onDrawUndo);

    return () => {
      socket.off("player_joined", onPlayerJoined);
      socket.off("player_left", onPlayerLeft);
      socket.off("player_updated", onPlayerUpdated);
      socket.off("settings_updated", onSettingsUpdated);
      socket.off("round_start", onRoundStart);
      socket.off("your_word_options", onYourWordOptions);
      socket.off("word_picked", onWordPicked);
      socket.off("hint", onHint);
      socket.off("time_update", onTimeUpdate);
      socket.off("guess_result", onGuessResult);
      socket.off("chat_message", onChatMessage);
      socket.off("round_end", onRoundEnd);
      socket.off("game_over", onGameOver);
      socket.off("game_state", onGameState);
      socket.off("draw_data", onDrawData);
      socket.off("canvas_clear", onCanvasClear);
      socket.off("draw_undo", onDrawUndo);
    };
  }, []);

  // Attempt rejoin on mount if a session was saved (e.g. page refresh)
  useEffect(() => {
    const saved = sessionStorage.getItem("skribblz_session");
    if (!saved) return;
    try {
      const { roomId, playerId } = JSON.parse(saved);
      if (!roomId || !playerId) return;
      socket.emit("rejoin_room", { roomId, playerId }, (res) => {
        if (!res.ok) {
          sessionStorage.removeItem("skribblz_session");
          return;
        }
        dispatch({
          type: "ENTERED_ROOM",
          roomId: res.roomId,
          playerId: res.playerId,
          settings: res.state.settings,
          players: res.state.players,
          phase: res.state.phase
        });
        if (res.gameState) {
          dispatch({ type: "SET_SCREEN", screen: "game" });
          dispatch({
            type: "GAME_STATE",
            phase: res.gameState.phase,
            drawerId: res.gameState.drawerId,
            players: res.gameState.players,
            round: res.gameState.round,
            totalRounds: res.gameState.totalRounds,
            blanks: res.gameState.blanks,
            timeLeft: res.gameState.timeLeft
          });
          if (res.gameState.word && res.gameState.drawerId === res.playerId) {
            dispatch({ type: "SET_MY_WORD", word: res.gameState.word });
          }
          if (res.gameState.strokes) {
            dispatch({ type: "SET_STROKES_HISTORY", strokes: res.gameState.strokes });
          }
        }
      });
    } catch {
      sessionStorage.removeItem("skribblz_session");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveSession = useCallback((roomId, playerId) => {
    sessionStorage.setItem("skribblz_session", JSON.stringify({ roomId, playerId }));
  }, []);

  const value = { state, dispatch, saveSession };
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used inside GameProvider");
  return ctx;
}

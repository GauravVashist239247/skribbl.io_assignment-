const path = require("path");
const http = require("http");
const express = require("express");
const { Server } = require("socket.io");
const { nanoid } = require("nanoid");

const RoomManager = require("./RoomManager");
const Player = require("./Player");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

// Serve the built React frontend (client/dist) in production.
// Run `npm run build` (see package.json) to generate it before `npm start`.
// Falls back to the legacy vanilla-JS frontend in /public if no build exists yet,
// so the server still runs out of the box before your first `npm run build`.
const fs = require("fs");
const reactDist = path.join(__dirname, "..", "client", "dist");
const staticDir = fs.existsSync(reactDist) ? reactDist : path.join(__dirname, "..", "public");
app.use(express.static(staticDir));
app.use(express.json());

const roomManager = new RoomManager(io);

// simple REST endpoint to list public rooms (also available via socket)
app.get("/api/rooms", (req, res) => {
  res.json(roomManager.getPublicRooms());
});

app.get("/health", (req, res) => res.json({ ok: true }));

// MessageHandler-style wiring: each socket connection gets its handlers registered here
io.on("connection", (socket) => {
  let currentRoomId = null;
  let currentPlayerId = null;

  const getRoom = () => roomManager.getRoom(currentRoomId);

  socket.on("create_room", ({ hostName, settings }, cb) => {
    const room = roomManager.createRoom(hostName, settings);
    const player = new Player(nanoid(8), socket.id, hostName || "Host");
    room.addPlayer(player);

    currentRoomId = room.id;
    currentPlayerId = player.id;
    socket.join(room.id);
    socket.data.playerId = player.id;

    cb && cb({ ok: true, roomId: room.id, playerId: player.id, state: room.lobbyState() });
  });

  socket.on("join_room", ({ roomId, playerName }, cb) => {
    const room = roomManager.getRoom(roomId);
    if (!room) return cb && cb({ ok: false, error: "Room not found" });
    if (room.isFull()) return cb && cb({ ok: false, error: "Room is full" });
    if (room.game.phase !== "lobby") return cb && cb({ ok: false, error: "Game already in progress" });

    const player = new Player(nanoid(8), socket.id, playerName || "Player");
    room.addPlayer(player);

    currentRoomId = room.id;
    currentPlayerId = player.id;
    socket.join(room.id);
    socket.data.playerId = player.id;

    cb && cb({ ok: true, roomId: room.id, playerId: player.id, state: room.lobbyState() });
    socket.to(room.id).emit("player_joined", { player: player.toJSON(), players: room.getPlayers().map((p) => p.toJSON()) });
  });

  socket.on("rejoin_room", ({ roomId, playerId }, cb) => {
    const room = roomManager.getRoom(roomId);
    if (!room) return cb && cb({ ok: false, error: "Room not found" });
    const player = room.getPlayer(playerId);
    if (!player) return cb && cb({ ok: false, error: "Player not found" });

    player.socketId = socket.id;
    player.connected = true;
    currentRoomId = room.id;
    currentPlayerId = player.id;
    socket.join(room.id);
    socket.data.playerId = player.id;

    cb && cb({
      ok: true,
      roomId: room.id,
      playerId: player.id,
      state: room.lobbyState(),
      gameState: room.game.phase !== "lobby" ? room.game.getStateForPlayer(player.id) : null
    });
    socket.to(room.id).emit("player_joined", { player: player.toJSON(), players: room.getPlayers().map((p) => p.toJSON()) });
  });

  socket.on("update_settings", (settings) => {
    const room = getRoom();
    if (!room) return;
    const player = room.getPlayer(currentPlayerId);
    if (!player || !player.isHost) return;
    Object.assign(room.settings, settings);
    room.broadcast("settings_updated", room.settings);
  });

  socket.on("toggle_ready", () => {
    const room = getRoom();
    if (!room) return;
    const player = room.getPlayer(currentPlayerId);
    if (!player) return;
    player.isReady = !player.isReady;
    room.broadcast("player_updated", { players: room.getPlayers().map((p) => p.toJSON()) });
  });

  socket.on("start_game", () => {
    const room = getRoom();
    if (!room) return;
    const player = room.getPlayer(currentPlayerId);
    if (!player || !player.isHost) return;
    if (room.players.size < 2) return;
    room.game.start();
  });

  socket.on("word_chosen", ({ word }) => {
    const room = getRoom();
    if (!room) return;
    if (room.game.drawerId !== currentPlayerId) return;
    room.game.chooseWord(word);
  });

  // --- Drawing events ---
  socket.on("draw_start", (data) => {
    const room = getRoom();
    if (!room || room.game.drawerId !== currentPlayerId) return;
    const stroke = { type: "start", ...data };
    room.game.recordStroke(stroke);
    socket.to(room.id).emit("draw_data", stroke);
  });

  socket.on("draw_move", (data) => {
    const room = getRoom();
    if (!room || room.game.drawerId !== currentPlayerId) return;
    const stroke = { type: "move", ...data };
    room.game.recordStroke(stroke);
    socket.to(room.id).emit("draw_data", stroke);
  });

  socket.on("draw_end", () => {
    const room = getRoom();
    if (!room || room.game.drawerId !== currentPlayerId) return;
    const stroke = { type: "end" };
    room.game.recordStroke(stroke);
    socket.to(room.id).emit("draw_data", stroke);
  });

  socket.on("canvas_clear", () => {
    const room = getRoom();
    if (!room || room.game.drawerId !== currentPlayerId) return;
    room.game.clearStrokes();
    room.broadcast("canvas_clear", {});
  });

  socket.on("draw_undo", () => {
    const room = getRoom();
    if (!room || room.game.drawerId !== currentPlayerId) return;
    room.game.undoLastStroke();
    room.broadcast("draw_undo", {});
  });

  // --- Chat / guessing ---
  socket.on("guess", ({ text }) => {
    const room = getRoom();
    if (!room) return;
    const player = room.getPlayer(currentPlayerId);
    if (!player) return;

    const result = room.game.checkGuess(currentPlayerId, text);

    if (result === null) {
      // not in drawing phase, or is drawer, or already guessed -> treat as normal chat
      room.broadcast("chat_message", { playerId: player.id, playerName: player.name, text });
      return;
    }

    if (result.correct) {
      room.broadcast("guess_result", {
        correct: true,
        playerId: player.id,
        playerName: player.name,
        points: result.points
      });
      room.broadcast("chat_message", {
        playerId: "system",
        playerName: "System",
        text: `${player.name} guessed the word!`,
        system: true
      });
      room.game.broadcastState();
    } else {
      // show as a regular (wrong) guess in chat to everyone
      room.broadcast("chat_message", { playerId: player.id, playerName: player.name, text });
    }
  });

  socket.on("chat", ({ text }) => {
    const room = getRoom();
    if (!room) return;
    const player = room.getPlayer(currentPlayerId);
    if (!player) return;
    room.broadcast("chat_message", { playerId: player.id, playerName: player.name, text });
  });

  socket.on("leave_room", () => {
    handleDisconnect();
  });

  socket.on("disconnect", () => {
    handleDisconnect();
  });

  function handleDisconnect() {
    const room = getRoom();
    if (!room) return;
    room.removePlayer(currentPlayerId);
    socket.to(room.id).emit("player_left", {
      playerId: currentPlayerId,
      players: room.getPlayers().map((p) => p.toJSON())
    });
    roomManager.cleanupEmptyRooms();
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Skribbl clone server running on port ${PORT}`);
});

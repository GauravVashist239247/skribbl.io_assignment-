const { Game } = require("./Game");

const DEFAULT_SETTINGS = {
  maxPlayers: 8,
  rounds: 3,
  drawTime: 80,
  wordCount: 3,
  hints: 2,
  isPrivate: false
};

// Room.js - encapsulates a single game room (lobby + players + game instance)
class Room {
  constructor(id, io, hostName, settings = {}) {
    this.id = id;
    this.io = io;
    this.players = new Map(); // playerId -> Player
    this.settings = { ...DEFAULT_SETTINGS, ...settings };
    this.game = new Game(this, this.settings);
    this.createdAt = Date.now();
  }

  addPlayer(player) {
    if (this.players.size === 0) player.isHost = true;
    this.players.set(player.id, player);
  }

  removePlayer(playerId) {
    const player = this.players.get(playerId);
    if (!player) return;
    player.connected = false;
    // promote a new host if needed
    if (player.isHost) {
      const next = [...this.players.values()].find((p) => p.id !== playerId && p.connected);
      if (next) next.isHost = true;
    }
    // only fully remove from lobby (pre-game); keep in game for score continuity
    if (this.game.phase === "lobby") {
      this.players.delete(playerId);
    }
  }

  getPlayer(id) {
    return this.players.get(id);
  }

  getPlayers() {
    return [...this.players.values()];
  }

  isFull() {
    return this.players.size >= this.settings.maxPlayers;
  }

  isEmpty() {
    return [...this.players.values()].every((p) => !p.connected);
  }

  broadcast(event, payload) {
    this.io.to(this.id).emit(event, payload);
  }

  emitToPlayer(playerId, event, payload) {
    const player = this.players.get(playerId);
    if (player) this.io.to(player.socketId).emit(event, payload);
  }

  lobbyState() {
    return {
      roomId: this.id,
      settings: this.settings,
      players: this.getPlayers().map((p) => p.toJSON()),
      phase: this.game.phase
    };
  }
}

module.exports = { Room, DEFAULT_SETTINGS };

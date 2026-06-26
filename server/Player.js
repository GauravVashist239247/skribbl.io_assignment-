// Player.js - represents a single connected player
class Player {
  constructor(id, socketId, name) {
    this.id = id;               // stable player id (persists across reconnects within a session)
    this.socketId = socketId;   // current socket connection id
    this.name = name;
    this.score = 0;
    this.isHost = false;
    this.isReady = false;
    this.hasGuessedCorrectly = false;
    this.connected = true;
  }

  addPoints(points) {
    this.score += points;
  }

  resetRoundState() {
    this.hasGuessedCorrectly = false;
  }

  resetGameState() {
    this.score = 0;
    this.isReady = false;
    this.hasGuessedCorrectly = false;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      score: this.score,
      isHost: this.isHost,
      isReady: this.isReady,
      hasGuessedCorrectly: this.hasGuessedCorrectly,
      connected: this.connected
    };
  }
}

module.exports = Player;

const { getRandomWords } = require("./words");

const PHASE = {
  LOBBY: "lobby",
  CHOOSING_WORD: "choosing_word",
  DRAWING: "drawing",
  ROUND_END: "round_end",
  GAME_OVER: "game_over"
};

// Game.js - encapsulates round/turn/scoring logic for one Room
class Game {
  constructor(room, settings) {
    this.room = room; // back-reference to broadcast/IO
    this.settings = settings; // { rounds, drawTime, wordCount, hints, maxPlayers }
    this.phase = PHASE.LOBBY;
    this.round = 0;
    this.turnOrder = [];
    this.turnIndex = -1;
    this.drawerId = null;
    this.word = null;
    this.wordOptions = [];
    this.revealedIndices = new Set();
    this.timer = null;
    this.timeLeft = 0;
    this.strokes = []; // current canvas stroke history (for late joiners / undo)
  }

  start() {
    this.round = 0;
    this.turnOrder = this.room.getPlayers().map((p) => p.id);
    this.turnIndex = -1;
    this.room.getPlayers().forEach((p) => p.resetGameState());
    this.nextTurn();
  }

  // Advance to next drawer; bump round count when we wrap around
  nextTurn() {
    this._clearTimer();
    this.strokes = [];
    this.turnIndex++;

    if (this.turnIndex >= this.turnOrder.length) {
      this.turnIndex = 0;
      this.round++;
    }
    if (this.round === 0) this.round = 1;

    if (this.round > this.settings.rounds) {
      this.endGame();
      return;
    }

    // skip disconnected players
    let attempts = 0;
    while (attempts < this.turnOrder.length) {
      const candidateId = this.turnOrder[this.turnIndex];
      const player = this.room.getPlayer(candidateId);
      if (player && player.connected) break;
      this.turnIndex = (this.turnIndex + 1) % this.turnOrder.length;
      attempts++;
    }

    this.drawerId = this.turnOrder[this.turnIndex];
    this.word = null;
    this.revealedIndices = new Set();
    this.room.getPlayers().forEach((p) => p.resetRoundState());

    this.wordOptions = getRandomWords(this.settings.wordCount || 3);
    this.phase = PHASE.CHOOSING_WORD;

    this.room.broadcast("round_start", {
      round: this.round,
      totalRounds: this.settings.rounds,
      drawerId: this.drawerId,
      wordOptions: this.wordOptions, // server sends to everyone but client UI only shows chooser
      drawTime: this.settings.drawTime
    });

    this.room.emitToPlayer(this.drawerId, "your_word_options", {
      wordOptions: this.wordOptions
    });

    this.broadcastState();

    // auto-pick a word if drawer doesn't choose within 10s
    this.chooseTimer = setTimeout(() => {
      if (this.phase === PHASE.CHOOSING_WORD) {
        this.chooseWord(this.wordOptions[0]);
      }
    }, 10000);
  }

  chooseWord(word) {
    if (this.phase !== PHASE.CHOOSING_WORD) return;
    clearTimeout(this.chooseTimer);
    this.word = word;
    this.phase = PHASE.DRAWING;
    this.timeLeft = this.settings.drawTime;

    this.room.broadcast("word_picked", {
      drawerId: this.drawerId,
      blanks: this._wordToBlanks(),
      timeLeft: this.timeLeft
    });

    this._scheduleHints();
    this._startCountdown();
    this.broadcastState();
  }

  _startCountdown() {
    this._clearTimer();
    this.timer = setInterval(() => {
      this.timeLeft--;
      this.room.broadcast("time_update", { timeLeft: this.timeLeft });
      if (this.timeLeft <= 0) {
        this.endRound(null);
      }
    }, 1000);
  }

  _scheduleHints() {
    const hintCount = this.settings.hints || 0;
    if (!hintCount || !this.word) return;
    const interval = Math.floor((this.settings.drawTime * 1000) / (hintCount + 1));
    for (let i = 1; i <= hintCount; i++) {
      setTimeout(() => {
        if (this.phase !== PHASE.DRAWING || !this.word) return;
        this._revealRandomLetter();
        this.room.broadcast("hint", { blanks: this._wordToBlanks() });
      }, interval * i);
    }
  }

  _revealRandomLetter() {
    const letterIndices = [...this.word].reduce((acc, ch, i) => {
      if (ch !== " " && !this.revealedIndices.has(i)) acc.push(i);
      return acc;
    }, []);
    if (!letterIndices.length) return;
    const idx = letterIndices[Math.floor(Math.random() * letterIndices.length)];
    this.revealedIndices.add(idx);
  }

  _wordToBlanks() {
    if (!this.word) return "";
    return [...this.word]
      .map((ch, i) => (ch === " " ? "  " : this.revealedIndices.has(i) ? ch : "_"))
      .join(" ");
  }

  // Word matching: case-insensitive, trimmed, exact match (simple + robust for MVP)
  checkGuess(playerId, text) {
    if (this.phase !== PHASE.DRAWING || !this.word) return null;
    const player = this.room.getPlayer(playerId);
    if (!player || player.id === this.drawerId || player.hasGuessedCorrectly) return null;

    const normalize = (s) => s.trim().toLowerCase().replace(/\s+/g, " ");
    const isCorrect = normalize(text) === normalize(this.word);

    if (isCorrect) {
      player.hasGuessedCorrectly = true;
      const points = this._calculatePoints();
      player.addPoints(points);

      // drawer also gets a small bonus per correct guesser
      const drawer = this.room.getPlayer(this.drawerId);
      if (drawer) drawer.addPoints(10);

      const allGuessed = this.room
        .getPlayers()
        .filter((p) => p.id !== this.drawerId && p.connected)
        .every((p) => p.hasGuessedCorrectly);

      if (allGuessed) {
        setTimeout(() => this.endRound(this.word), 800);
      }

      return { correct: true, points, player };
    }
    return { correct: false, player };
  }

  _calculatePoints() {
    // more points if guessed earlier / faster
    const base = 100;
    const ratio = this.timeLeft / this.settings.drawTime;
    return Math.max(20, Math.round(base * ratio));
  }

  endRound(revealedWord) {
    this._clearTimer();
    clearTimeout(this.chooseTimer);
    const wordWas = revealedWord || this.word;
    this.phase = PHASE.ROUND_END;

    this.room.broadcast("round_end", {
      word: wordWas,
      scores: this.room.getPlayers().map((p) => p.toJSON()),
      nextDrawerIndex: (this.turnIndex + 1) % this.turnOrder.length
    });
    this.broadcastState();

    setTimeout(() => {
      if (this.phase === PHASE.ROUND_END) this.nextTurn();
    }, 5000);
  }

  endGame() {
    this._clearTimer();
    this.phase = PHASE.GAME_OVER;
    const leaderboard = [...this.room.getPlayers()].sort((a, b) => b.score - a.score).map((p) => p.toJSON());
    this.room.broadcast("game_over", {
      winner: leaderboard[0] || null,
      leaderboard
    });
    this.broadcastState();
  }

  broadcastState() {
    this.room.broadcast("game_state", this.getStateForBroadcast());
  }

  getStateForBroadcast() {
    return {
      phase: this.phase,
      round: this.round,
      totalRounds: this.settings.rounds,
      drawerId: this.drawerId,
      blanks: this.phase === PHASE.DRAWING || this.phase === PHASE.ROUND_END ? this._wordToBlanks() : null,
      wordLength: this.word ? this.word.length : null,
      timeLeft: this.timeLeft,
      players: this.room.getPlayers().map((p) => p.toJSON())
    };
  }

  // state for a player who just joined mid-game (drawer sees actual word)
  getStateForPlayer(playerId) {
    const base = this.getStateForBroadcast();
    if (playerId === this.drawerId && this.word) {
      base.word = this.word;
    }
    base.strokes = this.strokes;
    return base;
  }

  recordStroke(stroke) {
    this.strokes.push(stroke);
  }

  clearStrokes() {
    this.strokes = [];
  }

  undoLastStroke() {
    // remove strokes belonging to the last "segment" (a draw_start..draw_end group)
    let i = this.strokes.length - 1;
    while (i >= 0 && this.strokes[i].type !== "start") i--;
    if (i >= 0) this.strokes = this.strokes.slice(0, i);
  }

  _clearTimer() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

module.exports = { Game, PHASE };

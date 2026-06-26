// client.js - frontend logic for Skribblz

const socket = io();

const state = {
  myPlayerId: null,
  roomId: null,
  isHost: false,
  drawerId: null,
  players: [],
  settings: null,
  color: "#000000",
  brushSize: 6,
  isErasing: false,
  isDrawing: false
};

// ---------- Screen management ----------
function showScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

// ---------- Persistence for rejoin on refresh ----------
function saveSession() {
  sessionStorage.setItem("skribblz_session", JSON.stringify({ roomId: state.roomId, playerId: state.myPlayerId }));
}
function clearSession() {
  sessionStorage.removeItem("skribblz_session");
}

// ---------- Home screen ----------
const elName = document.getElementById("input-name");
const elRoomCode = document.getElementById("input-room-code");
const elHomeError = document.getElementById("home-error");

document.getElementById("btn-create-room").addEventListener("click", () => {
  if (!elName.value.trim()) return showError("Enter a nickname first");
  showScreen("screen-settings");
});

document.getElementById("btn-back-home").addEventListener("click", () => showScreen("screen-home"));

document.getElementById("btn-confirm-create").addEventListener("click", () => {
  const settings = {
    maxPlayers: clamp(+document.getElementById("set-maxplayers").value, 2, 20),
    rounds: clamp(+document.getElementById("set-rounds").value, 2, 10),
    drawTime: clamp(+document.getElementById("set-drawtime").value, 15, 240),
    wordCount: clamp(+document.getElementById("set-wordcount").value, 1, 5),
    hints: clamp(+document.getElementById("set-hints").value, 0, 5),
    isPrivate: document.getElementById("set-private").checked
  };
  socket.emit("create_room", { hostName: elName.value.trim(), settings }, (res) => {
    if (!res.ok) return showError(res.error || "Failed to create room");
    enterLobby(res);
  });
});

document.getElementById("btn-join-room").addEventListener("click", () => {
  if (!elName.value.trim()) return showError("Enter a nickname first");
  if (!elRoomCode.value.trim()) return showError("Enter a room code");
  socket.emit("join_room", { roomId: elRoomCode.value.trim().toUpperCase(), playerName: elName.value.trim() }, (res) => {
    if (!res.ok) return showError(res.error || "Failed to join room");
    enterLobby(res);
  });
});

function showError(msg) {
  elHomeError.textContent = msg;
  setTimeout(() => (elHomeError.textContent = ""), 4000);
}

function clamp(v, min, max) { return Math.min(max, Math.max(min, v || min)); }

// Auto-join via ?room=CODE in URL
const urlParams = new URLSearchParams(window.location.search);
const prefillRoom = urlParams.get("room");
if (prefillRoom) elRoomCode.value = prefillRoom;

// Attempt rejoin if session exists (e.g. after refresh)
const savedSession = sessionStorage.getItem("skribblz_session");
if (savedSession) {
  try {
    const { roomId, playerId } = JSON.parse(savedSession);
    if (roomId && playerId) {
      socket.emit("rejoin_room", { roomId, playerId }, (res) => {
        if (res.ok) {
          enterLobby(res);
          if (res.gameState) enterGameScreen(res.gameState);
        } else {
          clearSession();
        }
      });
    }
  } catch (e) { clearSession(); }
}

// ---------- Lobby ----------
function enterLobby(res) {
  state.myPlayerId = res.playerId;
  state.roomId = res.roomId;
  state.settings = res.state.settings;
  state.players = res.state.players;
  saveSession();

  document.getElementById("lobby-room-code").textContent = res.roomId;
  renderLobbySummary();
  renderLobbyPlayers();
  showScreen("screen-lobby");
}

function renderLobbySummary() {
  const s = state.settings;
  document.getElementById("lobby-settings-summary").textContent =
    `${s.rounds} rounds · ${s.drawTime}s draw time · up to ${s.maxPlayers} players · ${s.hints} hints` + (s.isPrivate ? " · Private" : "");
}

function renderLobbyPlayers() {
  const list = document.getElementById("lobby-player-list");
  list.innerHTML = "";
  state.players.forEach((p) => {
    const row = document.createElement("div");
    row.className = "player-row";
    row.innerHTML = `<span>${escapeHtml(p.name)} ${p.isHost ? '<span class="badge">HOST</span>' : ""}</span>
      <span>${p.isReady ? "✅ Ready" : "⌛ Waiting"}</span>`;
    list.appendChild(row);
  });

  const me = state.players.find((p) => p.id === state.myPlayerId);
  state.isHost = !!(me && me.isHost);
  document.getElementById("btn-start-game").style.display = state.isHost ? "inline-block" : "none";
}

document.getElementById("btn-ready").addEventListener("click", () => socket.emit("toggle_ready"));
document.getElementById("btn-start-game").addEventListener("click", () => socket.emit("start_game"));

document.getElementById("btn-copy-link").addEventListener("click", () => {
  const url = `${window.location.origin}${window.location.pathname}?room=${state.roomId}`;
  navigator.clipboard.writeText(url).then(() => {
    const btn = document.getElementById("btn-copy-link");
    const old = btn.textContent;
    btn.textContent = "Copied!";
    setTimeout(() => (btn.textContent = old), 1500);
  });
});

socket.on("player_joined", ({ players }) => { state.players = players; renderLobbyPlayers(); renderGamePlayers(); });
socket.on("player_left", ({ players }) => { state.players = players; renderLobbyPlayers(); renderGamePlayers(); });
socket.on("player_updated", ({ players }) => { state.players = players; renderLobbyPlayers(); renderGamePlayers(); });
socket.on("settings_updated", (settings) => { state.settings = settings; renderLobbySummary(); });

// ---------- Game screen ----------
const canvas = document.getElementById("draw-canvas");
const ctx = canvas.getContext("2d");
let lastPoint = null;

const PALETTE = [
  "#000000", "#ffffff", "#888888", "#e74c3c", "#e67e22", "#f1c40f",
  "#2ecc71", "#1abc9c", "#3498db", "#6c5ce7", "#e84393", "#795548"
];

function buildPalette() {
  const wrap = document.getElementById("color-palette");
  wrap.innerHTML = "";
  PALETTE.forEach((color) => {
    const sw = document.createElement("div");
    sw.className = "color-swatch" + (color === state.color ? " active" : "");
    sw.style.background = color;
    sw.addEventListener("click", () => {
      state.color = color;
      state.isErasing = false;
      document.getElementById("btn-eraser").classList.remove("active");
      [...wrap.children].forEach((c) => c.classList.remove("active"));
      sw.classList.add("active");
    });
    wrap.appendChild(sw);
  });
}
buildPalette();

document.getElementById("brush-size").addEventListener("input", (e) => { state.brushSize = +e.target.value; });

document.getElementById("btn-eraser").addEventListener("click", (e) => {
  state.isErasing = !state.isErasing;
  e.target.classList.toggle("active", state.isErasing);
});

document.getElementById("btn-clear").addEventListener("click", () => {
  if (!isDrawer()) return;
  socket.emit("canvas_clear");
});

document.getElementById("btn-undo").addEventListener("click", () => {
  if (!isDrawer()) return;
  socket.emit("draw_undo");
});

function isDrawer() { return state.drawerId === state.myPlayerId; }

function setCanvasInteractivity() {
  canvas.style.cursor = isDrawer() ? "crosshair" : "not-allowed";
  document.getElementById("toolbar").style.opacity = isDrawer() ? "1" : "0.4";
  document.getElementById("toolbar").style.pointerEvents = isDrawer() ? "auto" : "none";
}

function getCanvasPoint(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
}

function drawSegment(p1, p2, color, size) {
  ctx.strokeStyle = color;
  ctx.lineWidth = size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.stroke();
}

function startDraw(e) {
  if (!isDrawer()) return;
  e.preventDefault();
  state.isDrawing = true;
  const p = getCanvasPoint(e);
  lastPoint = p;
  const color = state.isErasing ? "#ffffff" : state.color;
  socket.emit("draw_start", { x: p.x, y: p.y, color, size: state.brushSize });
  drawSegment(p, { x: p.x + 0.1, y: p.y + 0.1 }, color, state.brushSize);
}

function moveDraw(e) {
  if (!isDrawer() || !state.isDrawing) return;
  e.preventDefault();
  const p = getCanvasPoint(e);
  const color = state.isErasing ? "#ffffff" : state.color;
  drawSegment(lastPoint, p, color, state.brushSize);
  socket.emit("draw_move", { x: p.x, y: p.y, color, size: state.brushSize });
  lastPoint = p;
}

function endDraw(e) {
  if (!isDrawer() || !state.isDrawing) return;
  state.isDrawing = false;
  socket.emit("draw_end");
}

canvas.addEventListener("mousedown", startDraw);
canvas.addEventListener("mousemove", moveDraw);
canvas.addEventListener("mouseup", endDraw);
canvas.addEventListener("mouseleave", endDraw);
canvas.addEventListener("touchstart", startDraw, { passive: false });
canvas.addEventListener("touchmove", moveDraw, { passive: false });
canvas.addEventListener("touchend", endDraw);

// receive strokes from server (other viewers, including replay of history on join)
let remoteLast = null;
socket.on("draw_data", (stroke) => {
  if (stroke.type === "start") {
    remoteLast = { x: stroke.x, y: stroke.y };
    drawSegment(remoteLast, { x: stroke.x + 0.1, y: stroke.y + 0.1 }, stroke.color, stroke.size);
  } else if (stroke.type === "move") {
    const p = { x: stroke.x, y: stroke.y };
    if (remoteLast) drawSegment(remoteLast, p, stroke.color, stroke.size);
    remoteLast = p;
  } else if (stroke.type === "end") {
    remoteLast = null;
  }
});

socket.on("canvas_clear", () => clearCanvas());
socket.on("draw_undo", () => redrawFromHistory());

function clearCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function redrawFromHistory(strokes) {
  clearCanvas();
  let last = null;
  (strokes || []).forEach((s) => {
    if (s.type === "start") { last = { x: s.x, y: s.y }; drawSegment(last, { x: s.x + 0.1, y: s.y + 0.1 }, s.color, s.size); }
    else if (s.type === "move") { const p = { x: s.x, y: s.y }; if (last) drawSegment(last, p, s.color, s.size); last = p; }
    else if (s.type === "end") { last = null; }
  });
}

// ---------- Game state handling ----------
socket.on("round_start", ({ round, totalRounds, drawerId, drawTime }) => {
  enterGameScreen();
  state.drawerId = drawerId;
  document.getElementById("game-round").textContent = round;
  document.getElementById("game-total-rounds").textContent = totalRounds;
  document.getElementById("game-timer").textContent = drawTime;
  document.getElementById("game-word-display").textContent = "Choosing word...";
  hideAllOverlays();
  clearCanvas();
  setCanvasInteractivity();
  addSystemMessage(`${nameFor(drawerId)} is choosing a word...`);
});

socket.on("your_word_options", ({ wordOptions }) => {
  const overlay = document.getElementById("word-choice-overlay");
  const btnWrap = document.getElementById("word-choice-buttons");
  btnWrap.innerHTML = "";
  wordOptions.forEach((w) => {
    const btn = document.createElement("button");
    btn.className = "btn primary";
    btn.textContent = w;
    btn.addEventListener("click", () => {
      socket.emit("word_chosen", { word: w });
      overlay.classList.add("hidden");
    });
    btnWrap.appendChild(btn);
  });
  overlay.classList.remove("hidden");
});

socket.on("word_picked", ({ blanks, timeLeft }) => {
  document.getElementById("word-choice-overlay").classList.add("hidden");
  document.getElementById("game-word-display").textContent = blanks;
  document.getElementById("game-timer").textContent = timeLeft;
});

socket.on("hint", ({ blanks }) => {
  document.getElementById("game-word-display").textContent = blanks;
});

socket.on("time_update", ({ timeLeft }) => {
  document.getElementById("game-timer").textContent = timeLeft;
});

socket.on("guess_result", ({ playerName, correct, points }) => {
  if (correct) addSystemMessage(`🎉 ${playerName} guessed the word! +${points} pts`);
});

socket.on("chat_message", ({ playerName, text, system }) => {
  if (system) addSystemMessage(text);
  else addChatMessage(playerName, text);
});

socket.on("round_end", ({ word, scores }) => {
  state.players = scores;
  renderGamePlayers();
  document.getElementById("round-end-word").textContent = word;
  document.getElementById("round-end-overlay").classList.remove("hidden");
  setTimeout(() => document.getElementById("round-end-overlay").classList.add("hidden"), 4800);
});

socket.on("game_over", ({ winner, leaderboard }) => {
  state.players = leaderboard;
  renderGamePlayers();
  document.getElementById("game-over-winner").textContent = winner ? `${winner.name} wins with ${winner.score} points!` : "No winner";
  const ol = document.getElementById("game-over-leaderboard");
  ol.innerHTML = "";
  leaderboard.forEach((p) => {
    const li = document.createElement("li");
    li.textContent = `${p.name} — ${p.score} pts`;
    ol.appendChild(li);
  });
  document.getElementById("game-over-overlay").classList.remove("hidden");
});

document.getElementById("btn-back-to-home").addEventListener("click", () => {
  clearSession();
  window.location.href = window.location.pathname;
});

socket.on("game_state", (gs) => {
  state.drawerId = gs.drawerId;
  state.players = gs.players;
  renderGamePlayers();
  setCanvasInteractivity();
  if (gs.blanks) document.getElementById("game-word-display").textContent = gs.blanks;
  if (gs.timeLeft) document.getElementById("game-timer").textContent = gs.timeLeft;
  if (gs.round) {
    document.getElementById("game-round").textContent = gs.round;
    document.getElementById("game-total-rounds").textContent = gs.totalRounds;
  }
});

function enterGameScreen(initialGameState) {
  showScreen("screen-game");
  setCanvasInteractivity();
  if (initialGameState) {
    state.drawerId = initialGameState.drawerId;
    state.players = initialGameState.players;
    renderGamePlayers();
    if (initialGameState.strokes) redrawFromHistory(initialGameState.strokes);
    if (initialGameState.blanks) document.getElementById("game-word-display").textContent = initialGameState.blanks;
    if (initialGameState.word && initialGameState.drawerId === state.myPlayerId) {
      document.getElementById("game-word-display").textContent = initialGameState.word;
    }
  }
}

function hideAllOverlays() {
  document.querySelectorAll(".overlay").forEach((o) => o.classList.add("hidden"));
}

function renderGamePlayers() {
  const list = document.getElementById("game-player-list");
  if (!list) return;
  list.innerHTML = "";
  [...state.players].sort((a, b) => b.score - a.score).forEach((p) => {
    const row = document.createElement("div");
    row.className = "player-row" + (p.id === state.drawerId ? " drawer" : "") + (p.hasGuessedCorrectly ? " guessed" : "");
    row.innerHTML = `<span>${p.id === state.drawerId ? "✏️ " : ""}${escapeHtml(p.name)}</span><span>${p.score}</span>`;
    list.appendChild(row);
  });
}

function nameFor(id) {
  const p = state.players.find((pl) => pl.id === id);
  return p ? p.name : "Someone";
}

function addChatMessage(name, text) {
  const wrap = document.getElementById("chat-messages");
  const div = document.createElement("div");
  div.className = "msg";
  div.innerHTML = `<span class="name">${escapeHtml(name)}:</span> ${escapeHtml(text)}`;
  wrap.appendChild(div);
  wrap.scrollTop = wrap.scrollHeight;
}

function addSystemMessage(text) {
  const wrap = document.getElementById("chat-messages");
  const div = document.createElement("div");
  div.className = "msg system";
  div.textContent = text;
  wrap.appendChild(div);
  wrap.scrollTop = wrap.scrollHeight;
}

document.getElementById("chat-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = document.getElementById("chat-input");
  const text = input.value.trim();
  if (!text) return;
  socket.emit("guess", { text });
  input.value = "";
});

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

clearCanvas();

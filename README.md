# Skribblz — a skribbl.io Clone

A real-time multiplayer drawing & guessing game (pictionary-style), built with Node.js, Express,
Socket.IO, and vanilla JS + HTML5 Canvas.

**Live URL:** _add your deployed URL here after deploying, e.g. `https://your-skribbl-clone.onrender.com`_

## Features implemented

- Create / join rooms (room codes + shareable invite link), configurable settings
  (max players, rounds, draw time, word count, hints, private rooms)
- Lobby with player list, ready-up, host-only "Start Game"
- Turn-based rounds: one drawer per turn, rotates through all players, N rounds
- Real-time drawing sync over WebSockets (Socket.IO) — brush color, size, eraser, undo, clear
- Word selection (drawer picks 1 of N words), blanked-word display with progressive hint reveal
- Guessing via chat box; word matching is case-insensitive and trims whitespace;
  correct guesses are removed from chat (shown as a "X guessed the word!" system message) so
  the word isn't leaked to other players
- Scoring (earlier/faster guesses = more points; drawer gets a small bonus per correct guesser),
  live leaderboard, end-of-game winner screen
- Reconnect support: refreshing the page rejoins your room/game via `sessionStorage`
- OOP server architecture: `Player`, `Room`, `Game`, `RoomManager` classes (see Architecture below)

## Tech stack

- **Backend:** Node.js + Express + Socket.IO (in-memory state — no DB needed for MVP)
- **Frontend:** React 18 + Vite (functional components, hooks, Context API for shared game state)
- **Realtime:** Socket.IO (handles reconnects, room broadcasting, fallback transports automatically)

No database was used for the MVP — all room/game state lives in memory on the server process,
which is sufficient for the assignment scope. (See "Extending" below for how you'd add persistence.)

## Project structure

```
skribbl-clone/
├── server/
│   ├── index.js         # Express + Socket.IO server, wires all socket events
│   ├── RoomManager.js    # Tracks all active Room instances, generates room codes
│   ├── Room.js           # One room: players, settings, broadcast helpers
│   ├── Game.js            # Round/turn logic, word picking, scoring, timers
│   ├── Player.js          # Player state (score, ready, host, etc.)
│   └── words.js           # Categorized word list + random word picker
├── client/                # React frontend (Vite)
│   ├── src/
│   │   ├── main.jsx        # React entry point
│   │   ├── App.jsx          # Screen router (home/settings/lobby/game)
│   │   ├── socket.js         # Shared socket.io-client instance
│   │   ├── GameContext.jsx    # Context + reducer holding all shared game state,
│   │   │                       wires every socket event listener in one place
│   │   ├── styles.css
│   │   └── components/
│   │       ├── Home.jsx, SettingsScreen.jsx, Lobby.jsx, GameScreen.jsx
│   │       ├── Canvas.jsx      # Drawing input + remote stroke replay (uses refs, not state, for perf)
│   │       ├── Toolbar.jsx, PlayerList.jsx, ChatPanel.jsx, Overlays.jsx
│   └── vite.config.js      # Dev server proxies /socket.io to backend on :3001
├── public/                 # Legacy vanilla-JS frontend (kept as a fallback/reference;
│                              the server serves client/dist instead once you build it)
└── package.json
```

## Running locally

Requires Node.js 18+.

```bash
# 1. Install backend deps
npm install

# 2. Install frontend deps
cd client && npm install && cd ..

# 3a. Development (hot reload): run both in separate terminals
npm run dev              # terminal 1: backend on :3001
cd client && npm run dev # terminal 2: Vite dev server on :5173 (proxies sockets to :3001)
# open http://localhost:5173

# 3b. OR production-style (single server, no proxy):
npm run build            # builds the React app into client/dist
npm start                # serves client/dist + the API from one server on :3001
# open http://localhost:3001
```

Open the URL in two or more browser tabs/windows to simulate multiple players (one as host,
copy the room code or invite link into the others).

> Note: the legacy vanilla-JS version still lives in `/public` for reference, but the server
> now prioritizes serving the React build (`client/dist`) once it exists.

## Deployment

This app is a single Node process that serves both the static frontend (`public/`) and the
Socket.IO WebSocket endpoint — so it deploys cleanly to any platform with WebSocket support
on a single service. **Render** or **Railway** are the simplest:

### Deploy to Render
1. Push this repo to GitHub.
2. On Render: **New → Web Service** → connect the repo.
3. Build command: `npm install && npm run build` (installs backend deps, then builds the React client into `client/dist`)
4. Start command: `npm start`
5. Render auto-detects the `PORT` env var; the app already reads `process.env.PORT`.
6. Once deployed, your live URL will be `https://<your-service-name>.onrender.com`.

### Deploy to Railway
1. Push to GitHub, then **New Project → Deploy from GitHub repo** on Railway.
2. Set build command to `npm install && npm run build` and start command to `npm start`.
3. Railway provides a public URL automatically with WebSocket support enabled.

### Vercel / Netlify note
Vercel and Netlify's serverless functions don't support persistent WebSocket connections (which
this app needs for Socket.IO), so they're not suitable for the combined frontend+backend
deployment used here. If you want to use Vercel/Netlify anyway, you'd need to split the app —
host `public/` as a static site there, and deploy `server/` separately on Render/Railway, then
point `client.js`'s `io()` call at the backend's full URL (e.g. `io("https://your-backend.onrender.com")`).
This project is structured to deploy as a single combined service to avoid that complexity.

After deploying, **update the "Live URL" line at the top of this README** with your real URL.

## Architecture overview

### WebSocket event flow
Socket.IO is used for *all* real-time communication — room/lobby events, game-state transitions,
drawing strokes, and chat/guesses all flow over the same persistent connection per client.
`server/index.js` registers one `io.on("connection", socket => {...})` handler that wires every
event listed in the assignment's event table (`create_room`, `join_room`, `draw_start/move/end`,
`guess`, etc.) to methods on the relevant `Room` / `Game` instance.

### How drawing strokes are captured, sent, and rendered
- On the drawer's canvas, `mousedown`/`touchstart` fires `draw_start` with `{x, y, color, size}`;
  `mousemove`/`touchmove` fires `draw_move` with just `{x, y}` (color/size are resent too, for
  resilience); `mouseup` fires `draw_end`.
- The drawer **also draws locally immediately** (no round-trip wait) for a responsive feel.
- The server (`Game.recordStroke`) appends every stroke to an in-memory `strokes` array for the
  current round (so a player who joins mid-round, or refreshes, can have the canvas replayed via
  `getStateForPlayer`), then re-broadcasts the stroke to everyone else in the room via `draw_data`.
- Viewers listen for `draw_data` and draw line segments between consecutive points
  (`drawSegment` in `client.js`), so strokes render as connected lines rather than disconnected dots.
- `canvas_clear` and `draw_undo` are drawer-only actions, validated server-side
  (`room.game.drawerId !== currentPlayerId` checks reject anyone else), then broadcast so every
  client clears/redraws together. Undo removes the last contiguous start→end stroke "segment"
  from history and the server tells clients to redraw from the remaining history.

### How game state (rounds, turn order, scoring) is managed
- `Game` (in `Game.js`) is the state machine: phases are `lobby → choosing_word → drawing →
  round_end → (repeat) → game_over`.
- `turnOrder` is a fixed array of player IDs snapshotted at game start; `turnIndex` walks through
  it, wrapping around and incrementing `round` each time it wraps, until `round > settings.rounds`.
- Disconnected players are skipped in turn rotation but keep their score (in case they reconnect).
- Scoring: `checkGuess()` normalizes (trim + lowercase + collapse whitespace) both the guess and
  the secret word for comparison. Correct guessers earn `max(20, 100 * timeLeft/drawTime)` points
  (faster = more points); the drawer earns a flat +10 bonus per correct guess. When everyone
  (except the drawer) has guessed correctly, the round ends early.
- Hints reveal one random unrevealed letter at evenly spaced intervals based on `settings.hints`.

### Word-matching logic
Implemented in `Game.checkGuess()`: both strings are `.trim().toLowerCase()` and have internal
whitespace collapsed to single spaces before an exact-match comparison — so trailing spaces,
casing, or double-spacing don't cause a false negative. (Partial-credit/fuzzy matching was left
as a possible extension — see below.)

### Deployment setup & platform constraints
The app is a single Express + Socket.IO server, so it needs a host that keeps a long-lived
process with WebSocket support (Render/Railway, not Vercel/Netlify serverless functions — see the
deployment note above). `server/index.js` binds to `process.env.PORT` so it works on any of these
platforms without code changes.

## Functional requirements checklist (per assignment)

**Must have** — all implemented: configurable room creation, join via link/code, lobby with
ready-up + host start, turn-based rounds, real-time drawing sync, word selection (1–5 choices),
guessing with scoring, leaderboard, game-end winner screen, brush/colors/undo/clear.

**Should have** — all implemented: hints (configurable 0–5), chat (guesses double as chat,
shown to everyone; correct answers are hidden and replaced with a system message), draw-time
countdown, private rooms.

**Nice to have** — partially implemented: word categories exist in `words.js` (animals, objects,
food, actions, places) though the UI doesn't yet expose category selection; eraser tool is
implemented. Kick/ban, votekick, and multi-language word lists are not implemented — listed below
as extensions.

## Possible extensions (not yet implemented)
- Persistence (PostgreSQL/SQLite) for accounts, historical scores, and custom word lists
- Host moderation: kick / ban / votekick
- Word categories selectable in room settings UI
- Hidden / Combination word modes
- Spectator mode and round replay
- Avatars

## Code walkthrough readiness
The codebase intentionally mirrors the assignment's bonus "OOP for WebSocket servers" suggestion:
`Player`, `Room`, `Game`, and `RoomManager` are plain classes with single responsibilities, and
`server/index.js` acts as the `MessageHandler` — it only wires socket events to method calls on
those classes, with no game logic of its own. This keeps each concern (turn logic, scoring,
room membership, broadcasting) independently testable and easy to explain.

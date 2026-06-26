import { io } from "socket.io-client";

// One shared socket instance for the whole app.
// In dev, Vite proxies /socket.io to the backend (see vite.config.js).
// In production, the backend serves this same origin, so default options work.
export const socket = io(`https://skribbl-io-assignment-backend.onrender.com`);

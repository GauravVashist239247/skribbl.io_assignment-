import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// During `npm run dev`, Vite runs on its own port (5173) and proxies
// Socket.IO + API requests to the backend Express/Socket.IO server (3001).
// In production, `npm run build` outputs static files that the backend
// serves directly (see server/index.js), so no proxy is needed there.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/socket.io": {
        target: "http://localhost:3001",
        ws: true,
      },
      "/api": {
        target: "http://localhost:3001",
      },
    },
  },
  build: {
    outDir: "dist",
  },
});

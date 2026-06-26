import React from "react";
import { socket } from "../socket.js";

const PALETTE = [
  "#000000", "#ffffff", "#888888", "#e74c3c", "#e67e22", "#f1c40f",
  "#2ecc71", "#1abc9c", "#3498db", "#6c5ce7", "#e84393", "#795548"
];

export default function Toolbar({ isDrawer, color, setColor, brushSize, setBrushSize, isErasing, setIsErasing }) {
  return (
    <div className="toolbar" style={{ opacity: isDrawer ? 1 : 0.4, pointerEvents: isDrawer ? "auto" : "none" }}>
      <div className="colors">
        {PALETTE.map((c) => (
          <div
            key={c}
            className={"color-swatch" + (c === color && !isErasing ? " active" : "")}
            style={{ background: c }}
            onClick={() => {
              setColor(c);
              setIsErasing(false);
            }}
          />
        ))}
      </div>
      <input
        type="range"
        min={2}
        max={40}
        value={brushSize}
        onChange={(e) => setBrushSize(+e.target.value)}
      />
      <button
        className={"tool-btn" + (isErasing ? " active" : "")}
        title="Eraser"
        onClick={() => setIsErasing((v) => !v)}
      >
        🧽
      </button>
      <button className="tool-btn" title="Undo" onClick={() => isDrawer && socket.emit("draw_undo")}>
        ↩️
      </button>
      <button className="tool-btn" title="Clear canvas" onClick={() => isDrawer && socket.emit("canvas_clear")}>
        🗑️
      </button>
    </div>
  );
}

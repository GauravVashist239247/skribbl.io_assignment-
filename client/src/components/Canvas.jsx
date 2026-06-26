import React, { useRef, useEffect, useCallback } from "react";
import { socket } from "../socket.js";

function drawSegment(ctx, p1, p2, color, size) {
  ctx.strokeStyle = color;
  ctx.lineWidth = size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.stroke();
}

export default function Canvas({ isDrawer, color, brushSize, isErasing, strokeEvent, strokesHistory }) {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const lastPointRef = useRef(null); // local drawer's last point
  const remoteLastRef = useRef(null); // remote stroke replay's last point
  const isDrawingRef = useRef(false);
  const historyRef = useRef([]); // full stroke history, for redraw-on-undo

  const clearCanvas = useCallback(() => {
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const redrawFromHistory = useCallback(
    (strokes) => {
      clearCanvas();
      let last = null;
      (strokes || []).forEach((s) => {
        if (s.type === "start") {
          last = { x: s.x, y: s.y };
          drawSegment(ctxRef.current, last, { x: s.x + 0.1, y: s.y + 0.1 }, s.color, s.size);
        } else if (s.type === "move") {
          const p = { x: s.x, y: s.y };
          if (last) drawSegment(ctxRef.current, last, p, s.color, s.size);
          last = p;
        } else if (s.type === "end") {
          last = null;
        }
      });
    },
    [clearCanvas]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    ctxRef.current = canvas.getContext("2d");
    clearCanvas();
  }, [clearCanvas]);

  // Replay history once when (re)joining mid-round
  useEffect(() => {
    if (strokesHistory && strokesHistory.length) {
      historyRef.current = strokesHistory;
      redrawFromHistory(strokesHistory);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokesHistory]);

  // Handle incoming stroke/clear/undo events broadcast from server
  useEffect(() => {
    if (!strokeEvent) return;
    if (strokeEvent.kind === "clear") {
      historyRef.current = [];
      remoteLastRef.current = null;
      clearCanvas();
    } else if (strokeEvent.kind === "stroke") {
      const stroke = strokeEvent.stroke;
      historyRef.current = [...historyRef.current, stroke];
      if (stroke.type === "start") {
        remoteLastRef.current = { x: stroke.x, y: stroke.y };
        drawSegment(
          ctxRef.current,
          remoteLastRef.current,
          { x: stroke.x + 0.1, y: stroke.y + 0.1 },
          stroke.color,
          stroke.size
        );
      } else if (stroke.type === "move") {
        const p = { x: stroke.x, y: stroke.y };
        if (remoteLastRef.current) drawSegment(ctxRef.current, remoteLastRef.current, p, stroke.color, stroke.size);
        remoteLastRef.current = p;
      } else if (stroke.type === "end") {
        remoteLastRef.current = null;
      }
    } else if (strokeEvent.kind === "undo") {
      // remove last contiguous start..end segment then redraw
      let i = historyRef.current.length - 1;
      while (i >= 0 && historyRef.current[i].type !== "start") i--;
      historyRef.current = i >= 0 ? historyRef.current.slice(0, i) : [];
      redrawFromHistory(historyRef.current);
    }
  }, [strokeEvent, clearCanvas, redrawFromHistory]);

  function getCanvasPoint(e) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  }

  function startDraw(e) {
    if (!isDrawer) return;
    e.preventDefault();
    isDrawingRef.current = true;
    const p = getCanvasPoint(e);
    lastPointRef.current = p;
    const c = isErasing ? "#ffffff" : color;
    socket.emit("draw_start", { x: p.x, y: p.y, color: c, size: brushSize });
    historyRef.current = [...historyRef.current, { type: "start", x: p.x, y: p.y, color: c, size: brushSize }];
    drawSegment(ctxRef.current, p, { x: p.x + 0.1, y: p.y + 0.1 }, c, brushSize);
  }

  function moveDraw(e) {
    if (!isDrawer || !isDrawingRef.current) return;
    e.preventDefault();
    const p = getCanvasPoint(e);
    const c = isErasing ? "#ffffff" : color;
    drawSegment(ctxRef.current, lastPointRef.current, p, c, brushSize);
    socket.emit("draw_move", { x: p.x, y: p.y, color: c, size: brushSize });
    historyRef.current = [...historyRef.current, { type: "move", x: p.x, y: p.y, color: c, size: brushSize }];
    lastPointRef.current = p;
  }

  function endDraw() {
    if (!isDrawer || !isDrawingRef.current) return;
    isDrawingRef.current = false;
    socket.emit("draw_end");
    historyRef.current = [...historyRef.current, { type: "end" }];
  }

  return (
    <canvas
      ref={canvasRef}
      id="draw-canvas"
      width={800}
      height={600}
      style={{ cursor: isDrawer ? "crosshair" : "not-allowed" }}
      onMouseDown={startDraw}
      onMouseMove={moveDraw}
      onMouseUp={endDraw}
      onMouseLeave={endDraw}
      onTouchStart={startDraw}
      onTouchMove={moveDraw}
      onTouchEnd={endDraw}
    />
  );
}

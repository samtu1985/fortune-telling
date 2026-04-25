"use client";

import { useEffect, useRef } from "react";
import { createNoise3D } from "simplex-noise";

interface WavyBackgroundProps {
  /** Hex colors for the layered waves. Order = back to front. */
  colors?: string[];
  /** Base wave amplitude (px). Default 50. */
  waveWidth?: number;
  /** Background fill behind the waves. Hex or "transparent". */
  backgroundFill?: string;
  /** Blur filter applied to the canvas. Default 8 (px). */
  blur?: number;
  /** Wave animation speed: "slow" | "fast". Default "slow". */
  speed?: "slow" | "fast";
  /** Wave opacity 0..1. Default 0.5. */
  waveOpacity?: number;
  /** Container className (positioning, padding, height). */
  className?: string;
  children?: React.ReactNode;
}

export function WavyBackground({
  colors = ["#6D28D9", "#A78BFA", "#D4AF37", "#7C3AED", "#F4E4BC"],
  waveWidth = 50,
  backgroundFill = "transparent",
  blur = 10,
  speed = "slow",
  waveOpacity = 0.5,
  className = "",
  children,
}: WavyBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const noise = createNoise3D();
    let nt = 0;
    const speedFactor = speed === "fast" ? 0.002 : 0.0008;

    const dpr =
      typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      // Use CSS pixels for layout, but back the canvas with DPR for crispness.
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.filter = `blur(${blur}px)`;
      ctx.lineCap = "round";
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    const drawWave = (n: number) => {
      nt += speedFactor;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      for (let i = 0; i < n; i++) {
        ctx.beginPath();
        ctx.lineWidth = waveWidth;
        ctx.strokeStyle = colors[i % colors.length];
        ctx.globalAlpha = waveOpacity;
        for (let x = 0; x < w; x += 5) {
          const y = noise(x / 800, 0.3 * i, nt) * 100;
          ctx.lineTo(x, y + h * 0.5);
        }
        ctx.stroke();
        ctx.closePath();
      }
    };

    // Single visibility listener attached for the lifetime of the effect, so
    // we have one cleanup point and don't leak listeners on unmount-while-hidden.
    const onVisibilityChange = () => {
      if (
        document.visibilityState === "visible" &&
        animationFrameRef.current == null
      ) {
        animationFrameRef.current = requestAnimationFrame(render);
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    const render = () => {
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      if (backgroundFill === "transparent") {
        // setTransform applies to clearRect coords too; clearing in CSS pixels.
        ctx.clearRect(0, 0, w, h);
      } else {
        ctx.fillStyle = backgroundFill;
        ctx.globalAlpha = 1;
        ctx.fillRect(0, 0, w, h);
      }
      drawWave(colors.length);
      // Pause when tab is hidden to save battery (rAF is already throttled by
      // browsers when backgrounded; this is belt-and-suspenders).
      if (document.visibilityState === "hidden") {
        animationFrameRef.current = null;
        return;
      }
      animationFrameRef.current = requestAnimationFrame(render);
    };
    render();

    return () => {
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (animationFrameRef.current != null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [colors, waveWidth, backgroundFill, blur, speed, waveOpacity]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        aria-hidden
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export default WavyBackground;

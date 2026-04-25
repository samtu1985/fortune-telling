"use client";

import { useEffect, useRef } from "react";

interface GoldParticlesProps {
  /** When true, particles drift / twinkle. When false, they fade out and animation pauses. */
  active: boolean;
  /** Outer container className. Default fills parent absolute. */
  className?: string;
  /** Particle count. Reduced on mobile via media query inside the component. Default 50. */
  count?: number;
}

interface Particle {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

export default function GoldParticles({ active, className = "", count = 50 }: GoldParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const opacityRef = useRef(0); // breathes between 0 and 1 based on active prop

  // Sync `active` prop into a ref so the rAF loop sees changes without restart.
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    // Reduce particle count on small screens for perf.
    const isMobile = window.matchMedia("(max-width: 640px)").matches;
    const targetCount = isMobile ? Math.floor(count * 0.5) : count;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    const seedParticle = (): Particle => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: 0.6 + Math.random() * 1.6,
      vx: (Math.random() - 0.5) * 0.18,
      vy: -(0.06 + Math.random() * 0.18), // mostly drift up
      life: Math.random() * 100,
      maxLife: 140 + Math.random() * 220,
    });

    if (particlesRef.current.length === 0) {
      particlesRef.current = Array.from({ length: targetCount }, seedParticle);
    }

    let paused = false;
    const onVisibility = () => {
      paused = document.visibilityState === "hidden";
    };
    document.addEventListener("visibilitychange", onVisibility);

    const render = () => {
      // Smooth-approach the target opacity (fade in/out when `active` flips).
      const target = activeRef.current ? 1 : 0;
      opacityRef.current += (target - opacityRef.current) * 0.04;

      ctx.clearRect(0, 0, width, height);

      // Skip particle work entirely when fully faded out and not active —
      // the rAF keeps spinning at near-zero cost (clearRect on tiny region).
      const fullyIdle = !activeRef.current && opacityRef.current < 0.005;

      if (!paused && !fullyIdle) {
        for (const p of particlesRef.current) {
          p.x += p.vx;
          p.y += p.vy;
          p.life += 1;

          // Reset particle if it drifts off or exceeds lifespan
          if (p.y < -10 || p.x < -10 || p.x > width + 10 || p.life > p.maxLife) {
            const seed = seedParticle();
            seed.y = height + 5; // re-enter from bottom
            Object.assign(p, seed);
          }

          // Fade in over first 25% of lifespan, fade out over last 25%
          const t = p.life / p.maxLife;
          let alpha = 1;
          if (t < 0.25) alpha = t / 0.25;
          else if (t > 0.75) alpha = (1 - t) / 0.25;
          alpha *= opacityRef.current;

          if (alpha <= 0) continue;

          // Soft gold glow via radial gradient, ~3x particle radius
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 3);
          grad.addColorStop(0, `rgba(232, 198, 106, ${alpha * 0.85})`); // gold-pale
          grad.addColorStop(0.4, `rgba(212, 175, 55, ${alpha * 0.45})`); // gold-soft
          grad.addColorStop(1, "rgba(212, 175, 55, 0)");
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      rafRef.current = requestAnimationFrame(render);
    };
    render();

    return () => {
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [count]);

  return (
    <div ref={containerRef} className={`pointer-events-none ${className}`} aria-hidden="true">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
}

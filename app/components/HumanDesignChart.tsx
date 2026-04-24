"use client";

import type { HumanDesignChartData } from "@/app/lib/humandesign/types";
import { CENTER_KEYS } from "@/app/lib/humandesign/types";
import {
  VIEWBOX,
  CENTER_POS,
  CENTER_SHAPE,
  CENTER_SIZE,
  GATE_TO_CENTER,
  CANONICAL_CHANNELS,
  gateAnchor,
} from "@/app/lib/humandesign/layout";

interface Props {
  chart: HumanDesignChartData;
}

function gatePoint(gate: number): { x: number; y: number } | null {
  const center = GATE_TO_CENTER[gate];
  if (!center) return null;
  const { x, y } = CENTER_POS[center];
  const radius = CENTER_SIZE[center] * 0.4;
  const { dx, dy } = gateAnchor(gate, radius);
  return { x: x + dx, y: y + dy };
}

export default function HumanDesignChart({ chart }: Props) {
  // Build active-channel lookup: "<loGate>-<hiGate>" → true if active
  const activeKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  const activeSet = new Set(
    chart.channels.filter((c) => c.active).map((c) => activeKey(c.gates[0], c.gates[1])),
  );

  return (
    <div className="w-full max-w-[640px] mx-auto">
      <svg
        viewBox={`0 0 ${VIEWBOX.w} ${VIEWBOX.h}`}
        className="w-full h-auto"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Channels first — painted under the centers */}
        {CANONICAL_CHANNELS.map((ch) => {
          const [a, b] = ch.gates;
          const pa = gatePoint(a);
          const pb = gatePoint(b);
          if (!pa || !pb) return null;
          const active = activeSet.has(activeKey(a, b));
          return (
            <line
              key={`ch-${a}-${b}`}
              data-channel-active={String(active)}
              x1={pa.x}
              y1={pa.y}
              x2={pb.x}
              y2={pb.y}
              stroke={active ? "var(--color-accent, #3E6AE1)" : "var(--color-border, #D1D5DB)"}
              strokeWidth={active ? 2.5 : 1}
            />
          );
        })}
        {/* Centers — painted on top */}
        {CENTER_KEYS.map((key) => {
          const pos = CENTER_POS[key];
          const shape = CENTER_SHAPE[key];
          const size = CENTER_SIZE[key];
          const defined = !!chart.centers[key]?.defined;
          return (
            <g key={key} data-center={key} data-defined={String(defined)}>
              <CenterShape
                x={pos.x}
                y={pos.y}
                size={size}
                shape={shape}
                defined={defined}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function CenterShape(props: {
  x: number;
  y: number;
  size: number;
  shape: "triangleUp" | "triangleDown" | "square" | "diamond";
  defined: boolean;
}) {
  const { x, y, size, shape, defined } = props;
  const fill = defined ? "var(--color-accent, #3E6AE1)" : "transparent";
  const stroke = "var(--color-text-tertiary, #9CA3AF)";
  const s = size / 2;

  if (shape === "triangleUp") {
    const points = `${x},${y - s} ${x + s},${y + s} ${x - s},${y + s}`;
    return <polygon points={points} fill={fill} stroke={stroke} strokeWidth={1} />;
  }
  if (shape === "triangleDown") {
    const points = `${x},${y + s} ${x + s},${y - s} ${x - s},${y - s}`;
    return <polygon points={points} fill={fill} stroke={stroke} strokeWidth={1} />;
  }
  if (shape === "diamond") {
    const points = `${x},${y - s} ${x + s},${y} ${x},${y + s} ${x - s},${y}`;
    return <polygon points={points} fill={fill} stroke={stroke} strokeWidth={1} />;
  }
  return (
    <rect
      x={x - s}
      y={y - s}
      width={size}
      height={size}
      fill={fill}
      stroke={stroke}
      strokeWidth={1}
    />
  );
}

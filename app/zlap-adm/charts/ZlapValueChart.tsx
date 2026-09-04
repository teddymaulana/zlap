"use client";

import { useMemo, useRef, useState } from "react";

type Point = { date: string; value: number };

const LINE_COLOR = "#2a78d6"; // sequential blue, per dataviz palette
const GRID_COLOR = "#e1e0d9";
const AXIS_COLOR = "#c3c2b7";
const MUTED_TEXT = "#898781";

function formatMoney(amount: number) {
  return `Rp. ${Math.round(amount || 0).toLocaleString("id-ID")}`;
}

function formatCompact(amount: number) {
  if (Math.abs(amount) >= 1_000_000) {
    return `Rp ${(amount / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })}jt`;
  }
  return `Rp ${Math.round(amount).toLocaleString("id-ID")}`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const WIDTH = 900;
const HEIGHT = 340;
const PADDING = { top: 24, right: 20, bottom: 36, left: 90 };

export default function ZlapValueChart({ data }: { data: Point[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;

  const { points, yTicks, maxValue } = useMemo(() => {
    if (data.length === 0) return { points: [], yTicks: [], maxValue: 0 };

    const times = data.map((d) => new Date(d.date).getTime());
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const timeSpan = maxTime - minTime || 1;

    const values = data.map((d) => d.value);
    const maxVal = Math.max(...values, 0) * 1.1 || 1;

    const pts = data.map((d, i) => {
      const t = new Date(d.date).getTime();
      const x = PADDING.left + ((t - minTime) / timeSpan) * plotWidth;
      const y = PADDING.top + plotHeight - (d.value / maxVal) * plotHeight;
      return { x, y, date: d.date, value: d.value, index: i };
    });

    const tickCount = 4;
    const ticks = Array.from({ length: tickCount + 1 }, (_, i) => (maxVal / tickCount) * i);

    return { points: pts, yTicks: ticks, maxValue: maxVal };
  }, [data, plotWidth, plotHeight]);

  if (data.length === 0) {
    return <div className="rounded border p-8 text-center text-sm text-gray-500">No snapshots yet.</div>;
  }

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1].x},${PADDING.top + plotHeight} L${points[0].x},${PADDING.top + plotHeight} Z`;
  const last = points[points.length - 1];
  const hovered = hoverIndex !== null ? points[hoverIndex] : null;

  function handlePointerMove(e: React.PointerEvent<SVGRectElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = WIDTH / rect.width;
    const pointerX = (e.clientX - rect.left) * scaleX;
    let nearest = 0;
    let nearestDist = Infinity;
    points.forEach((p, i) => {
      const dist = Math.abs(p.x - pointerX);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = i;
      }
    });
    setHoverIndex(nearest);
  }

  return (
    <div>
      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full"
          role="img"
          aria-label="Zlap Value over time"
        >
          {yTicks.map((tick, i) => {
            const y = PADDING.top + plotHeight - (tick / maxValue) * plotHeight;
            return (
              <g key={i}>
                <line
                  x1={PADDING.left}
                  x2={WIDTH - PADDING.right}
                  y1={y}
                  y2={y}
                  stroke={GRID_COLOR}
                  strokeWidth={1}
                />
                <text x={PADDING.left - 10} y={y + 4} textAnchor="end" fontSize={11} fill={MUTED_TEXT}>
                  {formatCompact(tick)}
                </text>
              </g>
            );
          })}

          <line
            x1={PADDING.left}
            x2={WIDTH - PADDING.right}
            y1={PADDING.top + plotHeight}
            y2={PADDING.top + plotHeight}
            stroke={AXIS_COLOR}
            strokeWidth={1}
          />

          <path d={areaPath} fill={LINE_COLOR} opacity={0.1} stroke="none" />
          <path d={linePath} fill="none" stroke={LINE_COLOR} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

          <text x={last.x} y={last.y - 14} textAnchor="end" fontSize={12} fontWeight={600} fill="#0b0b0b">
            {formatCompact(last.value)}
          </text>
          <circle cx={last.x} cy={last.y} r={5} fill={LINE_COLOR} stroke="#fcfcfb" strokeWidth={2} />

          <text x={PADDING.left} y={HEIGHT - 8} fontSize={11} fill={MUTED_TEXT}>
            {formatDate(points[0].date)}
          </text>
          <text x={WIDTH - PADDING.right} y={HEIGHT - 8} textAnchor="end" fontSize={11} fill={MUTED_TEXT}>
            {formatDate(points[points.length - 1].date)}
          </text>

          {hovered && (
            <>
              <line
                x1={hovered.x}
                x2={hovered.x}
                y1={PADDING.top}
                y2={PADDING.top + plotHeight}
                stroke={AXIS_COLOR}
                strokeWidth={1}
              />
              <circle cx={hovered.x} cy={hovered.y} r={5} fill={LINE_COLOR} stroke="#fcfcfb" strokeWidth={2} />
            </>
          )}

          <rect
            x={PADDING.left}
            y={PADDING.top}
            width={plotWidth}
            height={plotHeight}
            fill="transparent"
            onPointerMove={handlePointerMove}
            onPointerLeave={() => setHoverIndex(null)}
          />
        </svg>

        {hovered && (
          <div
            className="pointer-events-none absolute rounded border bg-white px-2 py-1 text-xs shadow"
            style={{
              left: `${(hovered.x / WIDTH) * 100}%`,
              top: `${(hovered.y / HEIGHT) * 100}%`,
              transform: "translate(-50%, -130%)",
            }}
          >
            <div className="font-semibold">{formatMoney(hovered.value)}</div>
            <div className="text-gray-500">{formatDate(hovered.date)}</div>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setShowTable(!showTable)}
        className="mt-2 text-xs text-gray-500 hover:underline"
      >
        {showTable ? "Hide" : "Show"} data table
      </button>

      {showTable && (
        <div className="mt-2 max-h-64 overflow-y-auto rounded border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-gray-500">
                <th className="px-3 py-1.5 font-medium">Date</th>
                <th className="px-3 py-1.5 font-medium text-right">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.map((d, i) => (
                <tr key={i}>
                  <td className="px-3 py-1.5">{formatDate(d.date)}</td>
                  <td className="px-3 py-1.5 text-right">{formatMoney(d.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import type { SaleEvent } from "@/app/actions/storefront";

const LINE_COLOR = "#16a34a";
const WIDTH = 600;
const HEIGHT = 200;
const PADDING_LEFT = 12;
const PADDING_RIGHT = 12;
const PADDING_TOP = 20;
const PADDING_BOTTOM = 28;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "short" });
}

function formatMoney(amount: number) {
  return `IDR ${Math.round(amount).toLocaleString("id-ID")}`;
}

export default function SalesChart({ data }: { data: SaleEvent[] }) {
  const [hovered, setHovered] = useState<number | null>(null);

  // Fewer than a handful of points makes for a noisy, not-very-meaningful
  // line — hide the chart until there's enough sales history to show a
  // real trend.
  if (data.length <= 10) {
    return (
      <div>
        <h2 className="mb-2 text-sm font-semibold text-gray-700">Recent sales on ZLAP</h2>
        <p className="text-sm text-gray-500">
          {data.length === 0 ? "No sales yet." : "Not enough sales yet to show a chart."}
        </p>
      </div>
    );
  }

  const chartWidth = WIDTH - PADDING_LEFT - PADDING_RIGHT;
  const chartHeight = HEIGHT - PADDING_TOP - PADDING_BOTTOM;
  const bottomY = PADDING_TOP + chartHeight;
  const n = data.length;

  // Y is the price the customer actually paid on each sale — not a running
  // count — so the line reflects real price movement over time. Scaled to
  // the data's own min/max (with headroom), not from zero, same as any
  // price-history chart: a fixed baseline would flatten real differences.
  const prices = data.map((d) => d.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice;
  const padding = priceRange === 0 ? Math.max(maxPrice * 0.1, 1) : priceRange * 0.15;
  const yMin = Math.max(0, minPrice - padding);
  const yMax = maxPrice + padding;

  // Evenly-spaced by index on X — every dot sits the same distance apart
  // regardless of how far apart the actual sale dates are, so a same-day
  // cluster reads just as clearly as a widely-spaced one.
  const xFor = (i: number) => (n === 1 ? PADDING_LEFT + chartWidth / 2 : PADDING_LEFT + (chartWidth * i) / (n - 1));
  const yFor = (price: number) => bottomY - ((price - yMin) / (yMax - yMin)) * chartHeight;

  const points = data.map((d, i) => ({
    x: xFor(i),
    y: yFor(d.price),
    price: d.price,
    date: d.date,
  }));
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${bottomY} L ${points[0].x} ${bottomY} Z`;

  const active = hovered !== null ? points[hovered] : null;

  function handleMove(e: React.MouseEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * WIDTH;
    let closest = 0;
    let closestDist = Infinity;
    points.forEach((p, i) => {
      const dist = Math.abs(p.x - relX);
      if (dist < closestDist) {
        closestDist = dist;
        closest = i;
      }
    });
    setHovered(closest);
  }

  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold text-gray-700">
        Recent sales on ZLAP {n === 20 ? "(last 20)" : `(${n})`}
      </h2>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        role="img"
        aria-label={`Sale price history: ${data.map((d) => `${formatDate(d.date)} ${formatMoney(d.price)}`).join(", ")}`}
      >
        <line
          x1={PADDING_LEFT}
          y1={bottomY}
          x2={WIDTH - PADDING_RIGHT}
          y2={bottomY}
          stroke="#e5e7eb"
          strokeWidth={1}
        />

        {/* Y-axis bounds — without these, a point's height relative to a
            round number is unreadable; the line only shows shape, not scale. */}
        <text x={WIDTH - PADDING_RIGHT} y={PADDING_TOP - 6} textAnchor="end" fontSize={10} fill="#9ca3af">
          {formatMoney(yMax)}
        </text>
        <text x={WIDTH - PADDING_RIGHT} y={bottomY - 6} textAnchor="end" fontSize={10} fill="#9ca3af">
          {formatMoney(yMin)}
        </text>

        <path d={areaPath} fill={LINE_COLOR} opacity={0.08} />
        <path d={linePath} fill="none" stroke={LINE_COLOR} strokeWidth={2} strokeLinejoin="round" />

        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={hovered === i ? 5 : 3.5}
            fill="white"
            stroke={LINE_COLOR}
            strokeWidth={2}
            className="pointer-events-none"
          />
        ))}

        {/* first/last date labels — selective, avoids collisions from labeling every point */}
        <text x={points[0].x} y={HEIGHT - 8} textAnchor="start" fontSize={11} fill="#6b7280">
          {formatDate(points[0].date)}
        </text>
        {n > 1 && (
          <text
            x={points[points.length - 1].x}
            y={HEIGHT - 8}
            textAnchor="end"
            fontSize={11}
            fill="#6b7280"
          >
            {formatDate(points[points.length - 1].date)}
          </text>
        )}

        {active && (
          <g className="pointer-events-none">
            <line
              x1={active.x}
              y1={PADDING_TOP}
              x2={active.x}
              y2={bottomY}
              stroke="#9ca3af"
              strokeWidth={1}
              strokeDasharray="3,3"
            />
            <rect
              x={Math.min(Math.max(active.x - 55, PADDING_LEFT), WIDTH - PADDING_RIGHT - 110)}
              y={Math.max(active.y - 40, PADDING_TOP)}
              width={110}
              height={32}
              rx={4}
              fill="#111827"
            />
            <text
              x={Math.min(Math.max(active.x, PADDING_LEFT + 55), WIDTH - PADDING_RIGHT - 55)}
              y={Math.max(active.y - 40, PADDING_TOP) + 13}
              textAnchor="middle"
              fontSize={11}
              fontWeight={600}
              fill="white"
              className="tabular-nums"
            >
              {formatMoney(active.price)}
            </text>
            <text
              x={Math.min(Math.max(active.x, PADDING_LEFT + 55), WIDTH - PADDING_RIGHT - 55)}
              y={Math.max(active.y - 40, PADDING_TOP) + 25}
              textAnchor="middle"
              fontSize={10}
              fill="#d1d5db"
            >
              {formatDate(active.date)}
            </text>
          </g>
        )}

        <rect
          x={PADDING_LEFT}
          y={PADDING_TOP}
          width={chartWidth}
          height={chartHeight}
          fill="transparent"
          onMouseMove={handleMove}
          onMouseLeave={() => setHovered(null)}
        />
      </svg>
    </div>
  );
}

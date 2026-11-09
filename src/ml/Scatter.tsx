"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { scaleLinear } from "d3-scale";
import { select } from "d3-selection";
import { zoom, zoomIdentity, type ZoomTransform } from "d3-zoom";

export interface ScatterPoint {
  id: string;
  label: string;
  x: number;
  y: number;
  category: string;
  /** point radius in px (evidence-count cue); default 5 */
  r?: number;
}

export interface ScatterCategory {
  key: string;
  label: string;
  color: string;
}

const W = 640;
const H = 520;
const PAD = 24;

export function Scatter({
  points,
  categories,
  selectedId,
  onSelect,
  directLabels = false,
  highlightIds,
}: {
  points: ScatterPoint[];
  categories: ScatterCategory[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  directLabels?: boolean;
  /** search matches: drawn with a ring; non-matches are dimmed */
  highlightIds?: Set<string> | null;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity);
  const [hover, setHover] = useState<ScatterPoint | null>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const sel = select(svg);
    const z = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 10])
      .on("zoom", (e) => setTransform(e.transform));
    sel.call(z);
    return () => {
      sel.on(".zoom", null);
    };
  }, []);

  const { xs, ys } = useMemo(() => {
    const pad = (lo: number, hi: number) => {
      const span = hi - lo || 1;
      return [lo - span * 0.06, hi + span * 0.06];
    };
    const xd = pad(
      Math.min(...points.map((p) => p.x)),
      Math.max(...points.map((p) => p.x)),
    );
    const yd = pad(
      Math.min(...points.map((p) => p.y)),
      Math.max(...points.map((p) => p.y)),
    );
    return {
      xs: scaleLinear().domain(xd).range([PAD, W - PAD]),
      ys: scaleLinear().domain(yd).range([H - PAD, PAD]),
    };
  }, [points]);

  const colorOf = useMemo(
    () => new Map(categories.map((c) => [c.key, c.color])),
    [categories],
  );

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Embedding projection scatter plot"
        className="h-auto w-full cursor-grab rounded-lg border border-zinc-800 bg-zinc-950/60"
        onClick={() => onSelect(null)}
      >
        {points.map((p) => {
          const cx = transform.applyX(xs(p.x));
          const cy = transform.applyY(ys(p.y));
          if (cx < -20 || cx > W + 20 || cy < -20 || cy > H + 20) return null;
          const selected = p.id === selectedId;
          const dimmed = !!highlightIds && highlightIds.size > 0 && !highlightIds.has(p.id) && !selected;
          const matched = !!highlightIds && highlightIds.has(p.id);
          return (
            <g key={p.id} opacity={dimmed ? 0.22 : 1}>
              {matched && !selected && (
                <circle
                  cx={cx}
                  cy={cy}
                  r={(p.r ?? 5) + 3.5}
                  fill="none"
                  stroke="#6fc6d2"
                  strokeWidth={1.5}
                />
              )}
              {selected && (
                <circle
                  cx={cx}
                  cy={cy}
                  r={(p.r ?? 5) + 4}
                  fill="none"
                  stroke="#d9a45b"
                  strokeWidth={2}
                />
              )}
              <circle
                cx={cx}
                cy={cy}
                r={(p.r ?? 5) + (hover?.id === p.id ? 1.5 : 0)}
                fill={colorOf.get(p.category) ?? "#888"}
                stroke="#121820"
                strokeWidth={1}
                className="cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(p.id);
                }}
                onMouseEnter={() => setHover(p)}
                onMouseLeave={() => setHover(null)}
              >
                <title>{p.label}</title>
              </circle>
              {(directLabels || selected) && (
                <text
                  x={cx + 9}
                  y={cy + 3.5}
                  className="pointer-events-none select-none"
                  fill="#c3c8ce"
                  fontSize={11}
                >
                  {p.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hover && (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-10 max-w-64 -translate-x-1/2 -translate-y-full rounded-md border border-line bg-ink px-2.5 py-1.5 text-[11px] text-text shadow-lg"
          style={{
            left: `${(transform.applyX(xs(hover.x)) / W) * 100}%`,
            top: `calc(${(transform.applyY(ys(hover.y)) / H) * 100}% - 10px)`,
          }}
        >
          {hover.label}
          <span className="block text-[10px] text-text-3">click to inspect</span>
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-4">
        {categories.map((c) => (
          <span key={c.key} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: c.color }}
              aria-hidden
            />
            <span className="text-[11px] text-zinc-400">{c.label}</span>
          </span>
        ))}
        <span className="ml-auto text-[10px] text-zinc-600">
          scroll to zoom · drag to pan
        </span>
      </div>
    </div>
  );
}

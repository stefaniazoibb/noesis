"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export interface RepPoint {
  id: string;
  label: string;
  x: number;
  y: number;
  category: "psychiatric" | "neurodegenerative";
  studies: number;
}

// validated categorical slots (dataviz validator, dark surface: all checks pass)
const COLORS = { psychiatric: "#2a78d6", neurodegenerative: "#eb6834" } as const;
const W = 620;
const H = 400;
const PAD = 34;

/**
 * Non-zooming scatter of the disorder PCA embedding (real artifact). No
 * wheel/drag handlers, so it can never capture page scrolling.
 */
export function RepresentationPreview({
  points,
  pc1,
  pc2,
}: {
  points: RepPoint[];
  pc1: number;
  pc2: number;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const { sx, sy } = useMemo(() => {
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
    const [y0, y1] = [Math.min(...ys), Math.max(...ys)];
    const px = (x1 - x0 || 1) * 0.08;
    const py = (y1 - y0 || 1) * 0.1;
    return {
      sx: (v: number) => PAD + ((v - (x0 - px)) / (x1 - x0 + 2 * px)) * (W - 2 * PAD),
      sy: (v: number) => H - PAD - ((v - (y0 - py)) / (y1 - y0 + 2 * py)) * (H - 2 * PAD),
    };
  }, [points]);
  const hp = points.find((p) => p.id === hover);
  const ordered = [...points].sort((a, b) => (a.id === hover ? 1 : b.id === hover ? -1 : 0));

  return (
    <figure className="rounded-[4px] border border-line bg-ink-2/60 p-4">
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          role="img"
          aria-label="Disorders positioned by the first two principal components of their evidence profiles"
        >
          <line x1={PAD} x2={W - PAD} y1={H - PAD} y2={H - PAD} stroke="#c3c1b9" />
          <line x1={PAD} x2={PAD} y1={PAD} y2={H - PAD} stroke="#c3c1b9" />
          <text x={W - PAD} y={H - 10} textAnchor="end" fontSize={11} fill="#6b6b64">
            PC1 · {(pc1 * 100).toFixed(0)}% of variance
          </text>
          <text x={12} y={PAD - 12} fontSize={11} fill="#6b6b64">
            PC2 · {(pc2 * 100).toFixed(0)}%
          </text>
          {ordered.map((p) => {
            const r = 4 + Math.sqrt(p.studies) * 1.5;
            const active = hover === p.id;
            const dim = hover !== null && !active;
            return (
              <g
                key={p.id}
                onMouseEnter={() => setHover(p.id)}
                onMouseLeave={() => setHover(null)}
                opacity={dim ? 0.35 : 1}
              >
                <circle cx={sx(p.x)} cy={sy(p.y)} r={r + 8} fill="transparent" />
                <circle
                  cx={sx(p.x)}
                  cy={sy(p.y)}
                  r={r}
                  fill={COLORS[p.category]}
                  stroke="#ffffff"
                  strokeWidth={2}
                />
                {(active || p.studies >= 6) && (
                  <text
                    x={sx(p.x) > W * 0.72 ? sx(p.x) - r - 5 : sx(p.x) + r + 5}
                    textAnchor={sx(p.x) > W * 0.72 ? "end" : "start"}
                    y={sy(p.y) + 4}
                    fontSize={11}
                    fill={active ? "#141412" : "#45453f"}
                    className="pointer-events-none select-none"
                  >
                    {p.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {hp && (
          <div
            role="tooltip"
            className="pointer-events-none absolute left-3 top-3 rounded-md border border-line bg-ink px-3 py-2 text-[12px]"
          >
            <p className="text-text">{hp.label}</p>
            <p className="text-[11px] capitalize text-text-3">
              {hp.category} · {hp.studies} indexed {hp.studies === 1 ? "study" : "studies"}
            </p>
          </div>
        )}
      </div>
      <figcaption className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-text-3">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS.psychiatric }} aria-hidden />
          Psychiatric
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS.neurodegenerative }} aria-hidden />
          Neurodegenerative
        </span>
        <span>Point size = distinct indexed studies.</span>
        <Link href="/ml" className="ml-auto text-text underline decoration-line-strong underline-offset-4">
          Open the explorer →
        </Link>
      </figcaption>
    </figure>
  );
}

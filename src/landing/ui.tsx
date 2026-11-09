"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

type Href = Parameters<typeof Link>[0]["href"];

function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Fades content in once it scrolls into view (no-op under reduced motion). */
export function Reveal({
  children,
  className = "",
  delay = 0,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "section" | "li" | "article";
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reducedMotion()) {
      el.classList.add("is-visible");
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          el.classList.add("is-visible");
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag
      ref={ref as never}
      className={`reveal ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}

/**
 * Counts up to a value computed from the data. The server-rendered text is
 * already the final value (no-JS, crawlers, reduced motion); the animation
 * only mutates the DOM text, never React state.
 */
export function Counter({ value, className = "" }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion()) return;
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) return; // already visible
    el.textContent = "0";
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const dur = 1100 + Math.min(value, 400) * 1.2;
      const tick = (t: number) => {
        const k = Math.min(1, (t - t0) / dur);
        const eased = 1 - Math.pow(1 - k, 3);
        el.textContent = String(Math.round(value * eased));
        if (k < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value]);
  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      {value}
    </span>
  );
}

export function Eyebrow({ index, children }: { index: string; children: ReactNode }) {
  return (
    <p className="flex items-baseline gap-3 text-[13px] font-medium text-text-3">
      <span className="font-mono text-[12px] font-normal">{String(Number(index))}</span>
      {children}
    </p>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mt-3 max-w-3xl text-balance text-[32px] font-medium leading-[1.1] tracking-[-0.025em] text-text sm:text-[40px]">
      {children}
    </h2>
  );
}

export function Lede({ children }: { children: ReactNode }) {
  return (
    <p className="mt-5 max-w-2xl text-pretty text-[16px] leading-relaxed text-text-2">
      {children}
    </p>
  );
}

export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href as Href}
      className="group inline-flex items-center gap-2 text-[14px] font-medium text-text"
    >
      <span className="underline decoration-line-strong underline-offset-4 group-hover:decoration-text">
        {children}
      </span>
      <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
        →
      </span>
    </Link>
  );
}

/**
 * Ranked horizontal bars, one series (amber). Every bar carries its value as
 * text, so the chart reads without color; hovering shows the detail line.
 */
export function BarList({
  rows,
  unit,
  max,
  caption,
}: {
  rows: { key: string; label: string; value: number; detail?: string; href?: string }[];
  unit: string;
  max?: number;
  caption: string;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const m = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <figure>
      <ul className="space-y-[3px]" aria-label={caption}>
        {rows.map((r) => {
          const inner = (
            <>
              <span className="w-40 shrink-0 truncate text-[12px] text-text-2 sm:w-48" title={r.label}>
                {r.label}
              </span>
              <span className="relative h-[14px] flex-1">
                <span
                  className="absolute inset-y-0 left-0 rounded-r-[2px] bg-text-3 transition-colors group-hover:bg-text"
                  style={{ width: `${(r.value / m) * 100}%`, minWidth: r.value > 0 ? 3 : 0 }}
                />
              </span>
              <span className="w-8 shrink-0 text-right text-[12px] tabular-nums text-text">
                {r.value}
              </span>
            </>
          );
          return (
            <li
              key={r.key}
              onMouseEnter={() => setHover(r.key)}
              onMouseLeave={() => setHover(null)}
              className="relative"
            >
              {r.href ? (
                <Link
                  href={r.href as Href}
                  className="group flex items-center gap-3 rounded px-1 py-[3px] hover:bg-surface/60"
                >
                  {inner}
                </Link>
              ) : (
                <div className="group flex items-center gap-3 rounded px-1 py-[3px]">{inner}</div>
              )}
              {hover === r.key && r.detail && (
                <span
                  role="tooltip"
                  className="pointer-events-none absolute right-10 top-1/2 z-10 -translate-y-1/2 whitespace-nowrap rounded-[3px] border border-line bg-white px-2 py-1 text-[12px] text-text-2 shadow-sm"
                >
                  {r.detail}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <figcaption className="mt-3 text-[11px] leading-relaxed text-text-3">
        {caption} Unit: {unit}.
      </figcaption>
    </figure>
  );
}

/** Columns over a contiguous axis (e.g. publication year), one series. */
export function Columns({
  data,
  caption,
  unit,
}: {
  data: { x: number; y: number }[];
  caption: string;
  unit: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.y));
  const W = 560;
  const H = 120;
  const gap = 2;
  const bw = (W - gap * (data.length - 1)) / data.length;
  const h = hover !== null ? data[hover] : null;
  return (
    <figure>
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H + 18}`}
          className="h-auto w-full"
          role="img"
          aria-label={caption}
          onMouseLeave={() => setHover(null)}
        >
          <line x1={0} x2={W} y1={H} y2={H} stroke="#c3c1b9" strokeWidth={1} />
          {data.map((d, i) => {
            const bh = (d.y / max) * (H - 6);
            const x = i * (bw + gap);
            return (
              <g key={d.x} onMouseEnter={() => setHover(i)}>
                <rect x={x} y={0} width={bw} height={H} fill="transparent" />
                {d.y > 0 && (
                  <path
                    d={`M${x},${H} V${H - bh + 3} q0,-3 3,-3 h${bw - 6} q3,0 3,3 V${H} Z`}
                    fill={hover === i ? "#141412" : "#6b6b64"}
                  />
                )}
                {(i === 0 || i === data.length - 1 || (d.x % 5 === 0 && i > 1 && i < data.length - 2)) && (
                  <text
                    x={x + bw / 2}
                    y={H + 14}
                    textAnchor="middle"
                    fontSize={10}
                    fill="#6b6b64"
                  >
                    {d.x}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {h && (
          <span
            role="tooltip"
            className="pointer-events-none absolute right-0 top-0 rounded-[3px] border border-line bg-white px-2 py-1 text-[12px] text-text-2"
          >
            {h.x}: <span className="tabular-nums text-text">{h.y}</span> {h.y === 1 ? "study" : "studies"}
          </span>
        )}
      </div>
      <figcaption className="mt-2 text-[11px] leading-relaxed text-text-3">
        {caption} Unit: {unit}.
      </figcaption>
    </figure>
  );
}

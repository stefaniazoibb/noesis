import type { ReactNode } from "react";

/** Editorial chapter shell for the public landing page. */
export function Chapter({
  id,
  tone = "paper",
  children,
  bleed = false,
  className = "",
  label,
}: {
  id: string;
  tone?: "paper" | "white" | "graphite";
  children: ReactNode;
  bleed?: boolean;
  className?: string;
  label?: string;
}) {
  const bg =
    tone === "graphite" ? "bg-graphite text-offwhite" : tone === "white" ? "bg-white" : "bg-ink";
  return (
    <section
      id={id}
      aria-label={label}
      className={`relative ${bg} ${tone === "graphite" ? "" : "border-t border-line/70"} ${bleed ? "" : "px-5 sm:px-8"} ${className}`}
    >
      {bleed ? children : <div className="mx-auto max-w-[1280px]">{children}</div>}
    </section>
  );
}

export function Kicker({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return <p className={`font-mono text-[12px] ${dark ? "text-offwhite-3" : "text-text-3"}`}>{children}</p>;
}

export function Display({ children, dark = false, className = "" }: { children: ReactNode; dark?: boolean; className?: string }) {
  return (
    <h2
      className={`mt-4 max-w-4xl text-[40px] font-medium leading-[1.03] tracking-[-0.03em] sm:text-[56px] lg:text-[72px] ${dark ? "text-offwhite" : "text-text"} ${className}`}
    >
      {children}
    </h2>
  );
}

export function Lead({ children, dark = false, className = "" }: { children: ReactNode; dark?: boolean; className?: string }) {
  return (
    <p className={`mt-6 max-w-2xl text-[18px] leading-relaxed sm:text-[20px] ${dark ? "text-offwhite-2" : "text-text-2"} ${className}`}>
      {children}
    </p>
  );
}

/** Footnote marker; the numbered notes are listed at the foot of the page. */
export function Fn({ n }: { n: number }) {
  return (
    <sup className="ml-0.5 font-mono text-[0.55em] font-normal">
      <a href={`#fn-${n}`} id={`fnref-${n}`} aria-label={`Note ${n}`} className="opacity-60 hover:opacity-100 hover:underline">
        {n}
      </a>
    </sup>
  );
}

/** AUC with its 95% CI on a 0.3–1 strip, chance line at 0.5. */
export function AucStrip({ label, auc, lo, hi, p }: { label: string; auc: number; lo: number; hi: number; p: number }) {
  const x = (v: number) => ((v - 0.3) / 0.7) * 100;
  const sig = lo > 0.5;
  return (
    <figure className="mt-3">
      <div className="flex items-baseline justify-between text-[12px]">
        <span className="text-text-2">{label}</span>
        <span className="font-mono text-text">
          AUC {auc.toFixed(2)} <span className="text-text-3">[{lo.toFixed(2)}, {hi.toFixed(2)}] · perm. p {p < 0.001 ? "< 0.001" : p.toFixed(3)}</span>
        </span>
      </div>
      <svg viewBox="0 0 100 10" className="mt-1.5 h-3 w-full" preserveAspectRatio="none" aria-hidden>
        <line x1="0" x2="100" y1="5" y2="5" stroke="#dedcd5" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <line x1={x(0.5)} x2={x(0.5)} y1="0" y2="10" stroke="#6b6b64" strokeDasharray="2 2" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <line x1={x(lo)} x2={x(hi)} y1="5" y2="5" stroke={sig ? "#0b6e7a" : "#6b6b64"} strokeWidth="3" vectorEffect="non-scaling-stroke" />
        <line x1={x(auc)} x2={x(auc)} y1="0.5" y2="9.5" stroke={sig ? "#0b6e7a" : "#45453f"} strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
      </svg>
      <figcaption className="mt-1 flex justify-between font-mono text-[10px] text-text-3">
        <span>0.3</span>
        <span>chance 0.5</span>
        <span>1.0</span>
      </figcaption>
    </figure>
  );
}

import type { ReactNode } from "react";

/** Consistent header for the research-application pages. */
export function PageHeader({
  eyebrow,
  title,
  children,
  actions,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
      <div className="max-w-3xl">
        <p className="text-[11px] uppercase tracking-[0.22em] text-text-3">{eyebrow}</p>
        <h1 className="mt-2 font-serif text-[40px] leading-[1.05] text-text sm:text-[46px]">
          {title}
        </h1>
        {children && (
          <div className="mt-3 text-[14px] leading-relaxed text-text-2">{children}</div>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-line bg-ink-2/70 ${className}`}>
      {children}
    </section>
  );
}

export function PanelTitle({ children, note }: { children: ReactNode; note?: ReactNode }) {
  return (
    <div className="border-b border-line px-5 py-3.5">
      <h2 className="text-[13px] text-text">{children}</h2>
      {note && <p className="mt-0.5 text-[11px] leading-relaxed text-text-3">{note}</p>}
    </div>
  );
}

export const selectClass =
  "rounded-md border border-line bg-surface px-2.5 py-1.5 text-[12px] text-text focus:border-amber/60 focus:outline-none";

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-md border border-line bg-surface p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded px-2.5 py-1 text-[12px] transition-colors ${
            value === o.value ? "bg-line-strong text-text" : "text-text-2 hover:text-text"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

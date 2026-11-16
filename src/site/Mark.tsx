/** The NOĒSIS mark: flat single-colour redraw of the geometric N (public/brand/noesis-mark.svg). */
export function Mark({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      fill="none"
      aria-hidden
      className={className}
    >
      <g stroke="currentColor" strokeLinecap="round">
        <path d="M16 10V54M16 10L48 54M48 10V54" strokeWidth="2.6" />
        <path d="M16 28H29.1M48 36H34.9" strokeWidth="1.3" />
      </g>
      <g fill="currentColor">
        <circle cx="16" cy="10" r="4.4" />
        <circle cx="16" cy="54" r="4.4" />
        <circle cx="48" cy="10" r="4.4" />
        <circle cx="48" cy="54" r="4.4" />
        <circle cx="16" cy="28" r="2.3" />
        <circle cx="29.1" cy="28" r="2.3" />
        <circle cx="48" cy="36" r="2.3" />
        <circle cx="34.9" cy="36" r="2.3" />
      </g>
    </svg>
  );
}

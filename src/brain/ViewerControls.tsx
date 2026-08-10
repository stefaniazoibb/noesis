"use client";

import { useVizStore, type ViewPresetName } from "@/state/vizStore";

const VIEWS: { name: ViewPresetName; label: string }[] = [
  { name: "left", label: "L" },
  { name: "right", label: "R" },
  { name: "anterior", label: "Ant" },
  { name: "posterior", label: "Post" },
  { name: "superior", label: "Sup" },
  { name: "inferior", label: "Inf" },
];

function Toggle({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={active}
      onClick={onClick}
      className={`rounded px-2 py-1 text-xs transition-colors ${
        active
          ? "bg-zinc-700/80 text-zinc-100"
          : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
      }`}
    >
      {children}
    </button>
  );
}

export function ViewerControls() {
  const hemispheres = useVizStore((s) => s.hemispheres);
  const toggleHemisphere = useVizStore((s) => s.toggleHemisphere);
  const showSub = useVizStore((s) => s.showSubcortical);
  const setShowSubcortical = useVizStore((s) => s.setShowSubcortical);
  const requestView = useVizStore((s) => s.requestView);

  return (
    <div className="pointer-events-auto flex flex-wrap items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-950/80 p-1.5 backdrop-blur">
      <span className="px-1 text-[10px] uppercase tracking-wider text-zinc-500">
        Hemis
      </span>
      <Toggle
        active={hemispheres.left}
        onClick={() => toggleHemisphere("left")}
        title="Toggle left hemisphere"
      >
        Left
      </Toggle>
      <Toggle
        active={hemispheres.right}
        onClick={() => toggleHemisphere("right")}
        title="Toggle right hemisphere"
      >
        Right
      </Toggle>
      <span className="mx-1 h-4 w-px bg-zinc-800" aria-hidden />
      <Toggle
        active={showSub}
        onClick={() => setShowSubcortical(!showSub)}
        title="Show subcortical structures (cortex becomes translucent)"
      >
        Subcortex
      </Toggle>
      <span className="mx-1 h-4 w-px bg-zinc-800" aria-hidden />
      <span className="px-1 text-[10px] uppercase tracking-wider text-zinc-500">
        View
      </span>
      {VIEWS.map((v) => (
        <Toggle key={v.name} active={false} onClick={() => requestView(v.name)}>
          {v.label}
        </Toggle>
      ))}
    </div>
  );
}

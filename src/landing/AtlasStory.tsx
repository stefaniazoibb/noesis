"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { getAtlas, getRegion } from "@/lib/repo/atlas";
import { atlasPalettes } from "./palette";

const ShowcaseBrain = dynamic(() => import("./ShowcaseBrain"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center">
      <span className="text-[11px] uppercase tracking-[0.2em] text-text-3">
        Loading fsaverage atlas…
      </span>
    </div>
  ),
});

/** Evidence facts per region with ≥1 study: [studies, [disorder, studies][]] */
export type RegionEvidence = Record<string, [number, [string, number][]]>;

export interface AtlasStoryProps {
  densityColors: Record<string, string>;
  densityMax: number;
  densityRamp: string[];
  regionEvidence: RegionEvidence;
  counts: {
    cortical: number;
    subcortical: number;
    regionsWithEvidence: number;
    studies: number;
    disorders: number;
  };
}

type StepKey = "hero" | "parcels" | "systems" | "subcortex" | "evidence" | "explore";

function useMedia(query: string): boolean {
  const [v, setV] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setV(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, [query]);
  return v;
}

function StepCard({
  id,
  index,
  title,
  onActive,
  children,
}: {
  id: StepKey;
  index: string;
  title: string;
  onActive: (k: StepKey) => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => e.isIntersecting && onActive(id),
      { rootMargin: "-45% 0px -45% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [id, onActive]);
  return (
    <div className="flex min-h-[88vh] items-end pb-10 lg:items-center lg:pb-0">
      <div
        ref={ref}
        className="pointer-events-auto w-full max-w-md rounded-xl border border-line bg-ink-2/88 p-6 shadow-2xl shadow-black/30 backdrop-blur-md"
      >
        <p className="text-[11px] uppercase tracking-[0.22em] text-text-3">
          <span className="tabular-nums text-amber">{index}</span>
        </p>
        <h3 className="mt-2 font-serif text-[28px] leading-tight text-text">{title}</h3>
        <div className="mt-3 space-y-3 text-[14px] leading-relaxed text-text-2">{children}</div>
      </div>
    </div>
  );
}

export function AtlasStory(props: AtlasStoryProps) {
  const [step, setStep] = useState<StepKey>("hero");
  const [picked, setPicked] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const wide = useMedia("(min-width: 1024px)");
  // atlas-derived palettes are computed here: the atlas is already in the
  // client bundle, so only evidence-derived data travels in the page payload
  const { dkColors, systemColors, systems } = useMemo(
    () => atlasPalettes(getAtlas().regions),
    [],
  );

  const colors =
    step === "parcels"
      ? dkColors
      : step === "systems"
        ? systemColors
        : step === "subcortex"
          ? null
          : step === "evidence" || step === "explore"
            ? props.densityColors
            : null;

  const factOf = (id: string | null) => {
    const r = id ? getRegion(id) : undefined;
    if (!id || !r) return null;
    const ev = props.regionEvidence[id];
    const HEMI = { left: "L", right: "R", midline: "" } as const;
    return {
      name: `${r.name}${r.hemisphere === "midline" ? "" : ` (${HEMI[r.hemisphere]})`}`,
      kind: r.kind,
      hemisphere: r.hemisphere,
      studies: ev?.[0] ?? 0,
      top: (ev?.[1] ?? []).map(([name, studies]) => ({ name, studies })),
    };
  };
  const fact = factOf(picked);
  const hoverFact = factOf(hovered);

  return (
    <section id="atlas" aria-label="The brain as a map" className="relative">
      {/* sticky stage: the brain stays put while the story scrolls past */}
      <div className="sticky top-14 -mb-[calc(100dvh-3.5rem)] h-[calc(100dvh-3.5rem)] overflow-hidden">
        <div aria-hidden className="hairline-grid absolute inset-0 opacity-60" />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 55% 60% at 62% 50%, rgba(217,164,91,0.07), transparent 70%)",
          }}
        />
        <div
          className="absolute inset-0"
          role="img"
          aria-label="Rotating 3D human brain (FreeSurfer fsaverage, Desikan-Killiany atlas). Drag to rotate; click a region to see its indexed evidence."
        >
          <ShowcaseBrain
            colors={colors}
            showSubcortex={step === "subcortex"}
            selected={picked}
            onPick={setPicked}
            onHover={setHovered}
            shiftX={wide ? 0.17 : 0}
            shiftY={wide ? 0 : step === "hero" ? 0.16 : 0}
            distance={wide ? 1.12 : 2.0}
          />
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink to-transparent"
        />
        {/* hover readout + picked region card */}
        <div className="pointer-events-none absolute right-4 top-4 flex flex-col items-end gap-2 sm:right-6 lg:bottom-6 lg:top-auto">
          {hoverFact && hovered !== picked && (
            <p className="rounded-md border border-line bg-ink-2/85 px-3 py-1.5 text-[12px] text-text backdrop-blur">
              {hoverFact.name}
            </p>
          )}
          {fact && picked && (
            <div className="pointer-events-auto w-72 rounded-xl border border-amber/30 bg-ink-2/92 p-4 backdrop-blur-md">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[14px] text-text">{fact.name}</p>
                <button
                  type="button"
                  aria-label="Clear selection"
                  onClick={() => setPicked(null)}
                  className="text-[12px] text-text-3 hover:text-text"
                >
                  ✕
                </button>
              </div>
              <p className="mt-0.5 text-[11px] capitalize text-text-3">
                {fact.kind} ·{" "}
                {fact.hemisphere === "midline" ? "midline" : `${fact.hemisphere} hemisphere`}
              </p>
              <p className="mt-3 text-[12px] text-text-2">
                {fact.studies > 0 ? (
                  <>
                    <span className="tabular-nums text-text">{fact.studies}</span> indexed{" "}
                    {fact.studies === 1 ? "study" : "studies"}
                    {fact.top.length > 0 && (
                      <> — most for {fact.top.map((t) => `${t.name} (${t.studies})`).join(", ")}</>
                    )}
                  </>
                ) : (
                  "No indexed evidence yet — absence of evidence here is not evidence of absence."
                )}
              </p>
              <Link
                href={`/brain?region=${picked}`}
                className="mt-3 inline-block text-[12px] text-amber underline decoration-amber/30 underline-offset-4 hover:decoration-amber"
              >
                Open in the atlas →
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* scrolling content */}
      <div className="pointer-events-none relative z-10 mx-auto max-w-7xl px-5 sm:px-8">
        {/* HERO */}
        <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col justify-between pb-10 pt-10 lg:justify-center lg:pb-24 lg:pt-0">
          <div className="max-w-xl">
            <StepSensor id="hero" onActive={setStep} />
            <p className="text-[11px] uppercase tracking-[0.3em] text-text-3">
              Brain · Evidence · Intelligence
            </p>
            <h1 className="mt-5 text-[52px] font-extralight uppercase leading-none tracking-[0.22em] text-text sm:text-[84px]">
              NOĒSIS
            </h1>
            <p className="mt-6 font-serif text-[30px] italic leading-tight text-text sm:text-[40px]">
              Understanding the brain
              <br />
              through evidence.
            </p>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-text-2">
              An interactive intelligence platform connecting brain anatomy,
              scientific evidence and artificial intelligence.
            </p>
          </div>
          <div className="pointer-events-auto mt-8 flex flex-wrap items-center gap-3 lg:mt-10">
            <Link
              href="/brain"
              className="rounded-full bg-amber px-6 py-3 text-[12px] font-medium uppercase tracking-[0.18em] text-ink transition-colors hover:bg-[#e6bb7d]"
            >
              Explore the brain
            </Link>
            <a
              href="#evidence"
              className="rounded-full border border-line-strong bg-ink/40 px-6 py-3 text-[12px] uppercase tracking-[0.18em] text-text backdrop-blur transition-colors hover:border-cyan/60 hover:text-cyan"
            >
              Discover the evidence
            </a>

          </div>
        </div>

        {/* SECTION 2 — the brain as a map */}
        <div id="map" className="pt-6">
          <div className="pointer-events-auto max-w-md">
            <p className="flex items-center gap-3 text-[11px] uppercase tracking-[0.22em] text-text-3">
              <span className="tabular-nums text-amber">02</span>
              <span aria-hidden className="h-px w-8 bg-line-strong" />
              The brain as a map
            </p>
          </div>
          <StepCard id="parcels" index="A real atlas" title={`${props.counts.cortical} cortical regions`} onActive={setStep}>
            <p>
              The surface is FreeSurfer&rsquo;s <em>fsaverage</em> template,
              parcellated with the Desikan-Killiany atlas — {props.counts.cortical / 2} regions
              per hemisphere, each painted in a softened version of its canonical atlas
              colour. Nothing here is an illustration: every labelled vertex of
              the real surface belongs to exactly one region.
            </p>
          </StepCard>
          <StepCard id="systems" index="Grouped by system" title="Lobes and systems" onActive={setStep}>
            <p>The same regions, grouped by anatomical system.</p>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {systems.map((s) => (
                <li key={s.key} className="flex items-center gap-2 text-[12px]">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
                  <span className="text-text-2">{s.label}</span>
                  <span className="ml-auto tabular-nums text-text-3">{s.count}</span>
                </li>
              ))}
            </ul>
          </StepCard>
          <StepCard id="subcortex" index="Beneath the cortex" title={`${props.counts.subcortical} subcortical structures`} onActive={setStep}>
            <p>
              The cortex turns translucent to reveal the deep structures from
              fsaverage&rsquo;s own segmentation (aseg): hippocampus, amygdala,
              thalamus, caudate, putamen, pallidum and accumbens in each
              hemisphere, plus the brainstem — in the same coordinate frame as
              the surface, with no cross-template registration.
            </p>
          </StepCard>
          <StepCard id="evidence" index="Where evidence attaches" title="Regions carry research findings" onActive={setStep}>
            <p>
              Now each region is shaded by the number of distinct indexed
              studies linking it to any of the {props.counts.disorders} disorders.{" "}
              {props.counts.regionsWithEvidence} of {props.counts.cortical + props.counts.subcortical} regions
              carry at least one finding.
            </p>
            <div className="flex items-center gap-2">
              <span className="flex">
                {props.densityRamp.map((c) => (
                  <span key={c} className="h-2.5 w-5" style={{ backgroundColor: c }} aria-hidden />
                ))}
              </span>
              <span className="text-[11px] text-text-3">1 → {props.densityMax} studies</span>
            </div>
            <p className="text-[12px] text-text-3">
              Density measures research attention in a curated corpus — not
              evidence quality, and not effect size.
            </p>
          </StepCard>
          <StepCard id="explore" index="Your turn" title="Click any region" onActive={setStep}>
            <p>
              Drag to rotate the brain and click a region to see how much
              indexed evidence it carries. The full atlas adds hover readouts,
              anatomical search, convergence, conflict and comparison overlays,
              and the complete provenance of every finding.
            </p>
            <Link
              href="/brain"
              className="inline-block text-[13px] text-amber underline decoration-amber/30 underline-offset-4 hover:decoration-amber"
            >
              Enter the full atlas →
            </Link>
          </StepCard>
          <div className="h-[20vh]" />
        </div>
      </div>
    </section>
  );
}

function StepSensor({ id, onActive }: { id: StepKey; onActive: (k: StepKey) => void }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && onActive(id));
    io.observe(el);
    return () => io.disconnect();
  }, [id, onActive]);
  return <span ref={ref} aria-hidden />;
}

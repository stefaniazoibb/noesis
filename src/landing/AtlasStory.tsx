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
      <span className="font-mono text-[11px] text-text-3">
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
    assertions: number;
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

function Step({
  id,
  label,
  title,
  active,
  register,
  children,
}: {
  id: StepKey;
  label: string;
  title: string;
  active: boolean;
  register: (k: StepKey, el: HTMLElement | null) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[55vh] items-center py-10 lg:min-h-[70vh]">
      <div
        ref={(el) => register(id, el)}
        className={`max-w-md transition-opacity duration-500 ${active ? "opacity-100" : "opacity-35"}`}
      >
        <p className="font-mono text-[12px] text-text-3">{label}</p>
        <h3 className="mt-3 text-[26px] font-medium leading-tight tracking-[-0.015em] text-text">
          {title}
        </h3>
        <div className="mt-4 space-y-3 text-[15px] leading-relaxed text-text-2">{children}</div>
      </div>
    </div>
  );
}

const STEP_ORDER: StepKey[] = ["parcels", "systems", "subcortex", "evidence", "explore"];

const CAPTION: Record<StepKey, string> = {
  hero: "Fig. 1. fsaverage cortical surface (FreeSurfer). Drag to rotate, click a region.",
  parcels: "Fig. 1a. Desikan-Killiany parcellation, 34 regions per hemisphere. Hues softened from the atlas colour table.",
  systems: "Fig. 1b. The same regions grouped by anatomical system.",
  subcortex: "Fig. 1c. Subcortical structures from the fsaverage aseg segmentation; cortex rendered translucent.",
  evidence: "Fig. 1d. Distinct indexed studies per region, all disorders. Shading shows research attention, not effect size.",
  explore: "Fig. 1e. Click any region to read its indexed evidence.",
};

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
  const c = props.counts;

  // active step = the last step whose top has passed 60% of the viewport.
  // Position-based (not crossing-based), so fast scrolls and jumps can never
  // leave the plate out of sync with the text.
  const stepEls = useRef(new Map<StepKey, HTMLElement>());
  const register = (k: StepKey, el: HTMLElement | null) => {
    if (el) stepEls.current.set(k, el);
    else stepEls.current.delete(k);
  };
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const line = window.innerHeight * 0.6;
      let current: StepKey = "hero";
      for (const k of STEP_ORDER) {
        const el = stepEls.current.get(k);
        if (el && el.getBoundingClientRect().top < line) current = k;
      }
      setStep((prev) => (prev === current ? prev : current));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section id="atlas" aria-label="The brain as a map" className="relative border-b border-line">
      <div className="grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* the plate: pinned while the text scrolls (top half on phones) */}
        <div className="sticky top-14 z-10 h-[46vh] border-b border-line bg-[#ecebe6] lg:order-2 lg:h-[calc(100dvh-3.5rem)] lg:border-b-0 lg:border-l">
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
              distance={wide ? 1.05 : 1.3}
            />
          </div>
          {hoverFact && hovered !== picked && (
            <p className="pointer-events-none absolute left-4 top-4 rounded-[3px] border border-line bg-white/90 px-2.5 py-1 text-[12px] text-text">
              {hoverFact.name}
            </p>
          )}
          {fact && picked && (
            <div className="absolute right-3 top-3 w-64 rounded-[4px] border border-line-strong bg-white p-3.5 shadow-sm lg:right-5 lg:top-5 lg:w-72">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[14px] font-medium text-text">{fact.name}</p>
                <button type="button" aria-label="Clear selection" onClick={() => setPicked(null)} className="text-[12px] text-text-3 hover:text-text">
                  ✕
                </button>
              </div>
              <p className="mt-0.5 font-mono text-[11px] text-text-3">
                {fact.kind} · {fact.hemisphere === "midline" ? "midline" : `${fact.hemisphere} hemisphere`}
              </p>
              <p className="mt-2.5 text-[13px] leading-snug text-text-2">
                {fact.studies > 0 ? (
                  <>
                    <span className="font-mono text-text">{fact.studies}</span> indexed{" "}
                    {fact.studies === 1 ? "study" : "studies"}
                    {fact.top.length > 0 && <>; most for {fact.top.map((t) => `${t.name} (${t.studies})`).join(", ")}</>}.
                  </>
                ) : (
                  "No indexed evidence yet. Absence of evidence here is not evidence of absence."
                )}
              </p>
              <Link href={`/brain?region=${picked}`} className="mt-2.5 inline-block text-[13px] font-medium text-text underline underline-offset-4">
                Open in the atlas
              </Link>
            </div>
          )}
          <p className="pointer-events-none absolute inset-x-4 bottom-3 font-mono text-[11px] leading-snug text-text-3 lg:inset-x-6 lg:bottom-5">
            {CAPTION[step]}
            {(step === "evidence" || step === "explore") && (
              <span className="ml-2 inline-flex items-center gap-1 align-middle">
                {props.densityRamp.map((col) => (
                  <span key={col} className="inline-block h-2 w-4" style={{ backgroundColor: col }} aria-hidden />
                ))}
                <span className="ml-1">1 to {props.densityMax}</span>
              </span>
            )}
          </p>
        </div>

        {/* the text column */}
        <div className="px-5 sm:px-8 lg:order-1 lg:px-12 xl:pl-[max(4rem,calc((100vw-1400px)/2+4rem))] xl:pr-16">
          <div className="flex flex-col justify-center py-12 lg:min-h-[calc(100dvh-3.5rem)] lg:py-0">
            <p className="text-[13px] font-medium text-text-3">NOĒSIS · brain evidence atlas</p>
            <h1 className="mt-5 text-[42px] font-medium leading-[1.04] tracking-[-0.03em] text-text sm:text-[60px]">
              Understanding the brain through evidence.
            </h1>
            <p className="mt-6 max-w-md text-[17px] leading-relaxed text-text-2">
              An interactive intelligence platform connecting brain anatomy,
              scientific evidence and artificial intelligence.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/brain"
                className="rounded-[3px] bg-text px-5 py-3 text-[14px] font-medium text-white transition-colors hover:bg-[#3a3a35]"
              >
                Explore the brain
              </Link>
              <a
                href="#evidence"
                className="rounded-[3px] border border-text px-5 py-3 text-[14px] font-medium text-text transition-colors hover:bg-text hover:text-white"
              >
                Discover the evidence
              </a>
            </div>
            <dl className="mt-12 grid max-w-md grid-cols-4 border-t border-line pt-4">
              {[
                [c.studies, "studies"],
                [c.assertions, "assertions"],
                [c.disorders, "disorders"],
                [c.cortical + c.subcortical, "regions"],
              ].map(([v, l]) => (
                <div key={l as string}>
                  <dd className="font-mono text-[20px] text-text">{v}</dd>
                  <dt className="mt-0.5 text-[12px] text-text-3">{l}</dt>
                </div>
              ))}
            </dl>
            <p className="mt-3 max-w-md text-[12px] text-text-3">
              Every study verified against PubMed and OpenAlex by DOI or PMID.
            </p>
          </div>

          <div id="map" className="border-t border-line pt-12">
            <p className="font-mono text-[12px] text-text-3">2</p>
            <h2 className="mt-2 text-[32px] font-medium tracking-[-0.02em] text-text">The brain as a map</h2>
          </div>
          <Step id="parcels" label="2.1 Parcellation" title={`${c.cortical} cortical regions`} active={step === "parcels"} register={register}>
            <p>
              The surface is FreeSurfer&rsquo;s fsaverage template, divided by the
              Desikan-Killiany atlas into {c.cortical / 2} regions per hemisphere. Every
              labelled vertex of the mesh belongs to exactly one region, so a
              click resolves to an atlas label, not to an approximate location.
            </p>
          </Step>
          <Step id="systems" label="2.2 Systems" title="Lobes and systems" active={step === "systems"} register={register}>
            <p>The same regions grouped by anatomical system.</p>
            <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5 border-t border-line pt-3">
              {systems.map((s) => (
                <li key={s.key} className="flex items-center gap-2 text-[13px]">
                  <span className="h-2.5 w-2.5 shrink-0" style={{ backgroundColor: s.color }} aria-hidden />
                  <span className="text-text-2">{s.label}</span>
                  <span className="ml-auto font-mono text-[12px] text-text-3">{s.count}</span>
                </li>
              ))}
            </ul>
          </Step>
          <Step id="subcortex" label="2.3 Subcortex" title={`${c.subcortical} subcortical structures`} active={step === "subcortex"} register={register}>
            <p>
              Hippocampus, amygdala, thalamus, caudate, putamen, pallidum and
              accumbens in each hemisphere, plus the brainstem. They come from
              fsaverage&rsquo;s own segmentation, so surface and deep structures
              share one coordinate frame without cross-template registration.
            </p>
          </Step>
          <Step id="evidence" label="2.4 Evidence" title="Findings attach to regions" active={step === "evidence"} register={register}>
            <p>
              Each region is shaded by the number of distinct indexed studies
              linking it to any of the {c.disorders} disorders. {c.regionsWithEvidence} of{" "}
              {c.cortical + c.subcortical} regions carry at least one finding.
            </p>
            <p className="text-[13px] text-text-3">
              Shading measures research attention in a curated corpus. It is
              not a measure of evidence quality or effect size.
            </p>
          </Step>
          <Step id="explore" label="2.5 Interaction" title="Select a region" active={step === "explore"} register={register}>
            <p>
              Click any region on the plate to read how much indexed evidence it
              carries. The full atlas adds anatomical search, convergence,
              conflict and comparison overlays, and the provenance of every
              finding.
            </p>
            <Link href="/brain" className="inline-block text-[14px] font-medium text-text underline underline-offset-4">
              Open the full atlas
            </Link>
          </Step>
        </div>
      </div>
    </section>
  );
}

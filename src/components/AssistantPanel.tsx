"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useVizStore } from "@/state/vizStore";
import { getRegion } from "@/lib/repo/atlas";
import { getModalities } from "@/lib/repo/entities";
import { SaveToNotebook } from "@/components/SaveToNotebook";
import { surname } from "@/lib/evidence/summary";

interface Citation {
  id: string;
  title: string;
  firstAuthor?: string | null;
  journal: string | null;
  year: number;
  doi: string | null;
  pmid: string | null;
  modalities?: string[];
}

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  /** answer = AI synthesis; retrieval = records only (no model available) */
  kind?: "answer" | "retrieval" | "viz";
  citations?: Citation[];
  regions?: string[];
  flags?: { strippedCitations: number; uncitedSentences: number };
  disclaimer?: string | null;
  error?: boolean;
}

export const EXAMPLE_QUESTIONS = [
  "Which brain regions have the strongest evidence convergence in Alzheimer's disease?",
  "What findings contradict the hippocampal association with depression?",
  "Which disorders have the weakest evidence coverage?",
  "What research questions emerge from current evidence gaps in schizophrenia?",
  "Compare the neuroimaging evidence for schizophrenia and bipolar disorder.",
];

const HEMI = { left: "L", right: "R", midline: "" } as const;
const modAbbr = () => new Map(getModalities().map((m) => [m.id, m.abbreviation]));

function citationUrl(c: Citation): string {
  if (c.doi) return `https://doi.org/${c.doi}`;
  if (c.pmid) return `https://pubmed.ncbi.nlm.nih.gov/${c.pmid}/`;
  return "#";
}

/** Inline [study_id] -> numbered superscripts; [corpus] -> corpus badge. */
function AnswerText({ text, citations }: { text: string; citations: Citation[] }) {
  const order = new Map(citations.map((c, i) => [c.id, i + 1]));
  const parts = text.split(/(\[study_[a-z0-9_]+\]|\[corpus\])/g);
  return (
    <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-text">
      {parts.map((part, i) => {
        if (part === "[corpus]")
          return (
            <sup key={i}>
              <Link
                href="/gaps#coverage"
                title="Deterministic count over the curated corpus"
                className="rounded border border-cyan/40 px-1 text-[10px] text-cyan hover:bg-cyan/10"
              >
                corpus
              </Link>
            </sup>
          );
        const m = part.match(/^\[(study_[a-z0-9_]+)\]$/);
        if (!m) return part;
        const n = order.get(m[1]);
        const c = citations.find((x) => x.id === m[1]);
        return n && c ? (
          <sup key={i}>
            <a
              href={`#cite-${c.id}`}
              title={c.title}
              className="text-amber hover:text-amber/80"
            >
              [{n}]
            </a>
          </sup>
        ) : null;
      })}
    </p>
  );
}

function SourceCards({ citations, compact }: { citations: Citation[]; compact: boolean }) {
  const abbr = modAbbr();
  return (
    <ol className={compact ? "space-y-1.5" : "grid gap-2 sm:grid-cols-2"}>
      {citations.map((c, n) => (
        <li
          key={c.id}
          id={`cite-${c.id}`}
          className="scroll-mt-24 rounded-lg border border-line bg-ink p-3"
        >
          <p className="text-[10px] tabular-nums text-text-3">
            [{n + 1}] {c.firstAuthor ? `${surname(c.firstAuthor)} et al. · ` : ""}
            {c.journal} · {c.year}
            {c.modalities && c.modalities.length > 0 && ` · ${c.modalities.map((m) => abbr.get(m) ?? m).join(", ")}`}
          </p>
          <Link
            href={`/evidence/${c.id}`}
            className={`mt-1 block leading-snug text-text hover:text-amber ${compact ? "line-clamp-2 text-[11px]" : "text-[12px]"}`}
          >
            {c.title}
          </Link>
          <p className="mt-1.5 flex gap-3 text-[10px]">
            {c.doi && (
              <a href={`https://doi.org/${c.doi}`} target="_blank" rel="noreferrer" className="text-text-2 underline decoration-line-strong underline-offset-2 hover:text-text">
                DOI
              </a>
            )}
            {c.pmid && (
              <a href={`https://pubmed.ncbi.nlm.nih.gov/${c.pmid}/`} target="_blank" rel="noreferrer" className="text-text-2 underline decoration-line-strong underline-offset-2 hover:text-text">
                PMID {c.pmid}
              </a>
            )}
          </p>
        </li>
      ))}
    </ol>
  );
}

export function AssistantPanel({
  variant,
  initialQuestion,
}: {
  variant: "page" | "drawer";
  initialQuestion?: string | null;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const askedInitial = useRef(false);
  const router = useRouter();
  const pathname = usePathname();
  const selectedRegion = useVizStore((s) => s.selectedRegion);
  const page = variant === "page";

  const push = (m: ChatMessage) =>
    setMessages((prev) => {
      const next = [...prev, m];
      setTimeout(() => {
        const el = listRef.current;
        if (!el) return;
        if (page) {
          const last = el.lastElementChild as HTMLElement | null;
          last?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        } else el.scrollTo({ top: el.scrollHeight });
      }, 0);
      return next;
    });

  const showOnAtlas = (regionId: string) => {
    const s = useVizStore.getState();
    if (regionId.startsWith("sub_")) s.setShowSubcortical(true);
    s.selectRegion(regionId);
    s.requestFocus(regionId);
    if (pathname !== "/brain") router.push("/brain");
  };

  async function ask(question: string) {
    if (!question.trim() || loading) return;
    push({ role: "user", text: question });
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      if (!res.ok) {
        push({
          role: "assistant",
          text: data?.message ?? "The assistant is unavailable right now. Please try again.",
          error: true,
        });
        return;
      }
      if (data.type === "viz") {
        const s = useVizStore.getState();
        s.applyPatch(data.patch);
        if (data.selectRegion) {
          s.selectRegion(data.selectRegion);
          if (data.selectRegion.startsWith("sub_")) s.setShowSubcortical(true);
          s.requestFocus(data.selectRegion);
        }
        push({ role: "assistant", kind: "viz", text: data.explanation });
        if (pathname !== "/brain") router.push("/brain");
        return;
      }
      push({
        role: "assistant",
        kind: data.type === "retrieval" ? "retrieval" : "answer",
        text: data.answer,
        citations: data.citations,
        regions: data.regions,
        flags: data.flags,
        disclaimer: data.disclaimer,
      });
    } catch {
      push({
        role: "assistant",
        text: "Network error — the assistant could not be reached.",
        error: true,
      });
    } finally {
      setLoading(false);
    }
  }

  // a question handed over by URL (?q=) is asked once, after mount
  useEffect(() => {
    if (!initialQuestion) return;
    // the guard lives inside the timer so a dev-mode effect re-run
    // (mount -> cleanup -> mount) still asks exactly once
    const t = setTimeout(() => {
      if (askedInitial.current) return;
      askedInitial.current = true;
      ask(initialQuestion);
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion]);

  const region = selectedRegion ? getRegion(selectedRegion) : undefined;
  const suggestions =
    messages.length > 0
      ? []
      : !page && region
        ? [
            `Which disorders are linked to the ${region.name.toLowerCase()}?`,
            `What modalities support evidence for the ${region.name.toLowerCase()}?`,
          ]
        : page
          ? EXAMPLE_QUESTIONS
          : [
              "What brain regions are consistently associated with depression?",
              "Show schizophrenia evidence, fMRI only",
            ];

  return (
    <div
      className={`flex flex-col ${
        page
          ? "w-full"
          : "h-[26rem] w-96 max-w-[calc(100vw-1.5rem)] rounded-xl border border-line bg-ink-2/95 backdrop-blur"
      }`}
    >
      <div
        ref={listRef}
        className={page ? "space-y-6" : "min-h-0 flex-1 space-y-3 overflow-y-auto p-4"}
      >
        {messages.length === 0 && !page && (
          <p className="text-[12px] text-text-3">
            Ask about the indexed evidence, or drive the brain (&ldquo;show depression evidence, fMRI only&rdquo;).
            Answers cite their sources.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i}>
            {m.role === "user" ? (
              <p
                className={
                  page
                    ? "font-serif text-[24px] leading-snug text-text"
                    : "ml-8 rounded-lg bg-surface px-3 py-2 text-[13px] text-text"
                }
              >
                {m.text}
              </p>
            ) : (
              <div
                className={`rounded-xl border ${page ? "p-5" : "mr-2 p-3"} ${
                  m.error ? "border-amber-900/60 bg-amber-950/20" : "border-line bg-ink-2/70"
                }`}
              >
                {m.kind === "answer" && (
                  <p className="mb-2 text-[10px] uppercase tracking-[0.18em] text-amber">
                    AI synthesis · interpretation of the cited records
                  </p>
                )}
                {m.kind === "retrieval" && (
                  <p className="mb-2 text-[10px] uppercase tracking-[0.18em] text-cyan">
                    Retrieved evidence · no AI synthesis
                  </p>
                )}
                {m.kind === "retrieval" ? (
                  <p className="text-[13px] leading-relaxed text-text-2">{m.text}</p>
                ) : (
                  <AnswerText text={m.text} citations={m.citations ?? []} />
                )}
                {m.flags && (m.flags.strippedCitations > 0 || m.flags.uncitedSentences > 0) && (
                  <p className="mt-2 text-[11px] text-amber/90">
                    {m.flags.strippedCitations > 0 &&
                      `${m.flags.strippedCitations} unverifiable citation(s) removed. `}
                    {m.flags.uncitedSentences > 0 &&
                      `${m.flags.uncitedSentences} statement(s) lack direct citations — verify carefully.`}
                  </p>
                )}
                {m.regions && m.regions.length > 0 && (
                  <div className="mt-3">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-text-3">
                      Regions in this answer · show on the atlas
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {m.regions.map((id) => {
                        const r = getRegion(id);
                        if (!r) return null;
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => showOnAtlas(id)}
                            className="rounded-full border border-line px-2.5 py-0.5 text-[11px] text-text-2 hover:border-amber/50 hover:text-amber"
                          >
                            {r.name}
                            {r.hemisphere !== "midline" && ` (${HEMI[r.hemisphere]})`}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {m.citations && m.citations.length > 0 && (
                  <div className="mt-4 border-t border-line pt-3">
                    <p className="mb-2 text-[10px] uppercase tracking-[0.16em] text-text-3">
                      Sources · indexed evidence ({m.citations.length})
                    </p>
                    <SourceCards citations={m.citations} compact={!page} />
                  </div>
                )}
                {m.kind === "answer" && m.citations?.length === 0 && !m.error && (
                  <p className="mt-2 text-[11px] text-text-3">
                    This answer cites no indexed study — treat it as unsupported.
                  </p>
                )}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  {m.disclaimer && <p className="text-[10px] text-text-3">{m.disclaimer}</p>}
                  {!m.error && m.citations && m.citations.length > 0 && (
                    <SaveToNotebook
                      compact
                      entry={{
                        key: `answer:${i}:${m.text.slice(0, 40)}`,
                        type: "answer",
                        title:
                          messages[i - 1]?.role === "user"
                            ? messages[i - 1].text.slice(0, 80)
                            : "Assistant answer",
                        body: m.text,
                        citations: m.citations.map((c) => ({
                          id: c.id,
                          title: c.title,
                          url: citationUrl(c),
                        })),
                        aiGenerated: m.kind === "answer",
                      }}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        {loading && (
          <p className="flex items-center gap-2 text-[12px] text-text-3" role="status">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber" aria-hidden />
            Retrieving evidence and checking citations…
          </p>
        )}
        {suggestions.length > 0 && (
          <div className={page ? "" : "pt-1"}>
            {page && (
              <p className="mb-3 text-[10px] uppercase tracking-[0.18em] text-text-3">Try a question</p>
            )}
            <ul className={page ? "grid gap-2 sm:grid-cols-2" : "flex flex-wrap gap-1.5"}>
              {suggestions.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => ask(s)}
                    className={
                      page
                        ? "h-full w-full rounded-xl border border-line bg-ink-2/60 px-4 py-3 text-left text-[13px] leading-snug text-text-2 transition-colors hover:border-amber/50 hover:text-text"
                        : "rounded-full border border-line px-2.5 py-1 text-[11px] text-text-2 transition-colors hover:border-line-strong hover:text-text"
                    }
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <form
        className={
          page
            ? "sticky bottom-3 mt-8 flex gap-2 rounded-xl border border-line bg-ink-2/95 p-2 shadow-2xl shadow-black/40 backdrop-blur"
            : "flex gap-2 border-t border-line p-3"
        }
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about the evidence…"
          aria-label="Ask the assistant"
          className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-3 py-2 text-[14px] text-text placeholder:text-text-3 focus:border-line focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-lg bg-amber px-4 py-2 text-[12px] font-medium uppercase tracking-[0.14em] text-ink transition-colors hover:bg-[#e6bb7d] disabled:opacity-40"
        >
          Ask
        </button>
      </form>
    </div>
  );
}

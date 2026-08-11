"use client";

import { useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useVizStore } from "@/state/vizStore";
import { getRegion } from "@/lib/repo/atlas";
import { SaveToNotebook } from "@/components/SaveToNotebook";

interface Citation {
  id: string;
  title: string;
  journal: string | null;
  year: number;
  doi: string | null;
  pmid: string | null;
}

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  citations?: Citation[];
  flags?: { strippedCitations: number; uncitedSentences: number };
  disclaimer?: string | null;
  error?: boolean;
}

function citationUrl(c: Citation): string {
  if (c.doi) return `https://doi.org/${c.doi}`;
  if (c.pmid) return `https://pubmed.ncbi.nlm.nih.gov/${c.pmid}/`;
  return "#";
}

/** Replace inline [study_id] citations with numbered superscript links. */
function AnswerText({ text, citations }: { text: string; citations: Citation[] }) {
  const order = new Map(citations.map((c, i) => [c.id, i + 1]));
  const parts = text.split(/(\[study_[a-z0-9_]+\])/g);
  return (
    <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">
      {parts.map((part, i) => {
        const m = part.match(/^\[(study_[a-z0-9_]+)\]$/);
        if (!m) return part;
        const n = order.get(m[1]);
        const c = citations.find((x) => x.id === m[1]);
        return n && c ? (
          <sup key={i}>
            <a
              href={citationUrl(c)}
              target="_blank"
              rel="noreferrer"
              title={c.title}
              className="text-zinc-400 hover:text-zinc-100"
            >
              [{n}]
            </a>
          </sup>
        ) : null;
      })}
    </p>
  );
}

export function AssistantPanel({ variant }: { variant: "page" | "drawer" }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const selectedRegion = useVizStore((s) => s.selectedRegion);

  const push = (m: ChatMessage) =>
    setMessages((prev) => {
      const next = [...prev, m];
      setTimeout(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
      }, 0);
      return next;
    });

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
          text:
            data?.message ??
            "The assistant is unavailable right now. Please try again.",
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
        }
        push({ role: "assistant", text: data.explanation });
        if (pathname !== "/brain") router.push("/brain");
        return;
      }
      push({
        role: "assistant",
        text: data.answer,
        citations: data.citations,
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

  const region = selectedRegion ? getRegion(selectedRegion) : undefined;
  const suggestions =
    messages.length > 0
      ? []
      : region
        ? [
            `Which disorders are linked to the ${region.name.toLowerCase()}?`,
            `What modalities support evidence for the ${region.name.toLowerCase()}?`,
          ]
        : [
            "What brain regions are consistently associated with depression?",
            "Which regions have both imaging and stimulation evidence in PTSD?",
            "Show schizophrenia evidence, fMRI only",
          ];

  return (
    <div
      className={`flex flex-col ${
        variant === "page"
          ? "mx-auto h-full w-full max-w-2xl"
          : "h-[26rem] w-96 max-w-[calc(100vw-2rem)] rounded-lg border border-zinc-800 bg-zinc-950/90 backdrop-blur"
      }`}
    >
      <div
        ref={listRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4"
      >
        {messages.length === 0 && (
          <p className="text-sm text-zinc-500">
            Ask about the indexed evidence — regions, disorders, modalities,
            studies — or drive the 3D brain (&ldquo;show depression evidence,
            fMRI only&rdquo;). Scientific answers cite their sources.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i}>
            {m.role === "user" ? (
              <p className="ml-8 rounded-lg bg-zinc-800/60 px-3 py-2 text-sm text-zinc-100">
                {m.text}
              </p>
            ) : (
              <div
                className={`mr-4 rounded-lg border px-3 py-2 ${
                  m.error
                    ? "border-amber-900/60 bg-amber-950/20"
                    : "border-zinc-800 bg-zinc-900/40"
                }`}
              >
                <AnswerText text={m.text} citations={m.citations ?? []} />
                {m.citations && m.citations.length > 0 && (
                  <ol className="mt-2 space-y-1 border-t border-zinc-800/70 pt-2">
                    {m.citations.map((c, n) => (
                      <li key={c.id} className="text-[11px] text-zinc-500">
                        [{n + 1}]{" "}
                        <a
                          href={citationUrl(c)}
                          target="_blank"
                          rel="noreferrer"
                          className="underline decoration-zinc-700 hover:text-zinc-300"
                        >
                          {c.title}
                        </a>{" "}
                        · {c.journal} · {c.year}
                      </li>
                    ))}
                  </ol>
                )}
                {m.flags &&
                  (m.flags.strippedCitations > 0 ||
                    m.flags.uncitedSentences > 0) && (
                    <p className="mt-1.5 text-[10px] text-amber-600/80">
                      {m.flags.strippedCitations > 0 &&
                        `${m.flags.strippedCitations} unverifiable citation(s) removed. `}
                      {m.flags.uncitedSentences > 0 &&
                        `${m.flags.uncitedSentences} statement(s) lack direct citations — verify carefully.`}
                    </p>
                  )}
                {m.disclaimer && (
                  <p className="mt-1.5 text-[10px] text-zinc-600">
                    {m.disclaimer}
                  </p>
                )}
                {!m.error && m.citations && m.citations.length > 0 && (
                  <div className="mt-1.5">
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
                        aiGenerated: true,
                      }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <p className="text-xs text-zinc-500">Retrieving evidence…</p>
        )}
        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => ask(s)}
                className="rounded-full border border-zinc-800 px-2.5 py-1 text-[11px] text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
      <form
        className="flex gap-2 border-t border-zinc-800/70 p-3"
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
          className="min-w-0 flex-1 rounded-md border border-zinc-800 bg-zinc-900/70 px-3 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 transition-colors hover:bg-zinc-800 disabled:opacity-40"
        >
          Ask
        </button>
      </form>
    </div>
  );
}

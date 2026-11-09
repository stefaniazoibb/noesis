import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AssistantPanel } from "@/components/AssistantPanel";
import { AssistantFromQuery } from "@/components/AssistantFromQuery";
import { PageHeader } from "@/components/PageHeader";

export const metadata: Metadata = {
  title: "Ask NOĒSIS · NOĒSIS",
  description:
    "A research assistant that answers only from retrieved, DOI/PMID-verified evidence; it cites its sources inline and flags uncited statements.",
};

export default function AssistantPage() {
  return (
    <main className="route-fade mx-auto w-full max-w-7xl flex-1 px-5 py-10 sm:px-8">
      <div className="grid gap-10 lg:grid-cols-[1fr_17rem]">
        <div className="min-w-0 max-w-3xl">
          <PageHeader eyebrow="Ask NOĒSIS" title="Ask the evidence">
            <p>
              Answers are synthesized only from records retrieved from the indexed corpus. Citations
              outside the retrieved set are removed and uncited statements are flagged. Not a diagnostic tool. Research
              averages often cannot describe an individual&rsquo;s experience; for anything personal,
              talk with a licensed clinician you trust.
            </p>
          </PageHeader>
          <div className="mt-10">
            <Suspense fallback={<AssistantPanel variant="page" />}>
              <AssistantFromQuery />
            </Suspense>
          </div>
        </div>
        <aside className="space-y-4 text-[12px] leading-relaxed lg:pt-24">
          <div className="rounded-[4px] border border-line bg-ink-2/70 p-4">
            <p className="font-mono text-[10px] text-text-3">How answers are built</p>
            <ol className="mt-3 space-y-2.5 text-text-2">
              <li><span className="text-amber">1.</span> Entities in your question are linked to the catalogue (regions, disorders, modalities). Unknown names are dropped, never invented.</li>
              <li><span className="text-amber">2.</span> Retrieval is deterministic: evidence-graph lookups plus lexical search over study text.</li>
              <li><span className="text-amber">3.</span> The model writes a hedged synthesis using only those records.</li>
              <li><span className="text-amber">4.</span> A validator strips citations outside the retrieved set and flags uncited claims.</li>
            </ol>
          </div>
          <div className="rounded-[4px] border border-line bg-ink-2/70 p-4">
            <p className="font-mono text-[10px] text-text-3">Labels you will see</p>
            <dl className="mt-3 space-y-2">
              <div><dt className="text-amber">AI synthesis</dt><dd className="text-text-3">Model-written interpretation of cited records.</dd></div>
              <div><dt className="text-cyan">Retrieved evidence</dt><dd className="text-text-3">Records only, no model (e.g. no API key configured).</dd></div>
              <div><dt className="text-text-2">Sources</dt><dd className="text-text-3">The indexed studies: the evidence itself.</dd></div>
            </dl>
          </div>
          <p className="text-text-3">
            You can also drive the atlas: &ldquo;show schizophrenia evidence, fMRI only&rdquo;. See the{" "}
            <Link href="/about#methodology" className="underline decoration-line-strong underline-offset-4 hover:text-text">methodology</Link>.
          </p>
        </aside>
      </div>
    </main>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { GapsExplorer } from "@/evidence/GapsExplorer";

export const metadata: Metadata = {
  title: "Research gaps · NOĒSIS",
  description:
    "Rule-based evidence gaps, sparse coverage, missing modality combinations, contradictions and AI-generated research questions, each linked to its evidence.",
};

export default function GapsPage() {
  return (
    <main className="route-fade mx-auto w-full max-w-7xl flex-1 px-5 py-10 sm:px-8">
      <Suspense fallback={<p className="text-sm text-text-3">Loading gaps…</p>}>
        <GapsExplorer />
      </Suspense>
    </main>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { EvidenceBrowser } from "@/evidence/EvidenceBrowser";

export const metadata: Metadata = {
  title: "Evidence — NOĒSIS",
  description:
    "Browse the curated, DOI/PMID-verified study corpus by disorder, region, modality, direction and year, with full traceability to assertions and regions.",
};

export default function EvidencePage() {
  return (
    <main className="route-fade mx-auto w-full max-w-7xl flex-1 px-5 py-10 sm:px-8">
      <Suspense fallback={<p className="text-sm text-text-3">Loading corpus…</p>}>
        <EvidenceBrowser />
      </Suspense>
    </main>
  );
}

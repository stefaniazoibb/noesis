import type { Metadata } from "next";
import { Suspense } from "react";
import { ConvergenceExplorer } from "@/evidence/ConvergenceExplorer";

export const metadata: Metadata = {
  title: "Convergence · NOĒSIS",
  description:
    "Compare rule-based convergence profiles across regions, disorders and modality categories.",
};

export default function ConvergencePage() {
  return (
    <main className="route-fade mx-auto w-full max-w-7xl flex-1 px-5 py-10 sm:px-8">
      <Suspense fallback={<p className="text-sm text-text-3">Loading convergence profiles…</p>}>
        <ConvergenceExplorer />
      </Suspense>
    </main>
  );
}

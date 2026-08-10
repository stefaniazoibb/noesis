import type { Metadata } from "next";
import { AssistantPanel } from "@/components/AssistantPanel";

export const metadata: Metadata = {
  title: "AI Assistant — NOĒSIS",
};

export default function AssistantPage() {
  return (
    <main className="flex min-h-0 flex-1 flex-col px-6 py-6">
      <div className="mx-auto w-full max-w-2xl">
        <h1 className="text-2xl font-light tracking-wide text-zinc-100">
          Research assistant
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Answers are synthesized only from the indexed corpus and always
          cite DOI/PMID-verified studies. Not a diagnostic tool.
        </p>
      </div>
      <div className="mt-4 min-h-0 flex-1">
        <AssistantPanel variant="page" />
      </div>
    </main>
  );
}

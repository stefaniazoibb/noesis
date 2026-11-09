"use client";

import { useSearchParams } from "next/navigation";
import { AssistantPanel } from "./AssistantPanel";

/** Reads ?q= on the client so /assistant stays a static page. */
export function AssistantFromQuery() {
  const q = useSearchParams().get("q");
  return <AssistantPanel variant="page" initialQuestion={q ? q.slice(0, 500) : null} />;
}

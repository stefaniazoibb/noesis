import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";

/**
 * Provider abstraction (ARCHITECTURE.md §7). The rest of the AI layer only
 * talks to these two functions, so swapping providers is a one-file change.
 * Models are env-overridable; defaults: claude-opus-5 for synthesis,
 * claude-haiku-4-5 for fast intent parsing.
 */

const SYNTH_MODEL = process.env.NOESIS_SYNTH_MODEL ?? "claude-opus-5";
const INTENT_MODEL = process.env.NOESIS_INTENT_MODEL ?? "claude-haiku-4-5";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  // Credentials resolve from ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN / an
  // `ant auth login` profile; auth failures surface per-request as typed errors.
  if (!client) client = new Anthropic();
  return client;
}

export class ProviderRefusalError extends Error {
  constructor() {
    super("The model declined this request (safety classifier refusal).");
  }
}

/** Free-text completion with hard-required citations handled by the caller. */
export async function complete(opts: {
  system: string;
  user: string;
  maxTokens: number;
}): Promise<string> {
  const response = await getClient().beta.messages.create({
    model: SYNTH_MODEL,
    max_tokens: opts.maxTokens,
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
    // Server-side fallback: a safety-classifier refusal re-runs on
    // Anthropic's recommended fallback model instead of failing the request.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  });
  if (response.stop_reason === "refusal") throw new ProviderRefusalError();
  return response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
}

/** Schema-constrained structured output (intent parsing). */
export async function structured<T extends z.ZodType>(opts: {
  schema: T;
  system: string;
  user: string;
  maxTokens: number;
}): Promise<z.infer<T> | null> {
  const response = await getClient().messages.parse({
    model: INTENT_MODEL,
    max_tokens: opts.maxTokens,
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
    output_config: { format: zodOutputFormat(opts.schema) },
  });
  if (response.stop_reason === "refusal") throw new ProviderRefusalError();
  return response.parsed_output ?? null;
}

export function isAuthError(err: unknown): boolean {
  if (err instanceof Anthropic.AuthenticationError) return true;
  // no credentials at all: the SDK throws a plain Error at construction
  return (
    err instanceof Error && /ANTHROPIC_API_KEY|apiKey/i.test(err.message)
  );
}

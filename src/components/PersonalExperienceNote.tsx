/**
 * Human-centered note shown wherever disorders are discussed. Distinct from
 * the technical non-diagnostic disclaimer: this one addresses the reader as a
 * person, not as a data consumer.
 */
export function PersonalExperienceNote({
  compact = false,
}: {
  compact?: boolean;
}) {
  if (compact) {
    return (
      <p className="mt-6 rounded-lg border border-zinc-800/70 bg-zinc-900/30 px-4 py-3 text-xs leading-relaxed text-zinc-400">
        Research findings describe averages across many people, and they often
        cannot capture any one person&rsquo;s experience. If these conditions
        touch your life, please talk with a licensed psychologist,
        psychiatrist, or neurologist you trust.
      </p>
    );
  }
  return (
    <div className="mt-6 rounded-lg border border-zinc-800/70 bg-zinc-900/30 px-4 py-3">
      <p className="text-xs leading-relaxed text-zinc-400">
        A note on lived experience: the studies indexed here describe
        group-level averages across many people, and statistics of this kind
        often cannot describe any individual&rsquo;s experience of a
        condition. If you or someone close to you is affected by any of the
        disorders on this page, your experience matters beyond what research
        summaries can capture. Please discuss it with a licensed
        psychologist, psychiatrist, or neurologist you trust.
      </p>
    </div>
  );
}

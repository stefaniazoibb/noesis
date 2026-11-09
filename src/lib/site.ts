/**
 * Public repository link (the repository is public since 2026-11-09).
 * Override with NEXT_PUBLIC_GITHUB_URL; set it to an empty string to hide
 * the link (e.g. for a private fork).
 */
const env = process.env.NEXT_PUBLIC_GITHUB_URL;
export const GITHUB_URL: string | null =
  env === undefined ? "https://github.com/stefaniazoibb/noesis" : env.trim() || null;

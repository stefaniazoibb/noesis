/**
 * Public repository link. The repository is private, so the link is shown
 * only when NEXT_PUBLIC_GITHUB_URL is set (e.g. in the Vercel project env)
 * after it is made public — a private link would 404 for every visitor.
 */
export const GITHUB_URL: string | null = process.env.NEXT_PUBLIC_GITHUB_URL?.trim() || null;

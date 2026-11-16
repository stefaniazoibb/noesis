/**
 * Public repository link (the repository is public since 2026-11-09).
 * Override with NEXT_PUBLIC_GITHUB_URL; set it to an empty string to hide
 * the link (e.g. for a private fork).
 */
const env = process.env.NEXT_PUBLIC_GITHUB_URL;
/** Who publishes the site, and how to reach them (shown in the footer notes and on /about). */
export const AUTHOR = "Stefania Zoi";
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "stefania.zoi18@gmail.com";
/** Host of the public deployment (Vercel). Address from vercel.com/legal/privacy-policy, checked 2026-11-16. */
export const HOST = "Vercel Inc., 440 N Barranca Avenue #4133, Covina, CA 91723, United States";

export const GITHUB_URL: string | null =
  env === undefined ? "https://github.com/stefaniazoibb/noesis" : env.trim() || null;

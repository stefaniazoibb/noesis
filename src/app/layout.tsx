import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { TopNav, DisclaimerBar } from "@/components/AppShell";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500", "600"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "NOĒSIS · Understanding the brain through evidence",
  description:
    "An interactive intelligence platform connecting brain anatomy, scientific evidence and artificial intelligence, a real 3D atlas, a DOI/PMID-verified corpus, and a citation-grounded research assistant.",
};

export const viewport: Viewport = {
  themeColor: "#f7f7f4",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${plexSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <TopNav />
        <div id="main" className="flex min-h-0 flex-1 flex-col">
          {children}
        </div>
        <DisclaimerBar />
      </body>
    </html>
  );
}

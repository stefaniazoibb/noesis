import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { TopNav, DisclaimerBar } from "@/components/AppShell";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const serif = Instrument_Serif({
  variable: "--font-serif-display",
  subsets: ["latin", "latin-ext"],
  weight: "400",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "NOĒSIS — Understanding the brain through evidence",
  description:
    "An interactive intelligence platform connecting brain anatomy, scientific evidence and artificial intelligence — a real 3D atlas, a DOI/PMID-verified corpus, and a citation-grounded research assistant.",
};

export const viewport: Viewport = {
  themeColor: "#0b0e12",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${serif.variable} h-full antialiased`}
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

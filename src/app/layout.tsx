import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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

export const metadata: Metadata = {
  title: "NOĒSIS — An AI atlas of brain, behavior & evidence",
  description:
    "Explore how brain regions, disorders, experimental modalities and scientific studies connect — on a real 3D human brain atlas.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex h-full flex-col">
        <TopNav />
        {children}
        <DisclaimerBar />
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "KVFlow",
  description:
    "A deterministic simulator of multi-turn agents competing for KV-cache memory. Compares LRU with a causal trajectory-aware retention heuristic. Simulated, not measured on GPUs.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full overflow-hidden antialiased`}
    >
      <body className="graph-paper h-full overflow-hidden font-sans text-ink">
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";
import Navigation from "@/components/Navigation";

export const metadata: Metadata = {
  title: "GTO Poker Solver - GPU Accelerated",
  description: "A professional-grade Game Theory Optimal poker solver with WebGPU acceleration. Built on CFR algorithm principles from Applications of No-Limit Hold'em by Matthew Janda.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-gray-950 text-gray-100 min-h-screen font-sans">
        <Navigation />
        <main className="max-w-7xl mx-auto px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";
import Navigation from "@/components/Navigation";

export const metadata: Metadata = {
  title: "Poker GTO Solver",
  description: "Game Theory Optimal poker solver with GPU acceleration",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </head>
      <body className="antialiased bg-[var(--background)] text-[var(--foreground)] min-h-screen font-sans">
        <Navigation />
        <main className="max-w-lg mx-auto px-3 pt-4 pb-24 md:pb-6 md:pt-4 md:max-w-6xl">
          {children}
        </main>
      </body>
    </html>
  );
}

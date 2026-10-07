import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "@/providers/Providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SuperCall — Realtime Video & Collaboration Platform",
  description: "Next-generation HD video meetings, screen sharing, live whiteboard, and AI-powered collaboration tools.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning className="min-h-screen bg-[#080c14] text-slate-100 font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { IBM_Plex_Sans, Space_Grotesk } from "next/font/google";
import type { ReactNode } from "react";

import "./globals.css";

const bodyFont = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
});

const displayFont = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "AI Loan Advisor Chatbot",
  description: "Grounded fintech chatbot prototype with deterministic tools and an external LLM wrapper.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${bodyFont.variable} ${displayFont.variable}`}
        style={{
          fontFamily: "var(--font-body), sans-serif",
        }}
      >
        <div style={{ fontFamily: "var(--font-display), sans-serif", position: "absolute", opacity: 0, pointerEvents: "none" }}>
          preload
        </div>
        {children}
      </body>
    </html>
  );
}

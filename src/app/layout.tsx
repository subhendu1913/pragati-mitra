import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, Noto_Sans_Oriya } from "next/font/google";
import "./globals.css";
import { LangProvider } from "@/lib/i18n";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const odia = Noto_Sans_Oriya({ subsets: ["oriya"], variable: "--font-odiya", display: "swap" });

export const metadata: Metadata = {
  title: "PRAGATI MITRA — Your Smart Companion for MSME Growth",
  description:
    "Pragati Mitra helps small manufacturers digitise everyday operations, identify recurring problems and improve productivity through simple tools and intelligent insights.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${odia.variable}`}>
      <body className="font-sans">
        <LangProvider>{children}</LangProvider>
      </body>
    </html>
  );
}

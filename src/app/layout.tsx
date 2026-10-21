import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import Shell from "@/components/shell";
import { Toaster } from "@/components/client";


const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sgrotesk",
  weight: ["400", "500", "600", "700"],
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-plexmono",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Copiloto · Gestión de Camas — Red O'Higgins",
  description: "Auxiliar, paralelo y autorizado: lee, entiende, propone y registra.",
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-CL" className={`${display.variable} ${mono.variable}`}>
      <body className="gridbg min-h-screen antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}

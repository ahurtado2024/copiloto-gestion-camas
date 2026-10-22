import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import Shell from "@/components/shell";
import { Toaster } from "@/components/client";
import { auth } from "@/auth";

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sgrotesk",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Copiloto · Gestión de Camas — Red O'Higgins",
  description: "Auxiliar, paralelo y autorizado.",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: ReactNode }) {
  // 1. Obtenemos la sesión en el servidor
  const session = await auth();

  return (
    <html lang="es-CL" className={`${display.variable}`}>
      <body className="bg-[#F9FAFB] min-h-screen antialiased">
        {/* 
           2. Lógica Inteligente:
           Si el usuario está logueado, lo envolvemos en el Shell (Sidebar + Header).
           Si NO está logueado, le entregamos la página pelada (Login).
        */}
        {session ? (
          <Shell>{children}</Shell>
        ) : (
          <main>{children}</main>
        )}
        
        <Toaster />
      </body>
    </html>
  );
}

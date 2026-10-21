"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="flex w-full cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-[10.5px] text-[var(--color-text-muted)] transition hover:bg-red-50 hover:text-red-600"
    >
      <LogOut size={11} /> Cerrar sesión
    </button>
  );
}
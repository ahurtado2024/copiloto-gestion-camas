"use client";

import { useState } from "react";
import { RefreshCw, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/client";

export function SheetSyncButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const sync = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/sheets/sync", { method: "POST" });
      const data = (await res.json()) as { ok: boolean; message: string; tone: "ok" | "warn" | "error" };
      toast(data.message, data.tone);
      router.refresh();
    } catch {
      toast("Error al sincronizar con la hoja del turno. Reintenta.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      disabled={busy}
      onClick={sync}
      className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-[12px] font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
    >
      {busy ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
      Sincronizar con la hoja
    </button>
  );
}

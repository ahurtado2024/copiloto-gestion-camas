"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Check, X, Loader2, RefreshCw, Send, Clock3 } from "lucide-react";

/* ------------------------- Navegación ------------------------- */

type NavItem = { href: string; label: string; icon: ReactNode; badge?: number; tone?: "amber" | "violet" | "rose" };

export function Nav({ groups, mobile = false }: { groups: { label: string; items: NavItem[] }[]; mobile?: boolean }) {
  const pathname = usePathname();
  if (mobile) {
    return (
      <nav className="flex gap-1 overflow-x-auto px-4 pb-2.5">
        {groups.flatMap((g) => g.items).map((it) => (
          <NavLink key={it.href} item={it} active={pathname === it.href} mobile />
        ))}
      </nav>
    );
  }
  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3">
      {groups.map((g) => (
        <div key={g.label}>
          <div className="px-2.5 pb-1.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">{g.label}</div>
          <div className="space-y-0.5">
            {g.items.map((it) => (
              <NavLink key={it.href} item={it} active={pathname === it.href} />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

function NavLink({ item, active, mobile = false }: { item: NavItem; active: boolean; mobile?: boolean }) {
  const tones: Record<string, string> = {
    amber: "bg-amber-100 text-amber-700",
    violet: "bg-violet-100 text-violet-700",
    rose: "bg-red-100 text-red-700",
  };
  return (
    <Link
      href={item.href}
      className={
        mobile
          ? `flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition ${
              active ? "bg-[var(--color-sidebar-active)] text-[var(--color-text)]" : "text-[var(--color-text-secondary)]"
            }`
          : `group flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] transition ${
              active
                ? "bg-[var(--color-sidebar-active)] font-semibold text-[var(--color-text)]"
                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-sidebar-hover)] hover:text-[var(--color-text)]"
            }`
      }
    >
      <span className={active ? "text-emerald-600" : "text-[var(--color-text-muted)] group-hover:text-[var(--color-text-secondary)]"}>{item.icon}</span>
      <span>{item.label}</span>
      {!!item.badge && item.badge > 0 && (
        <span className={`mono ml-auto rounded-full px-1.5 py-0.5 text-[9px] font-bold ${tones[item.tone ?? "amber"]}`}>
          {item.badge}
        </span>
      )}
    </Link>
  );
}

/* ------------------------- Reloj vivo ------------------------- */

export function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="mono hidden items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-white px-3 py-1.5 text-[11px] text-[var(--color-text-secondary)] md:flex">
      <Clock3 size={12} className="text-[var(--color-text-muted)]" />
      {now ? (
        <>
          <span className="tabular-nums text-[var(--color-text)]">{now.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}</span>
          <span className="hidden text-[var(--color-text-muted)] lg:inline">
            {now.toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short" }).replace(/\./g, "")}
          </span>
        </>
      ) : (
        <span className="text-[var(--color-text-muted)]">--:--:--</span>
      )}
    </div>
  );
}

/* ------------------------- Refresco suave ------------------------- */

export function Refresher({ seconds = 20 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(t);
  }, [seconds, router]);
  return null;
}

/* ------------------------- Toasts ------------------------- */

type Toast = { id: number; message: string; tone: "ok" | "warn" | "error" };

export function toast(message: string, tone: Toast["tone"] = "ok") {
  window.dispatchEvent(new CustomEvent("ops-toast", { detail: { message, tone } }));
}

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    const onToast = (e: Event) => {
      const d = (e as CustomEvent).detail as { message: string; tone: Toast["tone"] };
      const id = Date.now() + Math.random();
      setItems((prev) => [...prev.slice(-3), { id, ...d }]);
      setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 7000);
    };
    window.addEventListener("ops-toast", onToast);
    return () => window.removeEventListener("ops-toast", onToast);
  }, []);
  const tones = {
    ok: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warn: "border-amber-200 bg-amber-50 text-amber-800",
    error: "border-red-200 bg-red-50 text-red-800",
  };
  const dot = { ok: "bg-emerald-500", warn: "bg-amber-500", error: "bg-red-500" };
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex w-[min(92vw,430px)] flex-col gap-2">
      {items.map((t) => (
        <div key={t.id} className={`toast-in pointer-events-auto rounded-xl border px-4 py-3 text-[12.5px] leading-snug shadow-lg ${tones[t.tone]}`}>
          <div className="flex items-start gap-2.5">
            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dot[t.tone]}`} />
            <span>{t.message}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------- Botón de operación ------------------------- */

type OpBody = { op: string; params?: Record<string, unknown> };

async function runOp(body: OpBody): Promise<{ ok: boolean; message: string; tone: "ok" | "warn" | "error" }> {
  try {
    const res = await fetch("/api/ops", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return (await res.json()) as { ok: boolean; message: string; tone: "ok" | "warn" | "error" };
  } catch {
    return { ok: false, message: "No se pudo contactar al sistema. La hoja del turno sigue operativa (R11).", tone: "error" };
  }
}

const VARIANTS: Record<string, string> = {
  primary: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm",
  violet: "bg-violet-50 text-violet-700 hover:bg-violet-100",
  ghost: "bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-gray-100 border border-[var(--color-border)]",
  danger: "bg-red-50 text-red-700 hover:bg-red-100",
  warn: "bg-amber-50 text-amber-700 hover:bg-amber-100",
  sky: "bg-sky-50 text-sky-700 hover:bg-sky-100",
};

export function ActionButton({
  op,
  params = {},
  label,
  icon,
  variant = "ghost",
  confirmText,
  size = "md",
}: {
  op: string;
  params?: Record<string, unknown>;
  label: string;
  icon?: ReactNode;
  variant?: keyof typeof VARIANTS;
  confirmText?: string;
  size?: "sm" | "md";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      disabled={busy}
      onClick={async () => {
        if (confirmText && !window.confirm(confirmText)) return;
        setBusy(true);
        const r = await runOp({ op, params });
        toast(r.message, r.tone);
        setBusy(false);
        router.refresh();
      }}
      className={`inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg font-medium transition disabled:opacity-50 ${
        size === "sm" ? "px-2.5 py-1.5 text-[11px]" : "px-3.5 py-2 text-[12px]"
      } ${VARIANTS[variant]}`}
    >
      {busy ? <Loader2 size={size === "sm" ? 12 : 13} className="animate-spin" /> : icon}
      {label}
    </button>
  );
}

export function ApproveRejectButtons({ approvalId, approveLabel = "Confirmar", rejectLabel = "Aún no" }: { approvalId: number; approveLabel?: string; rejectLabel?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"a" | "r" | null>(null);
  const act = async (decision: "approved" | "rejected") => {
    let reason: string | undefined;
    if (decision === "rejected") {
      reason = window.prompt("Motivo (queda registrado en la caja negra):") ?? undefined;
      if (reason === undefined) return;
    }
    setBusy(decision === "approved" ? "a" : "r");
    const r = await runOp({ op: "decide_approval", params: { approvalId, decision, reason } });
    toast(r.message, r.tone);
    setBusy(null);
    router.refresh();
  };
  return (
    <div className="flex flex-wrap gap-2">
      <button onClick={() => act("approved")} disabled={busy !== null} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-[12px] font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50">
        {busy === "a" ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} {approveLabel}
      </button>
      <button onClick={() => act("rejected")} disabled={busy !== null} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-white px-3.5 py-2 text-[12px] font-medium text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface)] disabled:opacity-50">
        {busy === "r" ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />} {rejectLabel}
      </button>
    </div>
  );
}

export function ResolveConflictWidget({ conflictId, sourceA, valueA, sourceB, valueB, labelA, labelB }: { conflictId: number; sourceA: string; valueA: string; sourceB: string; valueB: string; labelA: string; labelB: string }) {
  const router = useRouter();
  const [winner, setWinner] = useState<"A" | "B">("A");
  const [busy, setBusy] = useState(false);
  const resolve = async () => {
    const criterion = window.prompt("Criterio de resolución (obligatorio — queda guardado para aprender y capacitar):");
    if (!criterion) return;
    setBusy(true);
    const r = await runOp({ op: "resolve_conflict", params: { conflictId, winner, apply: true, criterion } });
    toast(r.message, r.tone);
    setBusy(false);
    router.refresh();
  };
  const Opt = ({ w, source, label }: { w: "A" | "B"; source: string; label: string }) => (
    <button onClick={() => setWinner(w)} className={`flex-1 cursor-pointer rounded-lg border px-3 py-2 text-left transition ${winner === w ? "border-emerald-400 bg-emerald-50" : "border-[var(--color-border)] bg-white hover:bg-[var(--color-surface)]"}`}>
      <div className="mono text-[9px] uppercase tracking-wider text-[var(--color-text-muted)]">{source}</div>
      <div className="mt-0.5 text-[12px] font-semibold text-[var(--color-text)]">{label}</div>
    </button>
  );
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Opt w="A" source={sourceA} label={labelA} />
        <Opt w="B" source={sourceB} label={labelB} />
      </div>
      <button onClick={resolve} disabled={busy} className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-[12px] font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50">
        {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Resolver con este criterio
      </button>
    </div>
  );
}

/** Exporta datos a archivo local */
export function ExportButton({ filename, data, label, mime = "application/json" }: { filename: string; data: string; label: string; mime?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={() => {
        const blob = new Blob([data], { type: `${mime};charset=utf-8` });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        setDone(true);
        toast(`Exportado: ${filename}`, "ok");
        setTimeout(() => setDone(false), 2500);
      }}
      className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-emerald-700"
    >
      {done ? <Check size={12} /> : <RefreshCw size={12} className="hidden" />}
      {label}
    </button>
  );
}

/** Acción que exige un motivo escrito */
export function ReasonButton({
  op,
  params,
  label,
  promptText,
  reasonKey = "reason",
  icon,
  variant = "ghost",
  size = "md",
}: {
  op: string;
  params: Record<string, unknown>;
  label: string;
  promptText: string;
  reasonKey?: string;
  icon?: ReactNode;
  variant?: keyof typeof VARIANTS;
  size?: "sm" | "md";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      disabled={busy}
      onClick={async () => {
        const reason = window.prompt(promptText);
        if (!reason) return;
        setBusy(true);
        const r = await runOp({ op, params: { ...params, [reasonKey]: reason } });
        toast(r.message, r.tone);
        setBusy(false);
        router.refresh();
      }}
      className={`inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg font-medium transition disabled:opacity-50 ${
        size === "sm" ? "px-2.5 py-1.5 text-[11px]" : "px-3.5 py-2 text-[12px]"
      } ${VARIANTS[variant]}`}
    >
      {busy ? <Loader2 size={size === "sm" ? 12 : 13} className="animate-spin" /> : icon}
      {label}
    </button>
  );
}

/** Editor numérico de umbral operativo */
export function SettingNum({ skey, value, label, hint, unit }: { skey: string; value: number; label: string; hint: string; unit?: string }) {
  const router = useRouter();
  const [val, setVal] = useState(String(value));
  const [busy, setBusy] = useState(false);
  const dirty = val !== String(value);
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--color-border)] bg-white px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-semibold text-[var(--color-text)]">{label}</div>
        <div className="mt-0.5 text-[11px] leading-snug text-[var(--color-text-muted)]">{hint}</div>
      </div>
      <div className="flex items-center gap-2">
        <input type="number" value={val} onChange={(e) => setVal(e.target.value)} className="mono w-20 text-right" />
        {unit && <span className="mono text-[11px] text-[var(--color-text-muted)]">{unit}</span>}
        <button disabled={!dirty || busy} onClick={async () => { setBusy(true); const r = await runOp({ op: "save_setting", params: { key: skey, value: val } }); toast(r.message, r.tone); setBusy(false); router.refresh(); }}
          className="cursor-pointer rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-40">
          {busy ? <Loader2 size={12} className="animate-spin" /> : "Guardar"}
        </button>
      </div>
    </div>
  );
}

export function SettingChoice({ skey, value, label, hint, options }: { skey: string; value: string; label: string; hint: string; options: { value: string; label: string }[] }) {
  const router = useRouter();
  const [val, setVal] = useState(value);
  const [busy, setBusy] = useState(false);
  const dirty = val !== value;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--color-border)] bg-white px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-semibold text-[var(--color-text)]">{label}</div>
        <div className="mt-0.5 text-[11px] leading-snug text-[var(--color-text-muted)]">{hint}</div>
      </div>
      <div className="flex items-center gap-2">
        <select value={val} onChange={(e) => setVal(e.target.value)}>{options.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}</select>
        <button disabled={!dirty || busy} onClick={async () => { setBusy(true); const r = await runOp({ op: "save_setting", params: { key: skey, value: val } }); toast(r.message, r.tone); setBusy(false); router.refresh(); }}
          className="cursor-pointer rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-40">
          {busy ? <Loader2 size={12} className="animate-spin" /> : "Guardar"}
        </button>
      </div>
    </div>
  );
}

export function SettingText({ skey, value, label, hint }: { skey: string; value: string; label: string; hint: string }) {
  const router = useRouter();
  const [val, setVal] = useState(value);
  const [busy, setBusy] = useState(false);
  const dirty = val !== value;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--color-border)] bg-white px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-semibold text-[var(--color-text)]">{label}</div>
        <div className="mt-0.5 text-[11px] leading-snug text-[var(--color-text-muted)]">{hint}</div>
      </div>
      <div className="flex items-center gap-2">
        <input type="text" value={val} onChange={(e) => setVal(e.target.value)} className="w-32" />
        <button disabled={!dirty || busy} onClick={async () => { setBusy(true); const r = await runOp({ op: "save_setting", params: { key: skey, value: val } }); toast(r.message, r.tone); setBusy(false); router.refresh(); }}
          className="cursor-pointer rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-40">
          {busy ? <Loader2 size={12} className="animate-spin" /> : "Guardar"}
        </button>
      </div>
    </div>
  );
}

export function ResetDemoButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button disabled={busy} onClick={async () => { if (!window.confirm("Se reiniciará toda la demo. ¿Continuar?")) return; setBusy(true); const r = await runOp({ op: "reset_demo" }); toast(r.message, r.tone); setBusy(false); router.refresh(); }}
      className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-red-50 px-3.5 py-2 text-[12px] font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50">
      {busy ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Reiniciar demo
    </button>
  );
}

export function SimulateInboundButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button disabled={busy} onClick={async () => { setBusy(true); const r = await runOp({ op: "simulate_inbound" }); toast(r.message, r.tone); setBusy(false); router.refresh(); }}
      className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-sky-50 px-3.5 py-2 text-[12px] font-semibold text-sky-700 transition hover:bg-sky-100 disabled:opacity-50">
      {busy ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Simular correo entrante
    </button>
  );
}

export function SimulateRetryButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button disabled={busy} onClick={async () => { setBusy(true); const r = await runOp({ op: "simulate_retry" }); toast(r.message, r.tone); setBusy(false); router.refresh(); }}
      className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-white px-3.5 py-2 text-[12px] font-medium text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface)] disabled:opacity-50">
      {busy ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Simular reintento
    </button>
  );
}

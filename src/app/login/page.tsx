"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { BedDouble, Loader2, LogIn } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setBusy(false);

    if (result?.error) {
      setError("Credenciales incorrectas. Verifica tu correo y contraseña.");
    } else {
      router.push("/");
      router.refresh();
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-surface)]">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600">
            <BedDouble size={28} className="text-white" />
          </div>
          <h1 className="text-[22px] font-bold text-[var(--color-text)]">
            Copiloto de Camas
          </h1>
          <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
            Red O&apos;Higgins · Gestión de Camas
          </p>
        </div>

        <form onSubmit={handleSubmit} className="panel p-6">
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[12px] font-semibold text-[var(--color-text-secondary)]">
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu.correo@hospital.cl"
                required
                className="w-full"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[12px] font-semibold text-[var(--color-text-secondary)]">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 text-[13px] font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <LogIn size={16} />
              )}
              Iniciar sesión
            </button>
          </div>
        </form>

        <p className="mt-4 text-center text-[11px] text-[var(--color-text-muted)]">
          Auxiliar · Paralelo · Autorizado
        </p>
      </div>
    </div>
  );
}
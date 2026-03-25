"use client";

import { useState, useCallback, useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Lock, Mail, Sparkles } from "lucide-react";

function subscribeCursorPreference(onStoreChange: () => void) {
  const mqReduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const mqFine = window.matchMedia("(pointer: fine)");
  const handler = () => onStoreChange();
  mqReduce.addEventListener("change", handler);
  mqFine.addEventListener("change", handler);
  return () => {
    mqReduce.removeEventListener("change", handler);
    mqFine.removeEventListener("change", handler);
  };
}

function getCursorPreferenceSnapshot() {
  return (
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
    window.matchMedia("(pointer: fine)").matches
  );
}

function getCursorPreferenceServerSnapshot() {
  return false;
}

export function LoginForm({ initialError }: { initialError?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(
    initialError ? "Gagal autentikasi. Coba lagi." : null,
  );

  const [cursor, setCursor] = useState({ x: 0, y: 0, show: false });
  const useCustomCursor = useSyncExternalStore(
    subscribeCursorPreference,
    getCursorPreferenceSnapshot,
    getCursorPreferenceServerSnapshot,
  );

  const supabase = createClient();

  const onRootMouseMove = useCallback((e: React.MouseEvent) => {
    if (!useCustomCursor) return;
    setCursor((c) => ({ ...c, x: e.clientX, y: e.clientY }));
  }, [useCustomCursor]);

  const onRootEnter = useCallback(() => {
    if (useCustomCursor) setCursor((c) => ({ ...c, show: true }));
  }, [useCustomCursor]);

  const onRootLeave = useCallback(() => {
    setCursor((c) => ({ ...c, show: false }));
  }, []);

  const onCardMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    el.style.setProperty("--spot-x", `${x}%`);
    el.style.setProperty("--spot-y", `${y}%`);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      setLoading(false);
      if (error) {
        setMessage(error.message);
        return;
      }
      router.push("/");
      router.refresh();
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    setLoading(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    if (data.session) {
      router.push("/");
      router.refresh();
      return;
    }
    setMessage(
      "Akun dibuat. Silakan tab Login dan masuk dengan email & password Anda.",
    );
  }

  return (
    <div
      className={cn(
        "login-page-root relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-12",
        useCustomCursor && "cursor-none",
      )}
      onMouseMove={onRootMouseMove}
      onMouseEnter={onRootEnter}
      onMouseLeave={onRootLeave}
    >
      {useCustomCursor ? (
        <>
          <div
            className="login-cursor-dot"
            style={{
              opacity: cursor.show ? 1 : 0,
              transform: `translate(${cursor.x}px, ${cursor.y}px)`,
            }}
            aria-hidden
          />
          <div
            className="login-cursor-ring"
            style={{
              opacity: cursor.show ? 0.9 : 0,
              transform: `translate(${cursor.x}px, ${cursor.y}px) scale(${cursor.show ? 1 : 0.85})`,
            }}
            aria-hidden
          />
        </>
      ) : null}

      <div className="login-bg-mesh" aria-hidden />
      <div className="login-bg-grid" aria-hidden />
      <div className="login-bg-noise" aria-hidden />
      <div className="login-orb login-orb--a" aria-hidden />
      <div className="login-orb login-orb--b" aria-hidden />
      <div className="login-orb login-orb--c" aria-hidden />

      <div
        onMouseMove={onCardMove}
        className={cn(
          "glass-panel relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-neon-cyan/25 p-8 shadow-2xl",
          "transition-shadow duration-500 hover:shadow-[0_0_60px_rgba(50,230,255,0.12),0_24px_64px_rgba(0,0,0,0.45)]",
        )}
        style={
          {
            "--spot-x": "50%",
            "--spot-y": "35%",
          } as React.CSSProperties
        }
      >
        <div className="login-card-spotlight" aria-hidden />

        <div className="relative flex flex-col items-center text-center">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-neon-cyan/25 bg-gradient-to-br from-neon-cyan/15 to-neon-purple/15 shadow-[0_0_24px_rgba(50,230,255,0.2)]">
            <Sparkles className="h-5 w-5 text-neon-cyan" strokeWidth={1.75} />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-[1.65rem]">
            TNC Ternak
          </h1>
          <p className="mt-1 max-w-[280px] text-sm leading-relaxed text-muted">
            Masuk untuk melanjutkan ke dashboard — kelola target & submission
            dengan satu tempat.
          </p>
          <div
            className="mt-4 h-px w-24 bg-gradient-to-r from-transparent via-neon-cyan/50 to-transparent"
            aria-hidden
          />
        </div>

        <div className="relative mt-8">
          <div
            className="relative flex rounded-2xl border border-white/[0.08] bg-night/40 p-1.5 shadow-inner"
            role="tablist"
            aria-label="Mode autentikasi"
          >
            <div
              className={cn(
                "pointer-events-none absolute inset-y-1.5 left-1.5 w-[calc(50%-6px)] rounded-xl",
                "bg-gradient-to-r from-neon-cyan/25 via-neon-cyan/15 to-neon-purple/20",
                "shadow-[0_0_20px_rgba(50,230,255,0.15)] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                mode === "signup" && "translate-x-full",
              )}
              aria-hidden
            />
            <button
              type="button"
              role="tab"
              aria-selected={mode === "login"}
              onClick={() => {
                setMode("login");
                setMessage(null);
              }}
              className={cn(
                "relative z-10 flex-1 cursor-pointer rounded-xl py-2.5 text-sm font-semibold transition-colors duration-300",
                mode === "login"
                  ? "text-foreground"
                  : "text-muted hover:text-foreground/90",
              )}
            >
              Login
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signup"}
              onClick={() => {
                setMode("signup");
                setMessage(null);
              }}
              className={cn(
                "relative z-10 flex-1 cursor-pointer rounded-xl py-2.5 text-sm font-semibold transition-colors duration-300",
                mode === "signup"
                  ? "text-foreground"
                  : "text-muted hover:text-foreground/90",
              )}
            >
              Daftar
            </button>
          </div>
        </div>

        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          <div
            key={mode}
            className="login-pane-in space-y-5"
          >
            <div className="group">
              <label className="mb-1.5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted">
                <Mail className="h-3.5 w-3.5 text-neon-cyan/70" aria-hidden />
                Email
              </label>
              <div className="relative">
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={cn(
                    "h-12 w-full cursor-text rounded-xl border border-white/10 bg-white/[0.04] py-3 pr-4 pl-11 text-sm text-foreground outline-none transition",
                    "placeholder:text-muted/50",
                    "focus:border-neon-cyan/45 focus:bg-white/[0.06] focus:shadow-[0_0_0_3px_rgba(50,230,255,0.12)]",
                  )}
                />
                <Mail
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted/50 transition group-focus-within:text-neon-cyan/80"
                  aria-hidden
                />
              </div>
            </div>
            <div className="group">
              <label className="mb-1.5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted">
                <Lock className="h-3.5 w-3.5 text-neon-purple/80" aria-hidden />
                Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={cn(
                    "h-12 w-full cursor-text rounded-xl border border-white/10 bg-white/[0.04] py-3 pr-4 pl-11 text-sm text-foreground outline-none transition",
                    "placeholder:text-muted/50",
                    "focus:border-neon-purple/40 focus:bg-white/[0.06] focus:shadow-[0_0_0_3px_rgba(168,85,247,0.12)]",
                  )}
                />
                <Lock
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted/50 transition group-focus-within:text-neon-purple/80"
                  aria-hidden
                />
              </div>
            </div>
          </div>

          {message ? (
            <p
              role="alert"
              className="login-pane-in rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-xs leading-relaxed text-amber-100"
            >
              {message}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className={cn(
              "group/btn btn-press relative h-12 w-full overflow-hidden rounded-xl text-sm font-bold text-night",
              "bg-gradient-to-r from-neon-cyan via-cyan-300 to-neon-purple",
              "shadow-[0_0_32px_rgba(50,230,255,0.38)]",
              "cursor-pointer transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            <span className="relative z-10">
              {loading
                ? "Memproses…"
                : mode === "login"
                  ? "Masuk"
                  : "Buat akun"}
            </span>
            <span
              className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 ease-out group-hover/btn:translate-x-full"
              aria-hidden
            />
          </button>
        </form>
      </div>

      <p className="relative z-10 mt-10 max-w-sm text-center text-[11px] text-muted/70">
        Dengan melanjutkan, Anda menyetujui penggunaan sesuai kebijakan privasi
        organisasi.
      </p>
    </div>
  );
}

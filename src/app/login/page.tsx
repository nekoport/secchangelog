"use client";

import { useEffect, useState } from "react";
import { signIn, SessionProvider, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertCircle,
  Eye,
  EyeOff,
  Fingerprint,
  Loader2,
  LockKeyhole,
  ScanLine,
  ShieldCheck,
} from "lucide-react";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Logo } from "@/components/shared/logo";
import { usePublicSystem } from "@/hooks/use-public-system";

const LOGIN_ERROR_MESSAGES: Record<string, string> = {
  CredentialsSignin: "Email / username atau password salah.",
  AccessDenied: "Akses ditolak.",
  Default: "Terjadi kesalahan saat login. Coba lagi.",
};

function friendlyLoginError(code: string): string {
  if (code && LOGIN_ERROR_MESSAGES[code]) return LOGIN_ERROR_MESSAGES[code];
  if (!code || code === "CredentialsSignin") {
    return LOGIN_ERROR_MESSAGES.CredentialsSignin;
  }
  return LOGIN_ERROR_MESSAGES.Default;
}

const SECURITY_SIGNALS = [
  {
    icon: Fingerprint,
    title: "Identity controlled",
    description: "Akses berdasarkan peran dan status akun.",
  },
  {
    icon: ScanLine,
    title: "Every change traceable",
    description: "Riwayat konfigurasi dan bukti tetap terhubung.",
  },
  {
    icon: LockKeyhole,
    title: "Audit ready",
    description: "Aktivitas penting tercatat untuk kebutuhan audit.",
  },
];

function LoginForm() {
  const router = useRouter();
  const { status } = useSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { identity } = usePublicSystem();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/");
    }
  }, [status, router]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        username,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(friendlyLoginError(result.error));
      } else if (result?.ok) {
        router.replace("/");
        router.refresh();
      }
    } catch {
      setError("Terjadi kesalahan. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  const displayName = identity?.name || "SecChangeLog";

  return (
    <main className="app-canvas relative flex min-h-screen items-center justify-center p-3 sm:p-6 lg:p-10">
      <div className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>

      <div className="grid w-full max-w-6xl overflow-hidden rounded-xl border border-border/80 bg-card shadow-[0_28px_90px_rgba(2,12,17,0.16)] lg:min-h-[680px] lg:grid-cols-[1.08fr_0.92fr]">
        <section className="relative overflow-hidden bg-sidebar px-6 py-8 text-sidebar-foreground sm:px-10 sm:py-10 lg:flex lg:flex-col lg:justify-between lg:px-14 lg:py-14">
          <div className="absolute inset-0 bg-grid-pattern opacity-30" />
          <div className="absolute -right-32 -top-32 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute inset-x-0 top-0 h-px signal-line opacity-80" />

          <div className="relative">
            <div className="flex items-center gap-3">
              <Logo size={42} />
              <div>
                <p className="font-display text-base font-semibold tracking-[0.01em]">{displayName}</p>
                <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-sidebar-foreground/45">
                  Security change control
                </p>
              </div>
            </div>

            <div className="mt-14 max-w-lg lg:mt-24">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                Controlled · Traceable · Accountable
              </p>
              <h1 className="font-display mt-4 text-[2.35rem] font-semibold leading-[1.05] tracking-[-0.035em] sm:text-5xl">
                Setiap perubahan.
                <br />
                Tetap terlacak.
              </h1>
              <p className="mt-5 max-w-md text-sm leading-6 text-sidebar-foreground/58">
                Satu ruang kerja untuk mencatat perubahan konfigurasi, mengelola bukti, dan menjaga rantai akuntabilitas keamanan.
              </p>
            </div>
          </div>

          <div className="relative mt-12 hidden grid-cols-3 gap-3 lg:grid">
            {SECURITY_SIGNALS.map((signal) => {
              const Icon = signal.icon;
              return (
                <div key={signal.title} className="border-t border-sidebar-border pt-4">
                  <Icon className="h-4 w-4 text-primary" />
                  <p className="mt-3 font-mono text-[9px] font-semibold uppercase tracking-[0.08em] text-sidebar-foreground/85">
                    {signal.title}
                  </p>
                  <p className="mt-1.5 text-[11px] leading-4 text-sidebar-foreground/42">
                    {signal.description}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="flex items-center px-6 py-10 sm:px-12 lg:px-14">
          <div className="mx-auto w-full max-w-sm">
            <div className="mb-8">
              <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-md border border-primary/20 bg-primary/[0.07] text-primary lg:hidden">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
                Secure access
              </p>
              <h2 className="font-display mt-2 text-2xl font-semibold tracking-[-0.025em]">Masuk ke workspace</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Gunakan akun internal yang telah terdaftar.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div role="alert" className="flex items-start gap-2.5 rounded-md border border-destructive/30 bg-destructive/[0.07] p-3.5 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="username" className="text-xs font-semibold">Username atau email</Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  required
                  disabled={loading}
                  autoComplete="username"
                  autoFocus
                  placeholder="nama pengguna"
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-semibold">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    disabled={loading}
                    autoComplete="current-password"
                    className="h-11 pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    disabled={loading}
                    aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                    aria-pressed={showPassword}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/60 disabled:opacity-50"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" size="lg" disabled={loading || !username || !password} className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Memverifikasi...
                  </>
                ) : (
                  <>
                    <LockKeyhole className="h-4 w-4" />
                    Masuk dengan aman
                  </>
                )}
              </Button>
            </form>

            <div className="mt-8 flex items-center gap-3 border-t border-border/70 pt-5">
              <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
              <p className="text-[11px] leading-4 text-muted-foreground">
                Akses terbatas untuk personel terotorisasi. Aktivitas masuk tercatat pada audit trail.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <SessionProvider>
      <LoginForm />
    </SessionProvider>
  );
}

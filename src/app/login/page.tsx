"use client";

import { useState, useEffect } from "react";
import { signIn, SessionProvider, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ShieldCheck, AlertCircle, Loader2 } from "lucide-react";
import { ThemeToggle } from "@/components/shared/theme-toggle";

const LOGIN_ERROR_MESSAGES: Record<string, string> = {
  CredentialsSignin: "Email / username atau password salah.",
  AccessDenied: "Akses ditolak.",
  Default: "Terjadi kesalahan saat login. Coba lagi.",
};

function friendlyLoginError(code: string): string {
  if (code && LOGIN_ERROR_MESSAGES[code]) return LOGIN_ERROR_MESSAGES[code];
  // Some providers pass through the raw thrown message (e.g. account locked)
  if (!code || code === "CredentialsSignin") {
    return LOGIN_ERROR_MESSAGES.CredentialsSignin;
  }
  return LOGIN_ERROR_MESSAGES.Default;
}

function LoginForm() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [systemName, setSystemName] = useState<string>("");

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/");
    }
  }, [status, router]);

  useEffect(() => {
    fetch("/api/public/system", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.data?.name) setSystemName(json.data.name);
      })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background bg-grid-pattern p-4 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div className="h-16 w-16 rounded-xl bg-primary/10 flex items-center justify-center text-primary glow-primary">
            <ShieldCheck className="h-9 w-9" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight">
              {systemName || "SecChangeLog"}
            </h1>
            <p className="text-sm text-muted-foreground">
              Sistem Pencatatan Perubahan Konfigurasi
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Login</CardTitle>
            <CardDescription>Masuk dengan akun yang terdaftar</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="username">Username / Email</Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="username"
                  autoFocus
                  placeholder="username atau email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="current-password"
                />
              </div>
            </CardContent>
            <CardFooter className="mt-4 flex flex-col gap-3">
              <Button
                type="submit"
                disabled={loading || !username || !password}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Memproses...
                  </>
                ) : (
                  "Masuk"
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>

        <p className="text-xs text-center text-muted-foreground">
          Sistem internal Cyber Security. Akses terbatas.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <SessionProvider>
      <LoginForm />
    </SessionProvider>
  );
}

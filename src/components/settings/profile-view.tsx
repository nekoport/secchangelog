"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import { useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Loader2, KeyRound, Shield, Mail, LogIn, Moon, Sun } from "lucide-react";
import { toast } from "sonner";
import type { ViewType } from "@/components/layout/app-shell";
import { useSystemSettings } from "@/hooks/use-system-settings";

interface ProfileData {
  id: string;
  email: string;
  name: string;
  role: string;
  ldapDn: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  lastLoginIp: string | null;
  createdAt: string;
}

export function ProfileView({
  onNavigate,
}: {
  onNavigate: (v: ViewType) => void;
}) {
  const { data: session, update: updateSession } = useSession();
  const { theme, setTheme } = useTheme();
  const { settings } = useSystemSettings();
  const qc = useQueryClient();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [syncingTheme, setSyncingTheme] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState(() => session?.user?.name || "");
  const [savingName, setSavingName] = useState(false);

  const [profile, setProfile] = useState<ProfileData | null>(null);
  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    setSavingName(true);
    try {
      const res = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: displayName }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Gagal menyimpan nama");
      await updateSession();
      toast.success("Nama berhasil diperbarui");
    } catch (err) { toast.error((err as Error).message); }
    finally { setSavingName(false); }
  }

  // Load profile data (login info) once
  useEffect(() => {
    let cancelled = false;
    async function loadProfile() {
      try {
        // Use audit trail to find recent login
        const res = await fetch("/api/audit-trail?pageSize=1&action=LOGIN_SUCCESS");
        if (!res.ok) return;
        const json = await res.json();
        if (json.data && json.data.length > 0) {
          const lastLogin = json.data[0];
          if (cancelled) return;
          setProfile({
            id: session?.user?.id || "",
            email: session?.user?.email || "",
            name: session?.user?.name || "",
            role: session?.user?.role || "ENGINEER",
            ldapDn: null,
            isActive: true,
            lastLoginAt: lastLogin.timestamp,
            lastLoginIp: lastLogin.ipAddress,
            createdAt: lastLogin.timestamp,
          });
        }
      } catch {
        // ignore
      }
    }
    if (session) loadProfile();
    return () => {
      cancelled = true;
    };
  }, [session]);

  async function handleApplyTheme(next: "light" | "dark") {
    setTheme(next);
    if (session?.user?.role !== "ADMIN") {
      toast.success(`Tema ${next === "dark" ? "gelap" : "terang"} diterapkan`);
      return;
    }
    setSyncingTheme(next);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ "system.defaultTheme": next }),
      });
      if (!res.ok) throw new Error("Gagal");
      toast.success(
        `Tema ${next === "dark" ? "gelap" : "terang"} disimpan sebagai default`
      );
      qc.invalidateQueries({ queryKey: ["system-settings"] });
    } catch {
      toast.error("Tema diubah, tapi gagal menyimpan ke setting");
    } finally {
      setSyncingTheme(null);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("Password baru dan konfirmasi tidak cocok");
      return;
    }
    if (newPassword.length < 10) {
      toast.error("Password minimal 10 karakter");
      return;
    }
    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) {
      toast.error("Password harus mengandung huruf besar, kecil, angka, dan simbol");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || "Gagal");
      }
      toast.success("Password berhasil diubah");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-sm text-muted-foreground">
          Kelola informasi akun dan password Anda
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Profile Card */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Informasi Akun</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center text-center">
              <Avatar className="h-20 w-20 border-2 border-primary/30">
                <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
                  {session?.user?.name?.charAt(0)?.toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <h3 className="mt-3 text-lg font-semibold">
                {session?.user?.name}
              </h3>
              <p className="text-xs text-muted-foreground">
                {session?.user?.email}
              </p>
              <Badge
                variant="outline"
                className="mt-2 text-[10px] uppercase"
              >
                {session?.user?.role}
              </Badge>
            </div>

            <Separator />

            <div className="space-y-3 text-xs">
              <div className="flex items-start gap-2">
                <Mail className="h-3.5 w-3.5 mt-0.5 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-muted-foreground">Email</p>
                  <p className="font-medium truncate">{session?.user?.email}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Shield className="h-3.5 w-3.5 mt-0.5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-muted-foreground">Role</p>
                  <p className="font-medium">{session?.user?.role}</p>
                </div>
              </div>
              {profile?.lastLoginAt && (
                <div className="flex items-start gap-2">
                  <LogIn className="h-3.5 w-3.5 mt-0.5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-muted-foreground">Login Terakhir</p>
                    <p className="font-medium">
                      {new Date(profile.lastLoginAt).toLocaleString("id-ID")}
                    </p>
                    {profile.lastLoginIp && (
                      <p className="text-[10px] font-mono text-muted-foreground">
                        IP: {profile.lastLoginIp}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Nama Tampilan</CardTitle><CardDescription>Nama ini tampil sebagai PIC dan di navigasi.</CardDescription></CardHeader>
          <CardContent><form onSubmit={handleSaveName} className="flex gap-2"><Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={100} aria-label="Nama tampilan" /><Button type="submit" disabled={savingName}>{savingName ? <Loader2 className="h-4 w-4 animate-spin" /> : "Simpan"}</Button></form></CardContent>
        </Card>

        {/* Change Password Card */}
        {session?.user?.isSystemAdmin ? (
          <Card className="lg:col-span-2"><CardHeader><CardTitle className="text-base">Password Sistem Administrator</CardTitle><CardDescription>Perubahan password akun ini hanya dilakukan melalui backend terkontrol.</CardDescription></CardHeader></Card>
        ) : <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              Ubah Password
            </CardTitle>
            <CardDescription>
              Password baru harus memenuhi kebijakan: min 10 karakter, huruf
              besar, huruf kecil, angka, dan simbol
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Password Saat Ini</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">Password Baru</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
                {newPassword && (
                  <div className="text-[10px] space-y-1">
                    <p className={
                      newPassword.length >= 10 ? "text-risk-low" : "text-muted-foreground"
                    }>
                      ✓ Minimal 10 karakter
                    </p>
                    <p className={
                      /[A-Z]/.test(newPassword) ? "text-risk-low" : "text-muted-foreground"
                    }>
                      ✓ Mengandung huruf besar
                    </p>
                    <p className={
                      /[a-z]/.test(newPassword) ? "text-risk-low" : "text-muted-foreground"
                    }>
                      ✓ Mengandung huruf kecil
                    </p>
                    <p className={
                      /[0-9]/.test(newPassword) ? "text-risk-low" : "text-muted-foreground"
                    }>
                      ✓ Mengandung angka
                    </p>
                    <p className={
                      /[^A-Za-z0-9]/.test(newPassword) ? "text-risk-low" : "text-muted-foreground"
                    }>
                      ✓ Mengandung simbol
                    </p>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Konfirmasi Password Baru</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
                {confirmPassword && confirmPassword !== newPassword && (
                  <p className="text-[10px] text-destructive">
                    Password tidak cocok
                  </p>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onNavigate("dashboard")}
                  disabled={submitting}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={
                    submitting ||
                    !currentPassword ||
                    !newPassword ||
                    !confirmPassword ||
                    newPassword !== confirmPassword
                  }
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Mengubah...
                    </>
                  ) : (
                    <>
                      <KeyRound className="h-4 w-4 mr-2" />
                      Ubah Password
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>}
      </div>

      {/* Theme preference — synced to the system default theme */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Moon className="h-4 w-4" />
            Tema Tampilan
          </CardTitle>
          <CardDescription>
            Tema default sistem:{" "}
            <Badge variant="outline" className="text-[10px] capitalize">
              {settings?.["system.defaultTheme"] === "light"
                ? "Terang"
                : "Gelap"}
            </Badge>{" "}
            — pilihan Anda disimpan sebagai default sistem untuk semua user.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Button
              variant={theme === "light" ? "default" : "outline"}
              onClick={() => handleApplyTheme("light")}
              disabled={syncingTheme !== null}
            >
              <Sun className="h-4 w-4 mr-2" />
              Terang
            </Button>
            <Button
              variant={theme === "dark" ? "default" : "outline"}
              onClick={() => handleApplyTheme("dark")}
              disabled={syncingTheme !== null}
            >
              <Moon className="h-4 w-4 mr-2" />
              Gelap
            </Button>
            {syncingTheme && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

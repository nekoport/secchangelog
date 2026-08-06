"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
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
import { Loader2, KeyRound, User as UserIcon, Shield, Mail, Calendar, LogIn } from "lucide-react";
import { toast } from "sonner";
import type { ViewType } from "@/components/layout/app-shell";

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
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [profile, setProfile] = useState<ProfileData | null>(null);

  // Load profile data via API
  useState(() => {
    async function loadProfile() {
      try {
        // Use audit trail to find recent login
        const res = await fetch("/api/audit-trail?pageSize=1&action=LOGIN_SUCCESS");
        if (!res.ok) return;
        const json = await res.json();
        if (json.data && json.data.length > 0) {
          const lastLogin = json.data[0];
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
  });

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

        {/* Change Password Card */}
        <Card className="lg:col-span-2">
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
        </Card>
      </div>
    </div>
  );
}

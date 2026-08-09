"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Loader2, Lock, Unlock, KeyRound, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface User {
  id: string;
  email: string;
  username: string | null;
  name: string;
  role: string;
  ldapDn: string | null;
  isActive: boolean;
  failedAttempts: number;
  lockedUntil: string | null;
  lastLoginAt: string | null;
  lastLoginIp: string | null;
  createdAt: string;
}

const ROLE_BADGE: Record<string, string> = {
  ADMIN: "bg-primary/15 text-primary border-primary/30",
  SUPERVISOR: "bg-info/15 text-info border-info/30",
  ENGINEER: "bg-muted text-muted-foreground",
  AUDITOR: "bg-chart-5/15 text-chart-5 border-chart-5/30",
};

export function UsersView() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state for create
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("ENGINEER");
  const [ldapDn, setLdapDn] = useState("");

  // Form state for reset
  const [newPassword, setNewPassword] = useState("");

  const params = new URLSearchParams({ page: String(page), pageSize: "20" });
  if (search) params.set("search", search);
  if (roleFilter) params.set("role", roleFilter);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", params.toString()],
    queryFn: async () => {
      const res = await fetch(`/api/admin/users?${params}`);
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return {
        items: json.data as User[],
        meta: json.meta as {
          page: number;
          pageSize: number;
          total: number;
          totalPages: number;
        },
      };
    },
  });

  async function handleCreate() {
    if (!email || !name || !password) {
      toast.error("Email, nama, password wajib diisi");
      return;
    }
    if (password.length < 10) {
      toast.error("Password minimal 10 karakter");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, username, password, role, ldapDn }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || "Gagal");
      }
      toast.success("User berhasil dibuat");
      setShowCreate(false);
      setEmail("");
      setUsername("");
      setName("");
      setPassword("");
      setRole("ENGINEER");
      setLdapDn("");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive(user: User) {
    const endpoint = user.isActive ? "deactivate" : "activate";
    try {
      const res = await fetch(`/api/admin/users/${user.id}/${endpoint}`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Gagal");
      toast.success(user.isActive ? "User dinonaktifkan" : "User diaktifkan");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch {
      toast.error("Gagal mengubah status user");
    }
  }

  async function handleResetPassword() {
    if (!resetTarget || !newPassword) return;
    if (newPassword.length < 10) {
      toast.error("Password minimal 10 karakter");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/users/${resetTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });
      if (!res.ok) throw new Error("Gagal");
      toast.success("Password berhasil direset");
      setResetTarget(null);
      setNewPassword("");
    } catch {
      toast.error("Gagal reset password");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleChangeRole(user: User, newRole: string) {
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) throw new Error("Gagal");
      toast.success("Role berhasil diubah");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch {
      toast.error("Gagal mengubah role");
    }
  }

  async function handleDeleteUser() {
    if (!deleteTarget) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/users/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || "Gagal menghapus");
      }
      toast.success("User dihapus (dinonaktifkan)");
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-sm text-muted-foreground">
            Kelola akun pengguna sistem
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Tambah User
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              placeholder="Cari nama atau email..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            <Select
              value={roleFilter || "all"}
              onValueChange={(v) => {
                setRoleFilter(v === "all" ? "" : v);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Filter role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Role</SelectItem>
                <SelectItem value="ADMIN">ADMIN</SelectItem>
                <SelectItem value="SUPERVISOR">SUPERVISOR</SelectItem>
                <SelectItem value="ENGINEER">ENGINEER</SelectItem>
                <SelectItem value="AUDITOR">AUDITOR</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(3)].map((_, i) => (
                    <TableRow key={i}>
                      {[...Array(7)].map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-5 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : !data?.items || data.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12">
                      <p className="text-sm text-muted-foreground">
                        Tidak ada user
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  data.items.map((user) => (
                    <TableRow
                      key={user.id}
                      className={cn(!user.isActive && "opacity-50")}
                    >
                      <TableCell>
                        <div className="text-sm font-medium">{user.name}</div>
                        {user.ldapDn && (
                          <div className="text-[10px] text-muted-foreground">
                            LDAP: {user.ldapDn.slice(0, 30)}...
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {user.username || "-"}
                      </TableCell>
                      <TableCell className="text-xs">{user.email}</TableCell>
                      <TableCell>
                        <Select
                          value={user.role}
                          onValueChange={(v) => handleChangeRole(user, v)}
                        >
                          <SelectTrigger className="h-7 w-32">
                            <Badge
                              variant="outline"
                              className={cn("text-[9px]", ROLE_BADGE[user.role])}
                            >
                              {user.role}
                            </Badge>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ADMIN">ADMIN</SelectItem>
                            <SelectItem value="SUPERVISOR">SUPERVISOR</SelectItem>
                            <SelectItem value="ENGINEER">ENGINEER</SelectItem>
                            <SelectItem value="AUDITOR">AUDITOR</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {user.isActive ? (
                          <Badge
                            variant="outline"
                            className="text-[9px] bg-risk-low/10 text-risk-low border-risk-low/30"
                          >
                            Aktif
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-[9px] text-destructive border-destructive/30"
                          >
                            Nonaktif
                          </Badge>
                        )}
                        {user.lockedUntil && user.lockedUntil > new Date().toISOString() && (
                          <Badge
                            variant="outline"
                            className="ml-1 text-[9px] text-risk-high border-risk-high/30"
                          >
                            LOCKED
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {user.lastLoginAt
                          ? new Date(user.lastLoginAt).toLocaleString("id-ID", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "Belum pernah"}
                        {user.lastLoginIp && (
                          <div className="text-[10px] font-mono">
                            {user.lastLoginIp}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setResetTarget(user)}
                            title="Reset Password"
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleToggleActive(user)}
                            title={user.isActive ? "Nonaktifkan" : "Aktifkan"}
                          >
                            {user.isActive ? (
                              <Lock className="h-3.5 w-3.5" />
                            ) : (
                              <Unlock className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => setDeleteTarget(user)}
                            title="Hapus user"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {data?.meta && data.meta.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <p className="text-xs text-muted-foreground">
                Menampilkan {(data.meta.page - 1) * data.meta.pageSize + 1}-
                {Math.min(data.meta.page * data.meta.pageSize, data.meta.total)}{" "}
                dari {data.meta.total}
              </p>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Sebelumnya
                </Button>
                <span className="px-3 py-1 text-xs">
                  {data.meta.page} / {data.meta.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= data.meta.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Selanjutnya
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create User Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah User Baru</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Nama Lengkap</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nama lengkap"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@company.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Username (opsional)</Label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="contoh: jdoe (otomatis dari email jika kosong)"
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 10 karakter, huruf besar/kecil/angka/simbol"
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">ADMIN</SelectItem>
                  <SelectItem value="SUPERVISOR">SUPERVISOR</SelectItem>
                  <SelectItem value="ENGINEER">ENGINEER</SelectItem>
                  <SelectItem value="AUDITOR">AUDITOR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>LDAP DN (opsional)</Label>
              <Input
                value={ldapDn}
                onChange={(e) => setLdapDn(e.target.value)}
                placeholder="CN=User,OU=Users,DC=company,DC=com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreate(false)}
              disabled={submitting}
            >
              Batal
            </Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog
        open={!!resetTarget}
        onOpenChange={(open) => {
          if (!open) {
            setResetTarget(null);
            setNewPassword("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Reset password untuk{" "}
              <span className="font-semibold">{resetTarget?.name}</span> (
              {resetTarget?.email})
            </p>
            <Label htmlFor="newPassword">Password Baru</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min 10 karakter, huruf besar/kecil/angka/simbol"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setResetTarget(null);
                setNewPassword("");
              }}
              disabled={submitting}
            >
              Batal
            </Button>
            <Button
              onClick={handleResetPassword}
              disabled={submitting || !newPassword}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    {/* Delete User Confirmation Dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus User</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Yakin ingin menghapus user{" "}
              <span className="font-semibold text-foreground">
                {deleteTarget?.name}
              </span>{" "}
              ({deleteTarget?.email})?
            </p>
            <div className="p-3 rounded-md bg-destructive/10 border border-destructive/30 text-sm text-destructive">
              Tindakan ini akan menonaktifkan akun. User tidak akan bisa login,
              namun riwayat aktivitas tetap tersimpan.
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={submitting}
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteUser}
              disabled={submitting}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Ya, Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

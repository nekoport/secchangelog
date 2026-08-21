"use client";

import { useState } from "react";
import type { ChangeEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Database,
  Download,
  Trash2,
  Loader2,
  HardDrive,
  ShieldCheck,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

interface BackupMeta {
  filename: string;
  size: number;
  createdAt: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function BackupView() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: backups, isLoading } = useQuery({
    queryKey: ["admin-backups"],
    queryFn: async () => {
      const res = await fetch("/api/admin/backups");
      if (!res.ok) throw new Error("Gagal memuat backup");
      const json = await res.json();
      return (json.data || []) as BackupMeta[];
    },
  });

  async function handleCreate() {
    if (creating) return;
    if (!confirm("Buat backup database sekarang? Proses ini memakan waktu beberapa detik.")) return;
    setCreating(true);
    try {
      const res = await fetch("/api/admin/backups", { method: "POST" });
      if (!res.ok) throw new Error("Gagal");
      toast.success("Backup database berhasil dibuat");
      qc.invalidateQueries({ queryKey: ["admin-backups"] });
    } catch {
      toast.error("Gagal membuat backup. Periksa ruang disk server.");
    } finally {
      setCreating(false);
    }
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".tar.gz") || file.size > 100 * 1024 * 1024) {
      toast.error("Pilih arsip .tar.gz SecChangeLog maksimal 100 MiB.");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file, file.name);
      const res = await fetch("/api/admin/backups", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Arsip tidak valid");
      toast.success("Arsip backup berhasil ditambahkan ke pustaka. Restore belum dijalankan.");
      qc.invalidateQueries({ queryKey: ["admin-backups"] });
    } catch (err) { toast.error((err as Error).message); }
    finally { setUploading(false); }
  }

  function handleDownload(b: BackupMeta) {
    const a = document.createElement("a");
    a.href = `/api/admin/backups/${encodeURIComponent(b.filename)}`;
    a.download = b.filename;
    a.click();
  }

  async function handleDelete(b: BackupMeta) {
    if (!confirm(`Hapus backup "${b.filename}"?`)) return;
    try {
      const res = await fetch(
        `/api/admin/backups/${encodeURIComponent(b.filename)}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Gagal");
      toast.success("Backup dihapus");
      qc.invalidateQueries({ queryKey: ["admin-backups"] });
    } catch {
      toast.error("Gagal menghapus backup");
    }
  }

  async function handleRestore(b: BackupMeta) {
    if (restoring) return;
    const first = confirm(
      `Pulihkan data dari backup "${b.filename}"?\n\nSeluruh data saat ini akan DIGANTI dengan isi backup tersebut.`
    );
    if (!first) return;
    const second = confirm(
      "PERHATIAN: Tindakan ini akan menggantikan seluruh database (change log, user, pengaturan) dan file upload.\n\nSebelum restore, sistem otomatis membuat backup keselamatan data saat ini.\n\nAplikasi akan restart otomatis setelah restore dijadwalkan. Lanjutkan?"
    );
    if (!second) return;

    setRestoring(b.filename);
    try {
      const res = await fetch(
        `/api/admin/backups/${encodeURIComponent(b.filename)}`,
        { method: "POST" }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || "Gagal");
      }
      const data = await res.json();
      toast.success(
        data?.message || "Pemulihan dijadwalkan. Aplikasi akan restart otomatis."
      );
      // Restart is imminent; stop polling.
      qc.cancelQueries({ queryKey: ["admin-backups"] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setRestoring(null);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4" />
            Backup Database
          </CardTitle>
          <CardDescription>
            Mencadangkan seluruh data change log, audit trail, pengguna, dan
            pengaturan sistem ke satu file arsip.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline" className="text-[10px] gap-1">
              <HardDrive className="h-3 w-3" /> Snapshot SQLite konsisten
            </Badge>
            <Badge variant="outline" className="text-[10px] gap-1">
              <ShieldCheck className="h-3 w-3" /> Khusus Administrator
            </Badge>
          </div>
          <Button onClick={handleCreate} disabled={creating}>
            {creating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Database className="h-4 w-4 mr-2" />
            )}
            Buat Backup Sekarang
          </Button>
          <label className="inline-flex cursor-pointer items-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent">
            {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4 rotate-180" />}
            Unggah Arsip Backup
            <input type="file" accept=".tar.gz,application/gzip" className="sr-only" disabled={uploading} onChange={handleUpload} />
          </label>
          <p className="text-xs text-muted-foreground">Arsip hanya ditambahkan ke pustaka untuk ditinjau; tidak otomatis memulihkan data.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daftar Backup</CardTitle>
          <CardDescription>
            Arsip yang diunduh berisi snapshot database (.tar.gz).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : !backups || backups.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Belum ada backup. Klik "Buat Backup Sekarang" untuk membuat arsip
              pertama.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Waktu Dibuat</TableHead>
                  <TableHead className="text-right">Ukuran</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {backups.map((b) => (
                  <TableRow key={b.filename}>
                    <TableCell className="font-mono text-xs">
                      {b.filename}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(b.createdAt)}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {formatSize(b.size)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownload(b)}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-amber-500 border-amber-500/40 hover:bg-amber-500/10"
                          onClick={() => handleRestore(b)}
                          disabled={!!restoring}
                          title="Pulihkan data dari backup ini"
                        >
                          {restoring === b.filename ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RotateCcw className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => handleDelete(b)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  Download,
  Eye,
  FileText,
  Trash2,
  AlertTriangle,
  Edit,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import {
  RISK_LEVELS,
  CHANGE_LOG_STATUS,
  CHANGE_TYPES,
  type RiskLevel,
  type ChangeLogStatus,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useSession } from "next-auth/react";
import type { ViewType } from "@/components/layout/app-shell";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const RISK_BADGE_CLASS: Record<string, string> = {
  LOW: "bg-risk-low/15 text-risk-low border-risk-low/30",
  MEDIUM: "bg-risk-medium/15 text-risk-medium border-risk-medium/30",
  HIGH: "bg-risk-high/15 text-risk-high border-risk-high/30",
  CRITICAL: "bg-risk-critical/15 text-risk-critical border-risk-critical/30",
};

const STATUS_BADGE_CLASS: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  IMPLEMENTED: "bg-info/15 text-info border-info/30",
  VERIFIED: "bg-risk-low/15 text-risk-low border-risk-low/30",
  FAILED: "bg-destructive/15 text-destructive border-destructive/30",
};

interface ChangeLog {
  id: string;
  ticketId: string;
  deviceType: { id: string; name: string };
  deviceName: string;
  deviceIp: string | null;
  changeType: string;
  riskLevel: string;
  status: string;
  pic: { id: string; name: string };
  implementedAt: string;
  createdAt: string;
  _count?: { screenshots: number };
  isDeleted?: boolean;
}

export function ChangeLogsView({
  onNavigate,
}: {
  onNavigate: (v: ViewType, editLogId?: string) => void;
}) {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [deviceTypeId, setDeviceTypeId] = useState("");
  const [riskLevel, setRiskLevel] = useState("");
  const [status, setStatus] = useState("");
  const [changeType, setChangeType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ChangeLog | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [submittingDelete, setSubmittingDelete] = useState(false);

  const params = new URLSearchParams({
    page: String(page),
    pageSize: "20",
    sort: "-createdAt",
  });
  if (search) params.set("search", search);
  if (deviceTypeId) params.set("deviceTypeId", deviceTypeId);
  if (riskLevel) params.set("riskLevel", riskLevel);
  if (status) params.set("status", status);
  if (changeType) params.set("changeType", changeType);
  if (from) params.set("from", new Date(from).toISOString());
  if (to) params.set("to", new Date(to).toISOString());
  if (includeDeleted && (session?.user?.role === "ADMIN" || session?.user?.role === "AUDITOR")) {
    params.set("includeDeleted", "true");
  }

  const { data, isLoading } = useQuery({
    queryKey: ["change-logs", params.toString()],
    queryFn: async () => {
      const res = await fetch(`/api/change-logs?${params}`);
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return {
        items: json.data as ChangeLog[],
        meta: json.meta as {
          page: number;
          pageSize: number;
          total: number;
          totalPages: number;
        },
      };
    },
    placeholderData: (prev) => prev,
  });

  const { data: deviceTypes } = useQuery({
    queryKey: ["device-types"],
    queryFn: async () => {
      const res = await fetch("/api/device-types");
      if (!res.ok) return [];
      const json = await res.json();
      return json.data as Array<{ id: string; name: string }>;
    },
  });

  async function handleExportExcel() {
    try {
      toast.info("Menyiapkan export Excel...");
      const res = await fetch(`/api/export/excel?${params}`);
      if (!res.ok) throw new Error("Failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `change-logs-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Excel berhasil diunduh");
    } catch {
      toast.error("Gagal export Excel");
    }
  }

  async function handleSubmitDeleteRequest() {
    if (!deleteTarget || !deleteReason.trim()) return;
    setSubmittingDelete(true);
    try {
      const res = await fetch("/api/delete-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          changeLogId: deleteTarget.id,
          reason: deleteReason,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || "Failed");
      }
      toast.success("Pengajuan hapus berhasil dikirim. Menunggu approval supervisor.");
      setDeleteTarget(null);
      setDeleteReason("");
      qc.invalidateQueries({ queryKey: ["change-logs"] });
      qc.invalidateQueries({ queryKey: ["pending-delete-count"] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmittingDelete(false);
    }
  }

  const canRequestDelete = (log: ChangeLog) => {
    if (!session?.user) return false;
    if (log.isDeleted) return false;
    if (session.user.role === "ADMIN" || session.user.role === "SUPERVISOR") return true;
    // Engineer can only request delete for own logs
    return log.pic.id === session.user.id;
  };

  const canEdit = (log: ChangeLog) => {
    if (!session?.user) return false;
    if (log.isDeleted) return false;
    if (session.user.role === "ADMIN") return true;
    // Engineer can edit own DRAFT logs
    if (log.status === "DRAFT" && log.pic.id === session.user.id) return true;
    return false;
  };

  const canVerify = (logStatus: string) => {
    if (!session?.user) return false;
    if (!["SUPERVISOR", "ADMIN"].includes(session.user.role)) return false;
    return logStatus === "IMPLEMENTED" || logStatus === "DRAFT";
  };

  async function handleVerify(id: string) {
    try {
      const res = await fetch(`/api/change-logs/${id}/verify`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || "Gagal");
      }
      toast.success("Change log berhasil diverifikasi");
      qc.invalidateQueries({ queryKey: ["change-log", id] });
      qc.invalidateQueries({ queryKey: ["change-logs"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Change Logs</h1>
          <p className="text-sm text-muted-foreground">
            Daftar catatan perubahan konfigurasi
          </p>
        </div>
        <Button variant="outline" onClick={handleExportExcel}>
          <Download className="h-4 w-4 mr-2" />
          Export Excel
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
            <div className="lg:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari ticket, device, deskripsi..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>
            <Select
              value={deviceTypeId || "all"}
              onValueChange={(v) => {
                setDeviceTypeId(v === "all" ? "" : v);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Perangkat" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Perangkat</SelectItem>
                {deviceTypes?.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={riskLevel || "all"}
              onValueChange={(v) => {
                setRiskLevel(v === "all" ? "" : v);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Risk" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Risk</SelectItem>
                {Object.keys(RISK_LEVELS).map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={status || "all"}
              onValueChange={(v) => {
                setStatus(v === "all" ? "" : v);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                {Object.keys(CHANGE_LOG_STATUS).map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={changeType || "all"}
              onValueChange={(v) => {
                setChangeType(v === "all" ? "" : v);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Tipe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Tipe</SelectItem>
                {CHANGE_TYPES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase text-muted-foreground">
                Dari Tanggal
              </Label>
              <Input
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setPage(1);
                }}
                className="text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase text-muted-foreground">
                Sampai Tanggal
              </Label>
              <Input
                type="date"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setPage(1);
                }}
                className="text-xs"
              />
            </div>
            {(from || to || search || deviceTypeId || riskLevel || status || changeType) && (
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    setSearch("");
                    setDeviceTypeId("");
                    setRiskLevel("");
                    setStatus("");
                    setChangeType("");
                    setFrom("");
                    setTo("");
                    setPage(1);
                  }}
                >
                  Reset Filter
                </Button>
              </div>
            )}
          </div>

          {(session?.user?.role === "ADMIN" ||
            session?.user?.role === "AUDITOR") && (
            <div className="mt-3 flex items-center gap-2">
              <input
                type="checkbox"
                id="includeDeleted"
                checked={includeDeleted}
                onChange={(e) => {
                  setIncludeDeleted(e.target.checked);
                  setPage(1);
                }}
                className="rounded"
              />
              <Label htmlFor="includeDeleted" className="text-xs cursor-pointer">
                Tampilkan yang sudah dihapus
              </Label>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket ID</TableHead>
                  <TableHead>Perangkat</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>PIC</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      {[...Array(9)].map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-5 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : !data?.items || data.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12">
                      <FileText className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Tidak ada change log ditemukan
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  data.items.map((log) => (
                    <TableRow
                      key={log.id}
                      className={cn(log.isDeleted && "opacity-50")}
                    >
                      <TableCell className="font-mono text-xs font-semibold">
                        {log.ticketId}
                        {log.isDeleted && (
                          <Badge
                            variant="outline"
                            className="ml-2 text-[9px] text-destructive border-destructive/30"
                          >
                            DELETED
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">
                          {log.deviceName}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {log.deviceType.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {log.deviceIp || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {log.changeType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] font-semibold",
                            RISK_BADGE_CLASS[log.riskLevel]
                          )}
                        >
                          {log.riskLevel}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px]",
                            STATUS_BADGE_CLASS[log.status]
                          )}
                        >
                          {log.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{log.pic.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(log.implementedAt).toLocaleDateString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setDetailId(log.id)}
                            title="Lihat detail"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {canEdit(log) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() =>
                                onNavigate("edit-log", log.id)
                              }
                              title="Edit"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {canRequestDelete(log) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setDeleteTarget(log)}
                              title="Ajukan hapus"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
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

      {/* Detail Dialog */}
      {detailId && (
        <ChangeLogDetailDialog
          id={detailId}
          onClose={() => setDetailId(null)}
          onEdit={() => {
            const targetId = detailId;
            setDetailId(null);
            onNavigate("edit-log", targetId);
          }}
          onVerify={() => {
            handleVerify(detailId);
          }}
          canEditFlag={
            !!session?.user &&
            (session.user.role === "ADMIN" ||
              (data?.items?.find((l) => l.id === detailId)?.status === "DRAFT" &&
                data?.items?.find((l) => l.id === detailId)?.pic.id ===
                  session.user.id))
          }
          canVerifyFlag={canVerify(
            data?.items?.find((l) => l.id === detailId)?.status || ""
          )}
        />
      )}

      {/* Delete Request Dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setDeleteReason("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Ajukan Penghapusan Change Log
            </AlertDialogTitle>
            <AlertDialogDescription>
              Change log{" "}
              <span className="font-mono font-semibold">
                {deleteTarget?.ticketId}
              </span>{" "}
              ({deleteTarget?.deviceName}) akan diajukan untuk dihapus.
              Pengajuan akan diteruskan ke supervisor untuk approval.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="deleteReason" className="text-sm">
              Alasan Penghapusan <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="deleteReason"
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder="Jelaskan alasan penghapusan (minimal 10 karakter)..."
              rows={3}
              disabled={submittingDelete}
            />
            <p className="text-[10px] text-muted-foreground">
              {deleteReason.length} / 1000 karakter
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submittingDelete}>
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSubmitDeleteRequest}
              disabled={
                submittingDelete || deleteReason.trim().length < 10
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {submittingDelete ? "Mengirim..." : "Kirim Pengajuan"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Detail dialog component
function ChangeLogDetailDialog({
  id,
  onClose,
  onEdit,
  onVerify,
  canEditFlag,
  canVerifyFlag,
}: {
  id: string;
  onClose: () => void;
  onEdit: () => void;
  onVerify: () => void;
  canEditFlag: boolean;
  canVerifyFlag: boolean;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["change-log", id],
    queryFn: async () => {
      const res = await fetch(`/api/change-logs/${id}`);
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return json.data;
    },
  });

  async function handleExportPdf() {
    try {
      toast.info("Menyiapkan PDF...");
      const res = await fetch(`/api/export/pdf/${id}`);
      if (!res.ok) throw new Error("Failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${data?.ticketId || "change-log"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("PDF berhasil diunduh");
    } catch {
      toast.error("Gagal export PDF");
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2 flex-wrap">
            <span>Detail Change Log</span>
            <div className="flex gap-2">
              {canEditFlag && (
                <Button variant="outline" size="sm" onClick={onEdit}>
                  <Edit className="h-3.5 w-3.5 mr-1.5" />
                  Edit
                </Button>
              )}
              {canVerifyFlag && data?.status !== "VERIFIED" && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={onVerify}
                  className="bg-risk-low hover:bg-risk-low/90"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                  Verify
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleExportPdf}>
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Export PDF
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>
        {isLoading || !data ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <div className="space-y-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-mono text-base font-bold">
                {data.ticketId}
              </span>
              <Badge
                variant="outline"
                className={cn("text-[10px]", RISK_BADGE_CLASS[data.riskLevel])}
              >
                {data.riskLevel}
              </Badge>
              <Badge
                variant="outline"
                className={cn("text-[10px]", STATUS_BADGE_CLASS[data.status])}
              >
                {data.status}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3 bg-muted/30 rounded-md">
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">
                  Perangkat
                </p>
                <p className="font-medium">
                  {data.deviceType.name} - {data.deviceName}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">IP</p>
                <p className="font-mono">{data.deviceIp || "-"}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">
                  Jenis Perubahan
                </p>
                <p className="font-medium">{data.changeType}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">
                  Waktu Implementasi
                </p>
                <p>
                  {new Date(data.implementedAt).toLocaleString("id-ID")}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">
                  PIC
                </p>
                <p>{data.pic.name}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">
                  Pencatat
                </p>
                <p>{data.creator.name}</p>
              </div>
            </div>

            <div>
              <p className="text-[10px] uppercase text-muted-foreground mb-1">
                Kondisi Sebelum
              </p>
              <pre className="text-xs bg-muted/40 p-3 rounded-md whitespace-pre-wrap font-mono">
                {data.descriptionBefore}
              </pre>
            </div>
            <div>
              <p className="text-[10px] uppercase text-muted-foreground mb-1">
                Kondisi Sesudah
              </p>
              <pre className="text-xs bg-muted/40 p-3 rounded-md whitespace-pre-wrap font-mono">
                {data.descriptionAfter}
              </pre>
            </div>
            <div>
              <p className="text-[10px] uppercase text-muted-foreground mb-1">
                Alasan
              </p>
              <p className="text-xs">{data.reason}</p>
            </div>
            {data.rollbackPlan && (
              <div>
                <p className="text-[10px] uppercase text-muted-foreground mb-1">
                  Rollback Plan
                </p>
                <pre className="text-xs bg-muted/40 p-3 rounded-md whitespace-pre-wrap font-mono">
                  {data.rollbackPlan}
                </pre>
              </div>
            )}

            {/* Screenshots */}
            {data.screenshots && data.screenshots.length > 0 && (
              <div>
                <p className="text-[10px] uppercase text-muted-foreground mb-2">
                  Bukti Screenshot ({data.screenshots.length})
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {data.screenshots.map((scr: { id: string; type: string; originalName: string; mimeType: string; }) => {
                    const isImage = scr.mimeType.startsWith("image/");
                    return (
                      <a
                        key={scr.id}
                        href={`/api/files/screenshots/${scr.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="block border border-border rounded-md overflow-hidden hover:opacity-80 transition"
                      >
                        {isImage ? (
                           
                          <img
                            src={`/api/files/screenshots/${scr.id}`}
                            alt={scr.originalName}
                            className="w-full h-32 object-cover"
                          />
                        ) : (
                          <div className="w-full h-32 flex items-center justify-center bg-muted">
                            <FileText className="h-8 w-8 text-muted-foreground" />
                          </div>
                        )}
                        <div className="p-2">
                          <p className="text-[10px] font-medium truncate">
                            {scr.originalName}
                          </p>
                          <Badge variant="outline" className="text-[9px] mt-1">
                            {scr.type}
                          </Badge>
                        </div>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

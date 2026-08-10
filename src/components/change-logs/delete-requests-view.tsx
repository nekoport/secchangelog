"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, X, Loader2, Clock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface DeleteRequest {
  id: string;
  changeLog: {
    id: string;
    ticketId: string;
    deviceName: string;
    isDeleted: boolean;
  };
  requestedBy: { id: string; name: string };
  approvedBy: { id: string; name: string } | null;
  reason: string;
  status: string;
  approverNote: string | null;
  createdAt: string;
  approvedAt: string | null;
}

const STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-info/15 text-info border-info/30",
  APPROVED: "bg-risk-low/15 text-risk-low border-risk-low/30",
  REJECTED: "bg-destructive/15 text-destructive border-destructive/30",
};

export function DeleteRequestsView() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("PENDING");
  const [actionTarget, setActionTarget] = useState<{
    id: string;
    ticketId: string;
    action: "approve" | "reject";
  } | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canApprove =
    session?.user?.role === "SUPERVISOR" || session?.user?.role === "ADMIN";

  const { data, isLoading } = useQuery({
    queryKey: ["delete-requests", filter, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "20",
      });
      if (filter !== "ALL") params.set("status", filter);
      const res = await fetch(`/api/delete-requests?${params}`);
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return {
        items: json.data as DeleteRequest[],
        meta: json.meta as {
          page: number;
          pageSize: number;
          total: number;
          totalPages: number;
        },
      };
    },
  });

  async function handleAction() {
    if (!actionTarget) return;
    setSubmitting(true);
    try {
      const endpoint =
        actionTarget.action === "approve" ? "approve" : "reject";
      const res = await fetch(`/api/delete-requests/${actionTarget.id}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: note || undefined }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || "Gagal");
      }
      toast.success(
        actionTarget.action === "approve"
          ? "Pengajuan hapus disetujui"
          : "Pengajuan hapus ditolak"
      );
      setActionTarget(null);
      setNote("");
      qc.invalidateQueries({ queryKey: ["delete-requests"] });
      qc.invalidateQueries({ queryKey: ["change-logs"] });
      qc.invalidateQueries({ queryKey: ["pending-delete-count"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
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
          <h1 className="text-2xl font-bold">Pengajuan Hapus</h1>
          <p className="text-sm text-muted-foreground">
            {canApprove
              ? "Kelola pengajuan penghapusan change log"
              : "Riwayat pengajuan penghapusan Anda"}
          </p>
        </div>
        <div className="flex gap-1">
          {["PENDING", "APPROVED", "REJECTED", "ALL"].map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setFilter(f);
                setPage(1);
              }}
            >
              {f === "ALL" ? "Semua" : f}
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket</TableHead>
                  <TableHead>Perangkat</TableHead>
                  <TableHead>Diajukan Oleh</TableHead>
                  <TableHead>Alasan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tanggal</TableHead>
                  {canApprove && <TableHead className="text-right">Aksi</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(3)].map((_, i) => (
                    <TableRow key={i}>
                      {[...Array(6)].map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-5 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : !data?.items || data.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canApprove ? 7 : 6} className="text-center py-12">
                      <Clock className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Tidak ada pengajuan
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  data.items.map((dr) => (
                    <TableRow key={dr.id}>
                      <TableCell className="font-mono text-xs font-semibold">
                        {dr.changeLog.ticketId}
                        {dr.changeLog.isDeleted && (
                          <Badge
                            variant="outline"
                            className="ml-2 text-[9px] text-destructive"
                          >
                            DELETED
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {dr.changeLog.deviceName}
                      </TableCell>
                      <TableCell className="text-xs">
                        {dr.requestedBy.name}
                      </TableCell>
                      <TableCell className="text-xs max-w-xs">
                        <div className="truncate" title={dr.reason}>
                          {dr.reason}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn("text-[10px]", STATUS_BADGE[dr.status])}
                        >
                          {dr.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(dr.createdAt).toLocaleDateString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                      {canApprove && (
                        <TableCell className="text-right">
                          {dr.status === "PENDING" ? (
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-risk-low"
                                onClick={() => {
                                  setActionTarget({ id: dr.id, ticketId: dr.changeLog.ticketId, action: "approve" });
                                  setNote("");
                                }}
                                title="Approve"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() => {
                                  setActionTarget({ id: dr.id, ticketId: dr.changeLog.ticketId, action: "reject" });
                                  setNote("");
                                }}
                                title="Reject"
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">
                              {dr.approvedBy?.name || "-"}
                            </span>
                          )}
                        </TableCell>
                      )}
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

      {/* Action Dialog */}
      <Dialog
        open={!!actionTarget}
        onOpenChange={(open) => {
          if (!open) {
            setActionTarget(null);
            setNote("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionTarget?.action === "approve"
                ? "Approve Pengajuan Hapus"
                : "Reject Pengajuan Hapus"}
            </DialogTitle>
          </DialogHeader>
          {actionTarget?.ticketId && (
            <p className="text-sm text-muted-foreground">
              Ticket:{" "}
              <span className="font-mono font-semibold">
                {actionTarget.ticketId}
              </span>
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="note" className="text-sm">
              Catatan (opsional)
            </Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                actionTarget?.action === "approve"
                  ? "Catatan approval..."
                  : "Alasan penolakan..."
              }
              rows={3}
              disabled={submitting}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setActionTarget(null);
                setNote("");
              }}
              disabled={submitting}
            >
              Batal
            </Button>
            <Button
              variant={
                actionTarget?.action === "approve" ? "default" : "destructive"
              }
              onClick={handleAction}
              disabled={submitting}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              {actionTarget?.action === "approve" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

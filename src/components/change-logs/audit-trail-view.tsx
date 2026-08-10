"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Download, History } from "lucide-react";
import { toast } from "sonner";

const ACTION_LABELS: Record<string, string> = {
  LOGIN_SUCCESS: "Login berhasil",
  LOGIN_FAILED: "Login gagal",
  LOGOUT: "Logout",
  ACCOUNT_LOCKED: "Akun terkunci",
  CREATE_CHANGE_LOG: "Membuat change log",
  UPDATE_CHANGE_LOG: "Update change log",
  VIEW_CHANGE_LOG: "Lihat change log",
  CREATE_DELETE_REQUEST: "Ajukan hapus",
  APPROVE_DELETE_REQUEST: "Approve hapus",
  REJECT_DELETE_REQUEST: "Reject hapus",
  SOFT_DELETE_CHANGE_LOG: "Soft delete",
  RESTORE_CHANGE_LOG: "Restore",
  UPLOAD_SCREENSHOT: "Upload screenshot",
  DELETE_SCREENSHOT: "Hapus screenshot",
  CREATE_USER: "Buat user",
  UPDATE_USER: "Update user",
  DEACTIVATE_USER: "Nonaktifkan user",
  ACTIVATE_USER: "Aktifkan user",
  CREATE_DEVICE_TYPE: "Buat device type",
  UPDATE_DEVICE_TYPE: "Update device type",
  DEACTIVATE_DEVICE_TYPE: "Nonaktifkan device type",
  UPDATE_SYSTEM_SETTING: "Update setting",
  UPDATE_SYSTEM_LOGO: "Update logo",
  UPDATE_SYSTEM_FAVICON: "Update favicon",
  CREATE_DEVICE: "Buat perangkat",
  UPDATE_DEVICE: "Update perangkat",
  DEACTIVATE_DEVICE: "Nonaktifkan perangkat",
  EXPORT_EXCEL: "Export Excel",
  EXPORT_PDF: "Export PDF",
  CHANGE_THEME: "Ganti tema",
  NTP_SYNC: "Sync waktu NTP",
  UPDATE_NTP_SETTING: "Update NTP",
};

export function AuditTrailView() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [entityType, setEntityType] = useState("");

  const params = new URLSearchParams({
    page: String(page),
    pageSize: "20",
  });
  if (actionFilter) params.set("action", actionFilter);
  if (entityType) params.set("entityType", entityType);

  const { data, isLoading } = useQuery({
    queryKey: ["audit-trail", params.toString()],
    queryFn: async () => {
      const res = await fetch(`/api/audit-trail?${params}`);
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return {
        items: json.data,
        meta: json.meta,
      };
    },
    placeholderData: (prev) => prev,
  });

  // Apply client-side search (since audit trail search by user isn't supported in API)
  const filteredItems = (data?.items || []).filter(
    (item: {
      user?: { name?: string };
      action?: string;
      actionText?: string;
      entityId?: string;
      entityLabel?: string;
    }) =>
      !search ||
      item.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
      item.action?.toLowerCase().includes(search.toLowerCase()) ||
      item.actionText?.toLowerCase().includes(search.toLowerCase()) ||
      item.entityId?.toLowerCase().includes(search.toLowerCase()) ||
      item.entityLabel?.toLowerCase().includes(search.toLowerCase())
  );

  async function handleExport() {
    try {
      toast.info("Menyiapkan export Excel...");
      const params = new URLSearchParams();
      if (actionFilter) params.set("action", actionFilter);
      if (entityType) params.set("entityType", entityType);
      const res = await fetch(`/api/export/audit-trail/excel?${params}`);
      if (!res.ok) throw new Error("Failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-trail-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Audit trail berhasil diunduh");
    } catch {
      toast.error("Gagal export audit trail");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Audit Trail</h1>
          <p className="text-sm text-muted-foreground">
            Log lengkap aktivitas user untuk keperluan audit & forensik
          </p>
        </div>
        <Button variant="outline" onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari user, aksi..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={actionFilter || "all"}
              onValueChange={(v) => {
                setActionFilter(v === "all" ? "" : v);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Aksi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Aksi</SelectItem>
                {Object.keys(ACTION_LABELS).map((a) => (
                  <SelectItem key={a} value={a}>
                    {ACTION_LABELS[a]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={entityType || "all"}
              onValueChange={(v) => {
                setEntityType(v === "all" ? "" : v);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Tipe Entity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Entity</SelectItem>
                <SelectItem value="User">User</SelectItem>
                <SelectItem value="ChangeLog">Change Log</SelectItem>
                <SelectItem value="DeleteRequest">Delete Request</SelectItem>
                <SelectItem value="Screenshot">Screenshot</SelectItem>
                <SelectItem value="DeviceType">Device Type</SelectItem>
                <SelectItem value="SystemSetting">System Setting</SelectItem>
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
                  <TableHead>Timestamp</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Aksi</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>IP Address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      {[...Array(5)].map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-5 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : !filteredItems || filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12">
                      <History className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Tidak ada audit trail
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((item: {
                    id: string;
                    action: string;
                    actionText?: string;
                    entityType: string;
                    entityId: string;
                    entityLabel?: string;
                    ipAddress: string | null;
                    timestamp: string;
                    user: { id: string; name: string; email: string; role: string };
                  }) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {new Date(item.timestamp).toLocaleString("id-ID")}
                      </TableCell>
                      <TableCell>
                        <div className="text-xs font-medium">
                          {item.user?.name || "Unknown"}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {item.user?.email}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs font-medium">
                          {item.actionText || ACTION_LABELS[item.action] || item.action}
                        </div>
                        <div className="text-[10px] text-muted-foreground uppercase">
                          {item.action}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div>{item.entityType}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {item.entityLabel || item.entityId.slice(0, 12) + "..."}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {item.ipAddress || "-"}
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
                Halaman {data.meta.page} / {data.meta.totalPages} ({data.meta.total} total)
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
    </div>
  );
}

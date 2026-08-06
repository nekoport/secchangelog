"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Upload, X, FileText, Image as ImageIcon, Loader2, Save, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  RISK_LEVELS,
  CHANGE_TYPES,
  CHANGE_LOG_STATUS,
  SCREENSHOT_TYPES,
} from "@/lib/constants";
import type { ViewType } from "@/components/layout/app-shell";
import { cn } from "@/lib/utils";

interface UploadedScreenshot {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  type: string;
}

export function EditLogView({
  changeLogId,
  onNavigate,
}: {
  changeLogId: string;
  onNavigate: (v: ViewType) => void;
}) {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  const [deviceTypeId, setDeviceTypeId] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [deviceIp, setDeviceIp] = useState("");
  const [changeType, setChangeType] = useState("");
  const [descriptionBefore, setDescriptionBefore] = useState("");
  const [descriptionAfter, setDescriptionAfter] = useState("");
  const [reason, setReason] = useState("");
  const [riskLevel, setRiskLevel] = useState("");
  const [status, setStatus] = useState("IMPLEMENTED");
  const [rollbackPlan, setRollbackPlan] = useState("");
  const [implementedAt, setImplementedAt] = useState("");
  const [screenshots, setScreenshots] = useState<UploadedScreenshot[]>([]);

  const { data: deviceTypes } = useQuery({
    queryKey: ["device-types"],
    queryFn: async () => {
      const res = await fetch("/api/device-types");
      if (!res.ok) return [];
      const json = await res.json();
      return json.data as Array<{ id: string; name: string }>;
    },
  });

  // Load existing data
  useEffect(() => {
    async function loadLog() {
      try {
        const res = await fetch(`/api/change-logs/${changeLogId}`);
        if (!res.ok) {
          if (res.status === 403) setForbidden(true);
          throw new Error("Failed");
        }
        const json = await res.json();
        const log = json.data;
        setDeviceTypeId(log.deviceTypeId || log.deviceType?.id);
        setDeviceName(log.deviceName);
        setDeviceIp(log.deviceIp || "");
        setChangeType(log.changeType);
        setDescriptionBefore(log.descriptionBefore);
        setDescriptionAfter(log.descriptionAfter);
        setReason(log.reason);
        setRiskLevel(log.riskLevel);
        setStatus(log.status);
        setRollbackPlan(log.rollbackPlan || "");
        setImplementedAt(
          new Date(log.implementedAt).toISOString().slice(0, 16)
        );
        setScreenshots(
          (log.screenshots || []).map((s: UploadedScreenshot) => ({
            ...s,
          }))
        );
      } catch (err) {
        toast.error("Gagal memuat data change log");
      } finally {
        setLoading(false);
      }
    }
    loadLog();
  }, [changeLogId]);

  async function handleUploadFile(
    file: File,
    type: keyof typeof SCREENSHOT_TYPES
  ) {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File terlalu besar (maks 10MB)");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", type);
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || "Upload gagal");
      }
      const json = await res.json();
      setScreenshots((prev) => [...prev, json.data]);
      toast.success(`Screenshot ${type} diupload`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  function handleFileSelect(
    e: React.ChangeEvent<HTMLInputElement>,
    type: keyof typeof SCREENSHOT_TYPES
  ) {
    const files = Array.from(e.target.files || []);
    files.forEach((f) => handleUploadFile(f, type));
    e.target.value = "";
  }

  function removeScreenshot(id: string) {
    fetch(`/api/files/screenshots/${id}`, { method: "DELETE" }).catch(() => {});
    setScreenshots((prev) => prev.filter((s) => s.id !== id));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!deviceTypeId || !deviceName || !changeType || !riskLevel) {
      toast.error("Lengkapi semua field wajib");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/change-logs/${changeLogId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceTypeId,
          deviceName,
          deviceIp: deviceIp || undefined,
          changeType,
          descriptionBefore,
          descriptionAfter,
          reason,
          riskLevel,
          status,
          rollbackPlan: rollbackPlan || undefined,
          implementedAt: new Date(implementedAt).toISOString(),
          screenshotIds: screenshots.map((s) => s.id),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || "Gagal menyimpan");
      }
      toast.success("Change log berhasil diupdate");
      qc.invalidateQueries({ queryKey: ["change-logs"] });
      qc.invalidateQueries({ queryKey: ["change-log", changeLogId] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      onNavigate("logs");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold">Edit Change Log</h1>
          <p className="text-sm text-muted-foreground">Memuat data...</p>
        </div>
        <div className="space-y-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-12 bg-muted/40 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="space-y-4 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold">Edit Change Log</h1>
        </div>
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-3" />
            <h3 className="text-lg font-semibold mb-2">Akses Ditolak</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Change log yang sudah berstatus <strong>IMPLEMENTED</strong> atau
              lebih lanjut tidak bisa diedit. Hanya change log berstatus DRAFT
              atau oleh Admin yang bisa diedit.
            </p>
            <Button onClick={() => onNavigate("logs")}>Kembali ke List</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const beforeShots = screenshots.filter((s) => s.type === "BEFORE");
  const afterShots = screenshots.filter((s) => s.type === "AFTER");
  const otherShots = screenshots.filter((s) => s.type === "OTHER");

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Edit Change Log</h1>
          <p className="text-sm text-muted-foreground">
            Update informasi perubahan konfigurasi
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          {status}
        </Badge>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Section 1: Device Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informasi Perangkat</CardTitle>
            <CardDescription>Detail perangkat yang dikonfigurasi</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>
                Jenis Perangkat <span className="text-destructive">*</span>
              </Label>
              <Select value={deviceTypeId} onValueChange={setDeviceTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih jenis perangkat" />
                </SelectTrigger>
                <SelectContent>
                  {deviceTypes?.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>
                Nama Perangkat (hostname){" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>IP Address</Label>
              <Input
                value={deviceIp}
                onChange={(e) => setDeviceIp(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>
                Jenis Perubahan <span className="text-destructive">*</span>
              </Label>
              <Select value={changeType} onValueChange={setChangeType}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih jenis perubahan" />
                </SelectTrigger>
                <SelectContent>
                  {CHANGE_TYPES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Change Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Detail Perubahan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>
                Kondisi Sebelum <span className="text-destructive">*</span>
              </Label>
              <Textarea
                value={descriptionBefore}
                onChange={(e) => setDescriptionBefore(e.target.value)}
                rows={4}
                className="font-mono text-xs"
                required
                minLength={10}
              />
            </div>
            <div className="space-y-2">
              <Label>
                Kondisi Sesudah <span className="text-destructive">*</span>
              </Label>
              <Textarea
                value={descriptionAfter}
                onChange={(e) => setDescriptionAfter(e.target.value)}
                rows={4}
                className="font-mono text-xs"
                required
                minLength={10}
              />
            </div>
            <div className="space-y-2">
              <Label>
                Alasan Perubahan <span className="text-destructive">*</span>
              </Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                required
                minLength={10}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>
                  Risk Level <span className="text-destructive">*</span>
                </Label>
                <Select value={riskLevel} onValueChange={setRiskLevel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(RISK_LEVELS).map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(CHANGE_LOG_STATUS).map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>
                  Waktu Implementasi <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="datetime-local"
                  value={implementedAt}
                  onChange={(e) => setImplementedAt(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Rollback Plan</Label>
              <Textarea
                value={rollbackPlan}
                onChange={(e) => setRollbackPlan(e.target.value)}
                rows={3}
                className="font-mono text-xs"
              />
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Screenshots */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bukti Screenshot</CardTitle>
            <CardDescription>
              Upload screenshot before & after (PNG, JPEG, WEBP, PDF - maks 10MB)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(["BEFORE", "AFTER", "OTHER"] as const).map((type) => {
                const list =
                  type === "BEFORE"
                    ? beforeShots
                    : type === "AFTER"
                    ? afterShots
                    : otherShots;
                return (
                  <div key={type} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs uppercase tracking-wider">
                        {type === "BEFORE"
                          ? "Sebelum"
                          : type === "AFTER"
                          ? "Sesudah"
                          : "Lainnya"}
                      </Label>
                      <Badge variant="outline" className="text-[9px]">
                        {list.length} file
                      </Badge>
                    </div>
                    <label
                      className={cn(
                        "flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-border rounded-md cursor-pointer hover:border-primary hover:bg-accent/50 transition",
                        uploading && "opacity-50 pointer-events-none"
                      )}
                    >
                      {uploading ? (
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      ) : (
                        <Upload className="h-6 w-6 text-muted-foreground" />
                      )}
                      <span className="text-xs text-muted-foreground">
                        Klik untuk upload
                      </span>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/png,image/jpeg,image/webp,application/pdf"
                        multiple
                        onChange={(e) => handleFileSelect(e, type)}
                      />
                    </label>
                    {list.length > 0 && (
                      <div className="space-y-1.5">
                        {list.map((scr) => (
                          <div
                            key={scr.id}
                            className="flex items-center gap-2 p-2 bg-muted/40 rounded-md text-xs"
                          >
                            {scr.mimeType.startsWith("image/") ? (
                              <ImageIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            ) : (
                              <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            )}
                            <span className="flex-1 truncate">
                              {scr.originalName}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {(scr.size / 1024).toFixed(0)}KB
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive"
                              onClick={() => removeScreenshot(scr.id)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2 pb-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => onNavigate("logs")}
            disabled={submitting}
          >
            Batal
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Menyimpan...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Simpan Perubahan
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

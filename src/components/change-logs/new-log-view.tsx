"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { Upload, X, FileText, Image as ImageIcon, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { SCREENSHOT_TYPES } from "@/lib/constants";
import type { ViewType } from "@/components/layout/app-shell";
import { cn } from "@/lib/utils";
import { toDatetimeLocalValue } from "@/lib/utils";

interface UploadedScreenshot {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  type: string;
}

export function NewLogView({
  onNavigate,
}: {
  onNavigate: (v: ViewType, editLogId?: string) => void;
}) {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [deviceTypeId, setDeviceTypeId] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [deviceIp, setDeviceIp] = useState("");
  const [requestor, setRequestor] = useState("");
  const [changeType, setChangeType] = useState("");
  const [descriptionBefore, setDescriptionBefore] = useState("");
  const [descriptionAfter, setDescriptionAfter] = useState("");
  const [reason, setReason] = useState("");
  const [rollbackPlan, setRollbackPlan] = useState("");
  const [implementedAt, setImplementedAt] = useState(() =>
    toDatetimeLocalValue(new Date())
  );
  const [screenshots, setScreenshots] = useState<UploadedScreenshot[]>([]);

  const { data: deviceTypes } = useQuery({
    queryKey: ["device-types"],
    queryFn: async () => {
      const res = await fetch("/api/device-types");
      if (!res.ok) return [];
      const json = await res.json();
      return json.data as Array<{
        id: string;
        name: string;
      }>;
    },
  });

  const { data: devices } = useQuery({
    queryKey: ["devices", deviceTypeId],
    queryFn: async () => {
      if (!deviceTypeId) return [];
      const res = await fetch(
        `/api/devices?deviceTypeId=${encodeURIComponent(deviceTypeId)}`
      );
      if (!res.ok) return [];
      const json = await res.json();
      return json.data as Array<{
        id: string;
        name: string;
        ipAddress: string | null;
      }>;
    },
    enabled: !!deviceTypeId,
  });

  function handleDeviceTypeChange(id: string) {
    setDeviceTypeId(id);
    setDeviceId("");
    setDeviceName("");
    setDeviceIp("");
  }

  function handleDeviceChange(id: string) {
    const device = devices?.find((d) => d.id === id);
    setDeviceId(id);
    setDeviceName(device?.name || "");
    setDeviceIp(device?.ipAddress || "");
  }

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
    if (!deviceTypeId || !deviceName || !changeType || !requestor.trim()) {
      toast.error("Lengkapi semua field wajib (termasuk Pemohon)");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/change-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceTypeId,
          deviceId: deviceId || undefined,
          deviceName,
          deviceIp: deviceIp || undefined,
          requestor: requestor || undefined,
          changeType,
          descriptionBefore,
          descriptionAfter,
          reason,
          rollbackPlan: rollbackPlan || undefined,
          implementedAt: new Date(implementedAt).toISOString(),
          screenshotIds: screenshots.map((s) => s.id),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || "Gagal menyimpan");
      }
      const json = await res.json();
      toast.success(`Change log ${json.data.ticketId} berhasil dibuat`);
      qc.invalidateQueries({ queryKey: ["change-logs"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      onNavigate("logs");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const beforeShots = screenshots.filter((s) => s.type === "BEFORE");
  const afterShots = screenshots.filter((s) => s.type === "AFTER");
  const otherShots = screenshots.filter((s) => s.type === "OTHER");

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Catat Perubahan Konfigurasi</h1>
        <p className="text-sm text-muted-foreground">
          Lengkapi form berikut untuk mencatat perubahan konfigurasi perangkat
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Section 1: Device Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informasi Perangkat</CardTitle>
            <CardDescription>
              Detail perangkat yang dikonfigurasi
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="deviceType">
                Jenis Perangkat <span className="text-destructive">*</span>
              </Label>
              <Select
                value={deviceTypeId}
                onValueChange={handleDeviceTypeChange}
              >
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
              <Label htmlFor="requestor">
                Pemohon <span className="text-destructive">*</span>
              </Label>
              <Input
                id="requestor"
                value={requestor}
                onChange={(e) => setRequestor(e.target.value)}
                placeholder="Nama pemohon perubahan"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deviceName">
                Nama Perangkat (hostname){" "}
                <span className="text-destructive">*</span>
              </Label>
              <Select
                value={deviceId}
                onValueChange={handleDeviceChange}
                disabled={!deviceTypeId}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      deviceTypeId
                        ? devices?.length
                          ? "Pilih nama perangkat"
                          : "Tidak ada perangkat untuk jenis ini"
                        : "Pilih jenis perangkat dahulu"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {devices?.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                      {d.ipAddress ? ` (${d.ipAddress})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                Daftar menyesuaikan jenis perangkat. Tambah perangkat baru di
                Settings &gt; Jenis Perangkat.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="deviceIp">IP Address</Label>
              <Input
                id="deviceIp"
                value={deviceIp}
                onChange={(e) => setDeviceIp(e.target.value)}
                placeholder="Otomatis terisi dari perangkat"
                readOnly={!!deviceId}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="changeType">
                Jenis Perubahan <span className="text-destructive">*</span>
              </Label>
              <Input
                id="changeType"
                value={changeType}
                onChange={(e) => setChangeType(e.target.value)}
                placeholder="Contoh: Security Policy, Routing, NAT..."
                maxLength={100}
              />
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Change Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Detail Perubahan</CardTitle>
            <CardDescription>
              Jelaskan permintaan dan perubahan konfigurasi yang dilakukan
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="descriptionBefore">
                Permintaan <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="descriptionBefore"
                value={descriptionBefore}
                onChange={(e) => setDescriptionBefore(e.target.value)}
                placeholder="Tulis permintaan perubahan..."
                rows={4}
                className="font-mono text-xs"
                required
                minLength={10}
              />
              <p className="text-[10px] text-muted-foreground">
                {descriptionBefore.length} / 5000 karakter (minimal 10)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="descriptionAfter">
                Perubahan Konfigurasi <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="descriptionAfter"
                value={descriptionAfter}
                onChange={(e) => setDescriptionAfter(e.target.value)}
                placeholder="Tulis rincian perubahan konfigurasi..."
                rows={4}
                className="font-mono text-xs"
                required
                minLength={10}
              />
              <p className="text-[10px] text-muted-foreground">
                {descriptionAfter.length} / 5000 karakter (minimal 10)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">
                Keterangan <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Berikan keterangan terkait perubahan ini..."
                rows={3}
                required
                minLength={10}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="implementedAt">
                Waktu Implementasi <span className="text-destructive">*</span>
              </Label>
              <Input
                id="implementedAt"
                type="datetime-local"
                value={implementedAt}
                onChange={(e) => setImplementedAt(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rollbackPlan">Rollback Plan</Label>
              <Textarea
                id="rollbackPlan"
                value={rollbackPlan}
                onChange={(e) => setRollbackPlan(e.target.value)}
                placeholder="Langkah-langkah untuk membatalkan perubahan jika terjadi masalah..."
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

        {/* Submit */}
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
                <Check className="h-4 w-4 mr-2" />
                Simpan Change Log
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

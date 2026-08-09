"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Upload,
  Plus,
  Trash2,
  Save,
  Loader2,
  Shield,
  Image as ImageIcon,
  Server,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { useSystemSettings } from "@/hooks/use-system-settings";

interface DeviceType {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  _count?: { changeLogs: number; devices: number };
}

interface Device {
  id: string;
  deviceTypeId: string;
  name: string;
  ipAddress: string | null;
  isActive: boolean;
  deviceType?: { id: string; name: string };
  _count?: { changeLogs: number };
}

export function SettingsView() {
  const qc = useQueryClient();
  const { settings, isLoading: settingsLoading } = useSystemSettings();
  const [tab, setTab] = useState<"general" | "device-types" | "ldap" | "password">(
    "general"
  );

  // General settings
  const [systemName, setSystemName] = useState("");
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);

  // LDAP
  const [ldapEnabled, setLdapEnabled] = useState(false);
  const [ldapUrl, setLdapUrl] = useState("");
  const [ldapBindDn, setLdapBindDn] = useState("");
  const [ldapBindPassword, setLdapBindPassword] = useState("");
  const [ldapSearchBase, setLdapSearchBase] = useState("");
  const [ldapSearchFilter, setLdapSearchFilter] = useState("(sAMAccountName={username})");
  const [savingLdap, setSavingLdap] = useState(false);

  // Password policy
  const [minLength, setMinLength] = useState("10");
  const [requireUppercase, setRequireUppercase] = useState(true);
  const [requireLowercase, setRequireLowercase] = useState(true);
  const [requireNumber, setRequireNumber] = useState(true);
  const [requireSymbol, setRequireSymbol] = useState(true);
  const [savingPassword, setSavingPassword] = useState(false);

  // Device types (general categories)
  const [showCreateDevice, setShowCreateDevice] = useState(false);
  const [newDeviceName, setNewDeviceName] = useState("");
  const [newDeviceDesc, setNewDeviceDesc] = useState("");
  const [creatingDevice, setCreatingDevice] = useState(false);

  // Devices (hostname + IP); "all" = no filter (Radix SelectItem cannot be empty string)
  const [deviceTypeFilter, setDeviceTypeFilter] = useState<string>("all");
  const [showDeviceDialog, setShowDeviceDialog] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [deviceFormType, setDeviceFormType] = useState("");
  const [deviceFormName, setDeviceFormName] = useState("");
  const [deviceFormIp, setDeviceFormIp] = useState("");
  const [savingDevice, setSavingDevice] = useState(false);

  useEffect(() => {
    if (settings) {
      setSystemName(settings["system.name"] || "SecChangeLog");
      setLdapEnabled(settings["ldap.enabled"] === "true");
      setLdapUrl(settings["ldap.url"] || "");
      setLdapBindDn(settings["ldap.bindDn"] || "");
      setLdapSearchBase(settings["ldap.searchBase"] || "");
      setLdapSearchFilter(settings["ldap.searchFilter"] || "(sAMAccountName={username})");
      setMinLength(settings["password.minLength"] || "10");
      setRequireUppercase(settings["password.requireUppercase"] === "true");
      setRequireLowercase(settings["password.requireLowercase"] === "true");
      setRequireNumber(settings["password.requireNumber"] === "true");
      setRequireSymbol(settings["password.requireSymbol"] === "true");
    }
  }, [settings]);

  const { data: deviceTypesWithCount, isLoading: dtLoading, refetch: refetchDt } = useQuery({
    queryKey: ["admin-device-types-detail"],
    queryFn: async () => {
      const res = await fetch("/api/admin/device-types");
      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json) ? json : json.data || [];
    },
    enabled: tab === "device-types",
  });

  const { data: devices, refetch: refetchDevices } = useQuery({
    queryKey: ["admin-devices", deviceTypeFilter],
    queryFn: async () => {
      const url =
        deviceTypeFilter && deviceTypeFilter !== "all"
          ? `/api/admin/devices?deviceTypeId=${encodeURIComponent(deviceTypeFilter)}`
          : "/api/admin/devices";
      const res = await fetch(url);
      if (!res.ok) return [];
      const json = await res.json();
      return (Array.isArray(json) ? json : json.data || []) as Device[];
    },
    enabled: tab === "device-types",
  });

  async function handleSaveGeneral() {
    setSavingGeneral(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          "system.name": systemName,
        }),
      });
      if (!res.ok) throw new Error("Gagal");
      toast.success("Pengaturan umum disimpan");
      qc.invalidateQueries({ queryKey: ["system-settings"] });
    } catch {
      toast.error("Gagal menyimpan");
    } finally {
      setSavingGeneral(false);
    }
  }

  async function handleUploadLogo(file: File) {
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo maksimal 2MB");
      return;
    }
    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/settings/logo", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || "Gagal");
      }
      toast.success("Logo berhasil diupload");
      qc.invalidateQueries({ queryKey: ["system-settings"] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleResetLogo() {
    try {
      const res = await fetch("/api/admin/settings/logo", { method: "DELETE" });
      if (!res.ok) throw new Error("Gagal");
      toast.success("Logo direset");
      qc.invalidateQueries({ queryKey: ["system-settings"] });
    } catch {
      toast.error("Gagal reset logo");
    }
  }

  async function handleUploadFavicon(file: File) {
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Favicon maksimal 2MB");
      return;
    }
    setUploadingFavicon(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/settings/favicon", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || "Gagal");
      }
      toast.success("Favicon berhasil diupload");
      qc.invalidateQueries({ queryKey: ["system-settings"] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploadingFavicon(false);
    }
  }

  async function handleResetFavicon() {
    try {
      const res = await fetch("/api/admin/settings/favicon", {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Gagal");
      toast.success("Favicon direset");
      qc.invalidateQueries({ queryKey: ["system-settings"] });
    } catch {
      toast.error("Gagal reset favicon");
    }
  }

  async function handleSaveLdap() {
    setSavingLdap(true);
    try {
      const body: Record<string, string> = {
        "ldap.enabled": ldapEnabled ? "true" : "false",
        "ldap.url": ldapUrl,
        "ldap.bindDn": ldapBindDn,
        "ldap.searchBase": ldapSearchBase,
        "ldap.searchFilter": ldapSearchFilter,
      };
      if (ldapBindPassword && ldapBindPassword !== "********") {
        body["ldap.bindPassword"] = ldapBindPassword;
      }
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Gagal");
      toast.success("Pengaturan LDAP disimpan");
      qc.invalidateQueries({ queryKey: ["system-settings"] });
    } catch {
      toast.error("Gagal menyimpan");
    } finally {
      setSavingLdap(false);
    }
  }

  async function handleSavePassword() {
    setSavingPassword(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          "password.minLength": minLength,
          "password.requireUppercase": requireUppercase ? "true" : "false",
          "password.requireLowercase": requireLowercase ? "true" : "false",
          "password.requireNumber": requireNumber ? "true" : "false",
          "password.requireSymbol": requireSymbol ? "true" : "false",
        }),
      });
      if (!res.ok) throw new Error("Gagal");
      toast.success("Password policy disimpan");
      qc.invalidateQueries({ queryKey: ["system-settings"] });
    } catch {
      toast.error("Gagal menyimpan");
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleCreateDeviceType() {
    if (!newDeviceName.trim()) {
      toast.error("Nama wajib diisi");
      return;
    }
    setCreatingDevice(true);
    try {
      const res = await fetch("/api/admin/device-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newDeviceName,
          description: newDeviceDesc,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || "Gagal");
      }
      toast.success("Jenis perangkat dibuat");
      setShowCreateDevice(false);
      setNewDeviceName("");
      setNewDeviceDesc("");
      refetchDt();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setCreatingDevice(false);
    }
  }

  async function handleDeleteDeviceType(dt: DeviceType) {
    if (!confirm(`Hapus jenis perangkat "${dt.name}"?`)) return;
    try {
      const res = await fetch(`/api/admin/device-types/${dt.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Gagal");
      toast.success("Jenis perangkat dihapus");
      refetchDt();
      refetchDevices();
    } catch {
      toast.error("Gagal menghapus");
    }
  }

  function openCreateDeviceDialog() {
    setEditingDevice(null);
    setDeviceFormType(deviceTypeFilter === "all" ? "" : deviceTypeFilter);
    setDeviceFormName("");
    setDeviceFormIp("");
    setShowDeviceDialog(true);
  }

  function openEditDeviceDialog(device: Device) {
    setEditingDevice(device);
    setDeviceFormType(device.deviceTypeId);
    setDeviceFormName(device.name);
    setDeviceFormIp(device.ipAddress || "");
    setShowDeviceDialog(true);
  }

  async function handleSaveDevice() {
    if (!deviceFormType) {
      toast.error("Jenis perangkat wajib dipilih");
      return;
    }
    if (!deviceFormName.trim()) {
      toast.error("Hostname wajib diisi");
      return;
    }
    setSavingDevice(true);
    try {
      const body = {
        deviceTypeId: deviceFormType,
        name: deviceFormName,
        ipAddress: deviceFormIp,
      };
      const url = editingDevice
        ? `/api/admin/devices/${editingDevice.id}`
        : "/api/admin/devices";
      const res = await fetch(url, {
        method: editingDevice ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || "Gagal");
      }
      toast.success(editingDevice ? "Perangkat diperbarui" : "Perangkat ditambahkan");
      setShowDeviceDialog(false);
      refetchDevices();
      refetchDt();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSavingDevice(false);
    }
  }

  async function handleDeleteDevice(device: Device) {
    if (!confirm(`Hapus perangkat "${device.name}"?`)) return;
    try {
      const res = await fetch(`/api/admin/devices/${device.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Gagal");
      toast.success("Perangkat dihapus");
      refetchDevices();
      refetchDt();
    } catch {
      toast.error("Gagal menghapus");
    }
  }

  if (settingsLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  const TABS = [
    { id: "general", label: "Umum", icon: Shield },
    { id: "device-types", label: "Jenis Perangkat", icon: Server },
    { id: "ldap", label: "LDAP", icon: Shield },
    { id: "password", label: "Password Policy", icon: Shield },
  ] as const;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Konfigurasi sistem dan administrasi
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                tab === t.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* General Tab */}
      {tab === "general" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Identitas Sistem</CardTitle>
              <CardDescription>
                Nama sistem & tema default
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="systemName">Nama Sistem</Label>
                <Input
                  id="systemName"
                  value={systemName}
                  onChange={(e) => setSystemName(e.target.value)}
                  placeholder="SecChangeLog"
                />
              </div>
              <Button onClick={handleSaveGeneral} disabled={savingGeneral}>
                {savingGeneral ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Simpan
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Logo Sistem</CardTitle>
              <CardDescription>
                Upload logo custom (PNG, WEBP, SVG - maks 2MB)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4 p-4 border border-border rounded-md">
                {settings?.["system.logoPath"] ? (
                   
                  <img
                    src={settings["system.logoPath"]}
                    alt="Logo"
                    className="h-16 w-16 object-contain"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-md bg-primary/10 flex items-center justify-center text-primary">
                    <ImageIcon className="h-8 w-8" />
                  </div>
                )}
                <div className="flex-1 text-xs text-muted-foreground">
                  {settings?.["system.logoPath"]
                    ? "Logo custom aktif"
                    : "Menggunakan logo default"}
                </div>
              </div>
              <div className="flex gap-2">
                <label className="flex-1">
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={uploadingLogo}
                    asChild
                  >
                    <span>
                      {uploadingLogo ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4 mr-2" />
                      )}
                      Upload Logo
                    </span>
                  </Button>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/png,image/webp,image/svg+xml"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUploadLogo(f);
                      e.target.value = "";
                    }}
                  />
                </label>
                {settings?.["system.logoPath"] && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleResetLogo}
                    title="Reset logo"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Favicon Sistem</CardTitle>
              <CardDescription>
                Upload favicon (ikon tab browser) - PNG, WEBP, SVG, ICO (maks 2MB)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4 p-4 border border-border rounded-md">
                {settings?.["system.faviconPath"] ? (
                  <img
                    src={settings["system.faviconPath"]}
                    alt="Favicon"
                    className="h-8 w-8 object-contain"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center text-primary">
                    <ImageIcon className="h-4 w-4" />
                  </div>
                )}
                <div className="flex-1 text-xs text-muted-foreground">
                  {settings?.["system.faviconPath"]
                    ? "Favicon custom aktif"
                    : "Menggunakan favicon default"}
                </div>
              </div>
              <div className="flex gap-2">
                <label className="flex-1">
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={uploadingFavicon}
                    asChild
                  >
                    <span>
                      {uploadingFavicon ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4 mr-2" />
                      )}
                      Upload Favicon
                    </span>
                  </Button>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/png,image/webp,image/svg+xml,image/x-icon,image/vnd.microsoft.icon"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUploadFavicon(f);
                      e.target.value = "";
                    }}
                  />
                </label>
                {settings?.["system.faviconPath"] && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleResetFavicon}
                    title="Reset favicon"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Device Types Tab */}
      {tab === "device-types" && (
        <div className="space-y-4">
          {/* Jenis Perangkat (general categories) */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Jenis Perangkat</CardTitle>
                  <CardDescription>
                    Kategori umum perangkat, misal: Firewall, Network, Server,
                    Virtual Machine, dll.
                  </CardDescription>
                </div>
                <Button size="sm" onClick={() => setShowCreateDevice(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Tambah
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>Deskripsi</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Perangkat</TableHead>
                    <TableHead>Change Log</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dtLoading ? (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    </TableRow>
                  ) : !deviceTypesWithCount || deviceTypesWithCount.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-sm text-muted-foreground">
                        Tidak ada jenis perangkat
                      </TableCell>
                    </TableRow>
                  ) : (
                    deviceTypesWithCount.map((dt: DeviceType) => (
                      <TableRow key={dt.id}>
                        <TableCell className="font-medium">{dt.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {dt.description || "-"}
                        </TableCell>
                        <TableCell>
                          {dt.isActive ? (
                            <Badge variant="outline" className="text-[9px] text-risk-low">
                              Aktif
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[9px] text-destructive">
                              Nonaktif
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {dt._count?.devices || 0}
                        </TableCell>
                        <TableCell className="text-xs">
                          {dt._count?.changeLogs || 0}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => handleDeleteDeviceType(dt)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Daftar Perangkat (hostname + IP) */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <CardTitle className="text-base">Daftar Perangkat</CardTitle>
                  <CardDescription>
                    Nama perangkat adalah hostname. IP Address terhubung ke
                    perangkat, bukan ke jenis perangkat.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-48">
                    <Select
                      value={deviceTypeFilter}
                      onValueChange={setDeviceTypeFilter}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Semua jenis" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua jenis</SelectItem>
                        {deviceTypesWithCount?.map((dt: DeviceType) => (
                          <SelectItem key={dt.id} value={dt.id}>
                            {dt.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button size="sm" onClick={openCreateDeviceDialog}>
                    <Plus className="h-4 w-4 mr-1" />
                    Tambah Perangkat
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hostname</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Jenis Perangkat</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Change Log</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!devices || devices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-sm text-muted-foreground">
                        Belum ada perangkat. Tambahkan perangkat (hostname + IP) untuk
                        mengisi daftar nama perangkat di form Catat Perubahan.
                      </TableCell>
                    </TableRow>
                  ) : (
                    devices.map((device: Device) => (
                      <TableRow key={device.id}>
                        <TableCell className="font-medium">
                          {device.name}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">
                          {device.ipAddress || "-"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {device.deviceType?.name || "-"}
                        </TableCell>
                        <TableCell>
                          {device.isActive ? (
                            <Badge variant="outline" className="text-[9px] text-risk-low">
                              Aktif
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[9px] text-destructive">
                              Nonaktif
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {device._count?.changeLogs || 0}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditDeviceDialog(device)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => handleDeleteDevice(device)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* LDAP Tab */}
      {tab === "ldap" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Konfigurasi LDAP</CardTitle>
            <CardDescription>
              Integrasi dengan Active Directory / LDAP server
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-md">
              <div>
                <Label htmlFor="ldapEnabled" className="text-sm font-medium">
                  Aktifkan Autentikasi LDAP
                </Label>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Jika aktif, user dengan LDAP DN akan login via LDAP
                </p>
              </div>
              <Switch
                id="ldapEnabled"
                checked={ldapEnabled}
                onCheckedChange={setLdapEnabled}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="ldapUrl">LDAP URL</Label>
                <Input
                  id="ldapUrl"
                  value={ldapUrl}
                  onChange={(e) => setLdapUrl(e.target.value)}
                  placeholder="ldap://server.company.com:389"
                  disabled={!ldapEnabled}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ldapBindDn">Bind DN</Label>
                <Input
                  id="ldapBindDn"
                  value={ldapBindDn}
                  onChange={(e) => setLdapBindDn(e.target.value)}
                  placeholder="CN=admin,OU=Users,DC=company,DC=com"
                  disabled={!ldapEnabled}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ldapBindPassword">Bind Password</Label>
                <Input
                  id="ldapBindPassword"
                  type="password"
                  value={ldapBindPassword}
                  onChange={(e) => setLdapBindPassword(e.target.value)}
                  placeholder="********"
                  disabled={!ldapEnabled}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="ldapSearchBase">Search Base</Label>
                <Input
                  id="ldapSearchBase"
                  value={ldapSearchBase}
                  onChange={(e) => setLdapSearchBase(e.target.value)}
                  placeholder="OU=Users,DC=company,DC=com"
                  disabled={!ldapEnabled}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="ldapSearchFilter">Search Filter</Label>
                <Input
                  id="ldapSearchFilter"
                  value={ldapSearchFilter}
                  onChange={(e) => setLdapSearchFilter(e.target.value)}
                  placeholder="(sAMAccountName={username})"
                  disabled={!ldapEnabled}
                />
                <p className="text-[10px] text-muted-foreground">
                  Gunakan <code>{"{username}"}</code> sebagai placeholder untuk
                  email/username
                </p>
              </div>
            </div>
            <Button onClick={handleSaveLdap} disabled={savingLdap}>
              {savingLdap ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Simpan Konfigurasi LDAP
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Password Policy Tab */}
      {tab === "password" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Password Policy</CardTitle>
            <CardDescription>
              Aturan password untuk user baru dan reset password
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="minLength">Panjang Minimal</Label>
              <Input
                id="minLength"
                type="number"
                min="6"
                max="128"
                value={minLength}
                onChange={(e) => setMinLength(e.target.value)}
                className="w-32"
              />
            </div>
            <div className="space-y-3">
              {[
                { label: "Wajib huruf besar", value: requireUppercase, set: setRequireUppercase },
                { label: "Wajib huruf kecil", value: requireLowercase, set: setRequireLowercase },
                { label: "Wajib angka", value: requireNumber, set: setRequireNumber },
                { label: "Wajib simbol", value: requireSymbol, set: setRequireSymbol },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-md"
                >
                  <Label className="text-sm font-medium cursor-pointer">
                    {item.label}
                  </Label>
                  <Switch
                    checked={item.value}
                    onCheckedChange={item.set}
                  />
                </div>
              ))}
            </div>
            <Button onClick={handleSavePassword} disabled={savingPassword}>
              {savingPassword ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Simpan Password Policy
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create Device Type Dialog */}
      <Dialog open={showCreateDevice} onOpenChange={setShowCreateDevice}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Jenis Perangkat</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Nama</Label>
              <Input
                value={newDeviceName}
                onChange={(e) => setNewDeviceName(e.target.value)}
                placeholder="Misal: Firewall, Network, Server"
              />
            </div>
            <div className="space-y-2">
              <Label>Deskripsi (opsional)</Label>
              <Input
                value={newDeviceDesc}
                onChange={(e) => setNewDeviceDesc(e.target.value)}
                placeholder="Deskripsi singkat"
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              Jenis perangkat adalah kategori umum. IP Address diisi pada level
              perangkat (hostname), bukan di sini.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDevice(false)}
              disabled={creatingDevice}
            >
              Batal
            </Button>
            <Button onClick={handleCreateDeviceType} disabled={creatingDevice}>
              {creatingDevice ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Tambah
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Device Dialog */}
      <Dialog open={showDeviceDialog} onOpenChange={setShowDeviceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingDevice ? "Edit Perangkat" : "Tambah Perangkat"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Jenis Perangkat</Label>
              <Select value={deviceFormType} onValueChange={setDeviceFormType}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih jenis perangkat" />
                </SelectTrigger>
                <SelectContent>
                  {deviceTypesWithCount?.map((dt: DeviceType) => (
                    <SelectItem key={dt.id} value={dt.id}>
                      {dt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Hostname</Label>
              <Input
                value={deviceFormName}
                onChange={(e) => setDeviceFormName(e.target.value)}
                placeholder="Misal: fw-01, core-sw-01, srv-app-01"
              />
              <p className="text-[10px] text-muted-foreground">
                Nama perangkat (hostname) yang akan muncul di form Catat Perubahan.
              </p>
            </div>
            <div className="space-y-2">
              <Label>IP Address (opsional)</Label>
              <Input
                value={deviceFormIp}
                onChange={(e) => setDeviceFormIp(e.target.value)}
                placeholder="10.0.0.1"
              />
              <p className="text-[10px] text-muted-foreground">
                IP otomatis terisi saat perangkat ini dipilih di form Catat Perubahan.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeviceDialog(false)}
              disabled={savingDevice}
            >
              Batal
            </Button>
            <Button onClick={handleSaveDevice} disabled={savingDevice}>
              {savingDevice ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

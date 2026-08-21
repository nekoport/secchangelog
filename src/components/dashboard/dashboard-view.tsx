"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  FileText,
  Minus,
  Plus,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ViewType } from "@/components/layout/app-shell";
import { cn } from "@/lib/utils";

interface DashboardStats {
  totalChangeLogs: number;
  thisMonth: number;
  lastMonth: number;
  byDeviceType: Array<{ deviceType: string; count: number }>;
  byRiskLevel: Record<string, number>;
  byPic: Array<{ user: { id: string; name: string }; count: number }>;
  trend30Days: Array<{ date: string; count: number }>;
  pendingDeleteRequests: number;
  recentActivity: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    timestamp: string;
    user: { id: string; name: string; email: string; role: string };
  }>;
}

const ACTION_LABELS: Record<string, string> = {
  LOGIN_SUCCESS: "Login berhasil",
  LOGIN_FAILED: "Login gagal",
  LOGOUT: "Keluar dari sistem",
  CREATE_CHANGE_LOG: "Membuat change log",
  UPDATE_CHANGE_LOG: "Memperbarui change log",
  CREATE_DELETE_REQUEST: "Mengajukan penghapusan",
  APPROVE_DELETE_REQUEST: "Menyetujui penghapusan",
  REJECT_DELETE_REQUEST: "Menolak penghapusan",
  UPLOAD_SCREENSHOT: "Mengunggah screenshot",
  DELETE_SCREENSHOT: "Menghapus screenshot",
  SOFT_DELETE_CHANGE_LOG: "Menghapus change log",
  CREATE_USER: "Membuat user",
  UPDATE_USER: "Memperbarui user",
  EXPORT_EXCEL: "Mengekspor Excel",
  EXPORT_PDF: "Mengekspor PDF",
};


function StatCard({
  code,
  label,
  value,
  detail,
  icon: Icon,
  tone = "default",
}: {
  code: string;
  label: string;
  value: string | number;
  detail: React.ReactNode;
  icon: React.ElementType;
  tone?: "default" | "warning" | "critical";
}) {
  return (
    <Card className="relative min-h-36 overflow-hidden py-0">
      <div
        className={cn(
          "absolute inset-y-0 left-0 w-0.5",
          tone === "critical"
            ? "bg-destructive"
            : tone === "warning"
              ? "bg-risk-high"
              : "bg-primary"
        )}
      />
      <CardContent className="flex h-full flex-col justify-between p-5 pl-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              {code} · {label}
            </p>
            <p className="font-data mt-3 text-3xl font-semibold tracking-[-0.04em] text-foreground">
              {value}
            </p>
          </div>
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border",
              tone === "critical"
                ? "border-destructive/25 bg-destructive/8 text-destructive"
                : tone === "warning"
                  ? "border-cyber-high/25 bg-cyber-high/8 text-risk-high"
                  : "border-primary/20 bg-primary/[0.07] text-primary"
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-5 text-xs text-muted-foreground">{detail}</div>
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-label="Memuat dashboard">
      <div className="space-y-2">
        <div className="h-3 w-32 animate-pulse rounded bg-muted" />
        <div className="h-8 w-52 animate-pulse rounded bg-muted" />
        <div className="h-4 w-72 max-w-full animate-pulse rounded bg-muted" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <Card key={item} className="h-36 animate-pulse bg-card/70" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(18rem,0.8fr)]">
        <Card className="h-[350px] animate-pulse bg-card/70" />
        <Card className="h-[350px] animate-pulse bg-card/70" />
      </div>
    </div>
  );
}

export function DashboardView({
  onNavigate,
}: {
  onNavigate: (v: ViewType, editLogId?: string) => void;
}) {
  const { data, isLoading, isError, refetch, isFetching } = useQuery<DashboardStats>({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/stats");
      if (!res.ok) throw new Error("Failed to load dashboard stats");
      const json = await res.json();
      return json.data;
    },
    refetchInterval: 60 * 1000,
  });

  if (isLoading) return <DashboardSkeleton />;

  if (isError || !data) {
    return (
      <Card className="mx-auto mt-12 max-w-xl border-destructive/25">
        <CardContent className="flex flex-col items-center px-6 py-12 text-center">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-md border border-destructive/25 bg-destructive/8 text-destructive">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <h1 className="font-display text-lg font-semibold">Dashboard belum dapat dimuat</h1>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Periksa koneksi ke server, lalu muat ulang data statistik.
          </p>
          <Button className="mt-6" variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            Muat ulang
          </Button>
        </CardContent>
      </Card>
    );
  }

  const monthDelta = data.lastMonth
    ? Math.round(((data.thisMonth - data.lastMonth) / data.lastMonth) * 100)
    : null;
  const trendData = data.trend30Days.map((item) => ({
    ...item,
    date: item.date.slice(5),
  }));

  const monthDetail = monthDelta === null ? (
    data.thisMonth > 0 ? "Aktivitas baru bulan ini" : "Belum ada perubahan bulan ini"
  ) : monthDelta > 0 ? (
    <span className="inline-flex items-center gap-1 text-primary">
      <ArrowUpRight className="h-3.5 w-3.5" /> {monthDelta}% dari bulan lalu
    </span>
  ) : monthDelta < 0 ? (
    <span className="inline-flex items-center gap-1">
      <ArrowDownRight className="h-3.5 w-3.5" /> {Math.abs(monthDelta)}% dari bulan lalu
    </span>
  ) : (
    <span className="inline-flex items-center gap-1">
      <Minus className="h-3.5 w-3.5" /> Stabil dari bulan lalu
    </span>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border/70 pb-5">
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
            Security change control
          </p>
          <h1 className="font-display mt-1 text-2xl font-semibold tracking-[-0.025em] md:text-[2rem]">
            Operational overview
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Visibilitas perubahan konfigurasi dan aktivitas terbaru.
          </p>
        </div>
        <Button onClick={() => onNavigate("new-log")}>
          <Plus className="h-4 w-4" />
          Catat perubahan
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          code="LOG-01"
          label="Total log"
          value={data.totalChangeLogs}
          detail="Seluruh perubahan tercatat"
          icon={FileText}
        />
        <StatCard
          code="LOG-02"
          label="Bulan ini"
          value={data.thisMonth}
          detail={monthDetail}
          icon={TrendingUp}
        />
        <StatCard
          code="APR-01"
          label="Pending hapus"
          value={data.pendingDeleteRequests}
          detail={data.pendingDeleteRequests > 0 ? "Menunggu persetujuan" : "Tidak ada antrean approval"}
          icon={AlertTriangle}
          tone={data.pendingDeleteRequests > 0 ? "critical" : "default"}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(18rem,0.8fr)]">
        <Card>
          <CardHeader className="border-b border-border/65 pb-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Timeline · 30D
                </p>
                <CardTitle className="font-display mt-1 text-base">Tren perubahan</CardTitle>
                <CardDescription>Volume perubahan konfigurasi per hari</CardDescription>
              </div>
              <Badge variant="outline">Auto refresh 60s</Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-5">
            <ResponsiveContainer width="100%" height={270}>
              <AreaChart data={trendData} margin={{ left: -16, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="trendColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.28} />
                    <stop offset="92%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 6" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="var(--muted-foreground)"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  interval={4}
                  tickMargin={10}
                />
                <YAxis
                  stroke="var(--muted-foreground)"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: "6px",
                    fontSize: "12px",
                    color: "var(--popover-foreground)",
                    boxShadow: "0 12px 32px rgba(0,0,0,.16)",
                  }}
                  labelStyle={{ color: "var(--muted-foreground)" }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  name="Perubahan"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  fill="url(#trendColor)"
                  activeDot={{ r: 4, fill: "var(--primary)", stroke: "var(--background)", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="border-b border-border/65 pb-5">
            <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Asset coverage
            </p>
            <CardTitle className="font-display text-base">Per jenis perangkat</CardTitle>
            <CardDescription>Total perubahan pada setiap kategori perangkat</CardDescription>
          </CardHeader>
          <CardContent className="pt-5">
            {data.byDeviceType.length === 0 ? (
              <div className="flex h-60 items-center justify-center text-sm text-muted-foreground">Belum ada data perangkat.</div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data.byDeviceType} layout="vertical" margin={{ left: 16, right: 16 }}>
                  <CartesianGrid strokeDasharray="2 6" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="deviceType" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} width={112} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: "6px",
                      fontSize: "12px",
                      color: "var(--popover-foreground)",
                    }}
                    cursor={{ fill: "var(--accent)", opacity: 0.35 }}
                  />
                  <Bar dataKey="count" name="Perubahan" fill="var(--chart-1)" radius={[0, 3, 3, 0]} maxBarSize={20} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border/65 pb-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Audit stream
                </p>
                <CardTitle className="font-display mt-1 text-base">Aktivitas terbaru</CardTitle>
                <CardDescription>Sepuluh kejadian paling baru</CardDescription>
              </div>
              <Activity className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="max-h-72 overflow-y-auto pr-1">
              {data.recentActivity.length === 0 ? (
                <div className="flex h-60 items-center justify-center text-sm text-muted-foreground">Belum ada aktivitas.</div>
              ) : (
                data.recentActivity.map((activity) => (
                  <div key={activity.id} className="group grid grid-cols-[auto_1fr_auto] items-start gap-3 border-b border-border/55 py-3.5 last:border-0">
                    <div className="mt-1 flex h-7 w-7 items-center justify-center rounded-md border border-primary/15 bg-primary/[0.06] text-primary">
                      <Activity className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs">
                        <span className="font-semibold">{activity.user.name}</span>{" "}
                        <span className="text-muted-foreground">{ACTION_LABELS[activity.action] || activity.action}</span>
                      </p>
                      <p className="mt-1 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.06em] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {new Date(activity.timestamp).toLocaleString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <Badge variant="outline" className="max-w-24 truncate">
                      {activity.entityType.replaceAll("_", " ")}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

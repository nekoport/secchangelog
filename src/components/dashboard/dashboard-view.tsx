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
  FileText,
  TrendingUp,
  Clock,
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

interface DashboardStats {
  totalChangeLogs: number;
  thisMonth: number;
  lastMonth: number;
  byDeviceType: Array<{ deviceType: string; count: number }>;
  byRiskLevel: Record<string, number>;
  byStatus: Record<string, number>;
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
  LOGOUT: "Logout",
  CREATE_CHANGE_LOG: "Membuat change log",
  UPDATE_CHANGE_LOG: "Update change log",
  CREATE_DELETE_REQUEST: "Mengajukan hapus",
  APPROVE_DELETE_REQUEST: "Approve hapus",
  REJECT_DELETE_REQUEST: "Reject hapus",
  UPLOAD_SCREENSHOT: "Upload screenshot",
  CREATE_USER: "Buat user",
  UPDATE_USER: "Update user",
  EXPORT_EXCEL: "Export Excel",
  EXPORT_PDF: "Export PDF",
};

function StatCard({
  label,
  value,
  delta,
  icon: Icon,
  variant = "default",
}: {
  label: string;
  value: string | number;
  delta?: string;
  icon: React.ElementType;
  variant?: "default" | "warning" | "critical";
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {label}
            </p>
            <p className="text-2xl font-bold tabular-nums">{value}</p>
            {delta && (
              <p className="text-xs text-muted-foreground">{delta}</p>
            )}
          </div>
          <div
            className={`h-10 w-10 shrink-0 rounded-lg flex items-center justify-center ${
              variant === "critical"
                ? "bg-risk-critical/15 text-risk-critical"
                : variant === "warning"
                ? "bg-risk-high/15 text-risk-high"
                : "bg-primary/10 text-primary"
            }`}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardView({
  onNavigate,
}: {
  onNavigate: (v: ViewType, editLogId?: string) => void;
}) {
  const { data, isLoading } = useQuery<DashboardStats>({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/stats");
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return json.data;
    },
    refetchInterval: 60 * 1000,
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Memuat statistik...</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-5 h-[100px]" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const monthDelta = data.lastMonth
    ? Math.round(((data.thisMonth - data.lastMonth) / data.lastMonth) * 100)
    : 100;

  const trendData = data.trend30Days.map((d) => ({
    ...d,
    date: d.date.slice(5), // MM-DD
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Ringkasan aktivitas perubahan konfigurasi
          </p>
        </div>
        <Button onClick={() => onNavigate("new-log")}>
          <FileText className="h-4 w-4 mr-2" />
          Catat Perubahan Baru
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard
          label="Total Change Logs"
          value={data.totalChangeLogs}
          delta="Sepanjang waktu"
          icon={FileText}
        />
        <StatCard
          label="Bulan Ini"
          value={data.thisMonth}
          delta={
            monthDelta > 0
              ? `▲ ${monthDelta}% vs bulan lalu`
              : monthDelta < 0
              ? `▼ ${Math.abs(monthDelta)}% vs bulan lalu`
              : "Sama dengan bulan lalu"
          }
          icon={TrendingUp}
        />
        <StatCard
          label="Pending Hapus"
          value={data.pendingDeleteRequests}
          delta="Butuh approval"
          icon={AlertTriangle}
          variant={data.pendingDeleteRequests > 0 ? "critical" : "default"}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4">
        {/* Trend 30 days */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tren 30 Hari Terakhir</CardTitle>
            <CardDescription>Jumlah perubahan per hari</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="trendColor" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="var(--primary)"
                      stopOpacity={0.4}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--primary)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border)"
                  opacity={0.5}
                />
                <XAxis
                  dataKey="date"
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  interval={4}
                />
                <YAxis
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    fontSize: "12px",
                    color: "var(--popover-foreground)",
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
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* By Device Type */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Per Jenis Perangkat</CardTitle>
            <CardDescription>Total perubahan per perangkat</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={data.byDeviceType}
                layout="vertical"
                margin={{ left: 20 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border)"
                  opacity={0.5}
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="deviceType"
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={120}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    fontSize: "12px",
                    color: "var(--popover-foreground)",
                  }}
                  cursor={{ fill: "var(--accent)", opacity: 0.4 }}
                />
                <Bar
                  dataKey="count"
                  fill="var(--chart-1)"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Aktivitas Terbaru</CardTitle>
            <CardDescription>10 aktivitas terakhir</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-72 overflow-y-auto pr-2">
              {data.recentActivity.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Belum ada aktivitas
                </p>
              ) : (
                data.recentActivity.map((act) => (
                  <div
                    key={act.id}
                    className="flex items-start gap-3 text-sm border-b border-border/40 pb-3 last:border-0 last:pb-0"
                  >
                    <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <Activity className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs">
                        <span className="font-semibold">{act.user.name}</span>{" "}
                        <span className="text-muted-foreground">
                          {ACTION_LABELS[act.action] || act.action}
                        </span>
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(act.timestamp).toLocaleString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[9px] uppercase">
                      {act.entityType.slice(0, 8)}
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

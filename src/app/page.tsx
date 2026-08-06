"use client";

import { useState, useEffect } from "react";
import { SessionProvider, useSession } from "next-auth/react";
import { AppShell, type ViewType } from "@/components/layout/app-shell";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { ChangeLogsView } from "@/components/change-logs/change-logs-view";
import { NewLogView } from "@/components/change-logs/new-log-view";
import { EditLogView } from "@/components/change-logs/edit-log-view";
import { DeleteRequestsView } from "@/components/change-logs/delete-requests-view";
import { AuditTrailView } from "@/components/change-logs/audit-trail-view";
import { UsersView } from "@/components/settings/users-view";
import { SettingsView } from "@/components/settings/settings-view";
import { ProfileView } from "@/components/settings/profile-view";
import { useQuery } from "@tanstack/react-query";

interface ViewState {
  view: ViewType;
  editLogId?: string;
}

function MainApp() {
  const { status } = useSession();
  const [state, setState] = useState<ViewState>({ view: "dashboard" });

  const navigate = (v: ViewType, editLogId?: string) => {
    setState({ view: v, editLogId });
  };

  // Get pending delete requests count for sidebar badge
  const { data: pendingCount } = useQuery({
    queryKey: ["pending-delete-count"],
    queryFn: async () => {
      const res = await fetch("/api/delete-requests?status=PENDING&pageSize=1");
      if (!res.ok) return 0;
      const json = await res.json();
      return json.meta?.total || 0;
    },
    enabled: status === "authenticated",
    refetchInterval: 30 * 1000,
  });

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Memuat...</div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return null;
  }

  return (
    <AppShell
      current={state.view}
      onNavigate={navigate}
      pendingDeleteCount={pendingCount || 0}
    >
      {state.view === "dashboard" && <DashboardView onNavigate={navigate} />}
      {state.view === "logs" && <ChangeLogsView onNavigate={navigate} />}
      {state.view === "new-log" && <NewLogView onNavigate={navigate} />}
      {state.view === "edit-log" && state.editLogId && (
        <EditLogView
          changeLogId={state.editLogId}
          onNavigate={navigate}
        />
      )}
      {state.view === "delete-requests" && <DeleteRequestsView />}
      {state.view === "audit-trail" && <AuditTrailView />}
      {state.view === "users" && <UsersView />}
      {state.view === "settings" && <SettingsView />}
      {state.view === "profile" && <ProfileView onNavigate={navigate} />}
    </AppShell>
  );
}

export default function Home() {
  return (
    <SessionProvider>
      <MainApp />
    </SessionProvider>
  );
}

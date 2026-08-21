"use client";

import { useState } from "react";
import { SessionProvider, signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard,
  FileText,
  FilePlus2,
  Trash2,
  History,
  Users,
  Settings,
  LogOut,
  Menu,
  Bell,
  User,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Logo } from "@/components/shared/logo";
import { usePublicSystem } from "@/hooks/use-public-system";
import type { Role } from "@/lib/constants";
import { useRouter } from "next/navigation";

export type ViewType =
  | "dashboard"
  | "logs"
  | "new-log"
  | "edit-log"
  | "delete-requests"
  | "audit-trail"
  | "users"
  | "settings"
  | "profile";

interface NavItem {
  id: ViewType;
  label: string;
  icon: React.ElementType;
  roles?: Role[];
}

const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "logs", label: "Change Logs", icon: FileText },
  { id: "new-log", label: "Catat Perubahan", icon: FilePlus2, roles: ["ENGINEER", "SUPERVISOR", "ADMIN"] },
  { id: "delete-requests", label: "Pengajuan Hapus", icon: Trash2 },
  { id: "audit-trail", label: "Audit Trail", icon: History, roles: ["SUPERVISOR", "ADMIN", "AUDITOR"] },
  { id: "users", label: "User Management", icon: Users, roles: ["ADMIN"] },
  { id: "settings", label: "Settings", icon: Settings, roles: ["ADMIN"] },
];

const NAV_GROUPS: { label: string; code: string; items: NavItem[] }[] = [
  {
    label: "Operasional",
    code: "OPS",
    items: [
      NAV_ITEMS.find((n) => n.id === "dashboard")!,
      NAV_ITEMS.find((n) => n.id === "logs")!,
      NAV_ITEMS.find((n) => n.id === "new-log")!,
    ],
  },
  {
    label: "Kontrol",
    code: "CTL",
    items: [
      NAV_ITEMS.find((n) => n.id === "delete-requests")!,
      NAV_ITEMS.find((n) => n.id === "audit-trail")!,
      NAV_ITEMS.find((n) => n.id === "users")!,
      NAV_ITEMS.find((n) => n.id === "settings")!,
    ],
  },
];

function canSee(item: NavItem, role: Role): boolean {
  return !item.roles || item.roles.includes(role);
}

function SidebarContent({
  current,
  onNavigate,
  pendingDeleteCount,
}: {
  current: ViewType;
  onNavigate: (v: ViewType, editLogId?: string) => void;
  pendingDeleteCount: number;
}) {
  const { data: session } = useSession();
  const router = useRouter();
  const role = (session?.user?.role as Role) || "ENGINEER";
  const { identity } = usePublicSystem();
  const systemName = identity?.name || "SecChangeLog";

  function handleLogout() {
    Promise.race([
      signOut({ redirect: false, callbackUrl: "/login" }).catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, 2500)),
    ]).then(() => {
      router.replace("/login");
      router.refresh();
    });
  }

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="relative border-b border-sidebar-border px-5 pb-5 pt-5">
        <div className="absolute inset-x-0 bottom-0 h-px signal-line opacity-45" />
        <div className="flex items-center gap-3.5">
          <Logo size={40} className="shrink-0" />
          <div className="min-w-0 flex-1">
            <h1 className="font-display truncate text-[15px] font-semibold tracking-[0.01em]">
              {systemName}
            </h1>
            <div className="mt-1 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-sidebar-foreground/50">
              <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" />
              Secure workspace
            </div>
          </div>
        </div>
      </div>

      <nav aria-label="Navigasi utama" className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter((item) => canSee(item, role));
          if (items.length === 0) return null;
          return (
            <div key={group.label}>
              <div className="mb-2 flex items-center gap-2 px-3 font-mono text-[9px] font-semibold uppercase tracking-[0.13em] text-sidebar-foreground/40">
                <span className="text-primary/70">{group.code}</span>
                <span className="h-px flex-1 bg-sidebar-border/70" />
                <span>{group.label}</span>
              </div>
              <div className="space-y-1">
                {items.map((item) => {
                  const Icon = item.icon;
                  const active = current === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onNavigate(item.id)}
                      title={item.label}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group relative flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/60",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/66 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <span
                        className={cn(
                          "absolute bottom-2 left-0 top-2 w-0.5 rounded-full transition-colors",
                          active ? "bg-primary shadow-[0_0_10px_var(--primary)]" : "bg-transparent"
                        )}
                      />
                      <Icon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-sidebar-foreground/45 group-hover:text-sidebar-foreground/75")} />
                      <span className="flex-1 truncate text-left">{item.label}</span>
                      {item.id === "delete-requests" && pendingDeleteCount > 0 && (
                        <Badge variant="destructive" className="min-w-5 px-1.5">
                          {pendingDeleteCount}
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3.5">
        <button
          type="button"
          onClick={() => onNavigate("profile")}
          className="flex w-full items-center gap-3 rounded-md border border-transparent p-2.5 text-left transition-colors hover:border-sidebar-border hover:bg-sidebar-accent/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/60"
        >
          <Avatar className="h-9 w-9 border border-primary/25">
            <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
              {session?.user?.name?.charAt(0)?.toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-sidebar-foreground">
              {session?.user?.name}
            </p>
            <p className="mt-0.5 truncate font-mono text-[9px] uppercase tracking-[0.08em] text-sidebar-foreground/45">
              {role}
            </p>
          </div>
          <User className="h-4 w-4 text-sidebar-foreground/35" />
        </button>
        <Button
          variant="ghost"
          size="sm"
          type="button"
          className="mt-1 w-full justify-start gap-2.5 text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-destructive"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          Keluar
        </Button>
      </div>
    </div>
  );
}

export function AppShell({
  current,
  onNavigate,
  pendingDeleteCount,
  children,
}: {
  current: ViewType;
  onNavigate: (v: ViewType, editLogId?: string) => void;
  pendingDeleteCount: number;
  children: React.ReactNode;
}) {
  const { identity } = usePublicSystem();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: session } = useSession();
  const currentLabel = NAV_ITEMS.find((n) => n.id === current)?.label || "Dashboard";

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="hidden w-[17.5rem] shrink-0 border-r border-sidebar-border md:flex">
        <SidebarContent current={current} onNavigate={onNavigate} pendingDeleteCount={pendingDeleteCount} />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[17.5rem] border-sidebar-border p-0">
          <SidebarContent
            current={current}
            onNavigate={(v) => {
              onNavigate(v);
              setMobileOpen(false);
            }}
            pendingDeleteCount={pendingDeleteCount}
          />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border/80 bg-background/88 px-4 backdrop-blur-xl md:px-7">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Buka navigasi"
          >
            <Menu className="h-4 w-4" />
          </Button>

          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-sm font-semibold tracking-[0.01em]">
              {currentLabel}
            </h2>
          </div>

          <div className="hidden items-center gap-2 rounded-md border border-border/70 bg-card/60 px-2.5 py-1.5 sm:flex">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Sesi aman
            </span>
          </div>

          {pendingDeleteCount > 0 &&
            (session?.user?.role === "SUPERVISOR" || session?.user?.role === "ADMIN") && (
              <Button
                variant="ghost"
                size="icon"
                className="relative"
                onClick={() => onNavigate("delete-requests")}
                title={`${pendingDeleteCount} pengajuan hapus menunggu`}
                aria-label={`${pendingDeleteCount} pengajuan hapus menunggu`}
              >
                <Bell className="h-4 w-4" />
                <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-destructive ring-2 ring-background" />
              </Button>
            )}

          <ThemeToggle />
        </header>

        <main className="app-canvas flex-1 overflow-y-auto">
          <div className="container mx-auto max-w-[90rem] p-4 md:p-7 lg:p-8">{children}
            <footer className="mt-8 border-t border-border/50 pt-3 text-center text-[11px] text-muted-foreground">{identity?.footerText || identity?.name || "SecChangeLog"}</footer>
          </div>
        </main>
      </div>
    </div>
  );
}

export function AppShellWithSession(props: {
  current: ViewType;
  onNavigate: (v: ViewType, editLogId?: string) => void;
  pendingDeleteCount: number;
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <AppShell {...props} />
    </SessionProvider>
  );
}

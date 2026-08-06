"use client";

import { useState, useEffect } from "react";
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
  X,
  Bell,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Logo } from "@/components/shared/logo";
import { useSystemSettings } from "@/hooks/use-system-settings";
import type { Role } from "@/lib/constants";

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
  roles?: Role[]; // if undefined, all roles
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

function canSee(item: NavItem, role: Role): boolean {
  if (!item.roles) return true;
  return item.roles.includes(role);
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
  const role = (session?.user?.role as Role) || "ENGINEER";
  const { settings } = useSystemSettings();
  const systemName = settings?.["system.name"] || "SecChangeLog";

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      {/* Logo & System Name */}
      <div className="flex items-center gap-3 p-5 border-b border-sidebar-border">
        <Logo size={36} />
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold truncate">{systemName}</h1>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Security Change Log
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {NAV_ITEMS.filter((item) => canSee(item, role)).map((item) => {
          const Icon = item.icon;
          const active = current === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                "flex items-center gap-3 w-full px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-150 group",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm glow-primary"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left truncate">{item.label}</span>
              {item.id === "delete-requests" && pendingDeleteCount > 0 && (
                <Badge
                  variant="destructive"
                  className="h-5 px-1.5 text-[10px]"
                >
                  {pendingDeleteCount}
                </Badge>
              )}
            </button>
          );
        })}
      </nav>

      {/* User Info */}
      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3 p-2 rounded-md">
          <Avatar className="h-9 w-9 border border-border">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
              {session?.user?.name?.charAt(0)?.toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate">
              {session?.user?.name}
            </p>
            <p className="text-[10px] text-muted-foreground truncate">
              {session?.user?.email}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-primary"
            onClick={() => onNavigate("profile")}
            title="Profile"
          >
            <User className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-2 flex justify-center">
          <Badge variant="outline" className="text-[10px] uppercase">
            {role}
          </Badge>
        </div>
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: session } = useSession();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 border-r border-border">
        <SidebarContent
          current={current}
          onNavigate={onNavigate}
          pendingDeleteCount={pendingDeleteCount}
        />
      </aside>

      {/* Mobile Sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 p-0">
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

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-14 shrink-0 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center gap-3 px-4 md:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-9 w-9"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-4 w-4" />
          </Button>

          <div className="flex-1">
            <h2 className="text-sm font-semibold capitalize">
              {NAV_ITEMS.find((n) => n.id === current)?.label || "Dashboard"}
            </h2>
          </div>

          {pendingDeleteCount > 0 &&
            (session?.user?.role === "SUPERVISOR" ||
              session?.user?.role === "ADMIN") && (
              <Button
                variant="ghost"
                size="icon"
                className="relative h-9 w-9"
                onClick={() => onNavigate("delete-requests")}
                title={`${pendingDeleteCount} pengajuan hapus menunggu`}
              >
                <Bell className="h-4 w-4" />
                <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive" />
              </Button>
            )}

          <ThemeToggle />
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto p-4 md:p-6 max-w-7xl">{children}</div>
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

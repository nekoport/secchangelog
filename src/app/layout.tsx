import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/providers/theme-provider";
import { QueryProvider } from "@/providers/query-provider";
import { AppIdentity } from "@/components/shared/app-identity";
import { SystemSettingService } from "@/lib/services/system-setting.service";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await SystemSettingService.getAll();
  const systemName = settings["system.name"]?.trim() || "SecChangeLog";
  return {
    title: systemName,
    description:
      "Sistem pencatatan perubahan konfigurasi perangkat cyber security dengan audit trail dan compliance reporting.",
    keywords: ["cyber security", "change management", "audit trail", "configuration", "compliance"],
    authors: [{ name: systemName }],
    icons: { icon: settings["system.faviconPath"] ? "/api/files/favicon" : "/logo.svg" },
    robots: { index: false, follow: false },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const defaultTheme = await SystemSettingService.getDefaultTheme();
  const nonce = (await headers()).get("x-nonce") || undefined;

  return (
    <html lang="id" suppressHydrationWarning>
      <body
        className="font-sans antialiased bg-background text-foreground min-h-screen"
      >
        <ThemeProvider
          attribute="class"
          defaultTheme={defaultTheme}
          enableSystem={false}
          disableTransitionOnChange
          nonce={nonce}
        >
          <QueryProvider>
            {children}
            <AppIdentity />
            <Toaster />
            <SonnerToaster position="top-right" richColors />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

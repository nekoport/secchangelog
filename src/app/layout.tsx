import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/providers/theme-provider";
import { QueryProvider } from "@/providers/query-provider";
import { AppIdentity } from "@/components/shared/app-identity";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SecChangeLog - Sistem Pencatatan Perubahan Konfigurasi",
  description:
    "Sistem pencatatan perubahan konfigurasi perangkat cyber security dengan audit trail dan compliance reporting.",
  keywords: [
    "cyber security",
    "change management",
    "audit trail",
    "configuration",
    "compliance",
  ],
  authors: [{ name: "SecChangeLog Team" }],
  robots: { index: false, follow: false }, // Internal app, no SEO
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body
        className={`${inter.variable} font-sans antialiased bg-background text-foreground min-h-screen`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
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

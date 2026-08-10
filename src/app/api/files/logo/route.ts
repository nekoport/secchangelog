import { NextResponse } from "next/server";
import { FileStorageService } from "@/lib/services/file-storage.service";
import { SystemSettingService } from "@/lib/services/system-setting.service";
import { notFound } from "@/lib/security/api-response";

// Public endpoint: serves the uploaded system logo from the filesystem.
// Works in `output: standalone` where runtime-added files under /public
// are not served by Next's static handler.
export async function GET() {
  try {
    const all = await SystemSettingService.getAll();
    const logoPath = all["system.logoPath"] || "";
    const filename = logoPath.split("?")[0].split("/").pop() || "";

    if (!filename) return notFound("Logo tidak ditemukan");

    const buffer = await FileStorageService.getLogoBuffer(filename);
    if (!buffer) return notFound("Logo tidak ditemukan");

    const contentType = filename.endsWith(".svg")
      ? "image/svg+xml"
      : filename.endsWith(".webp")
      ? "image/webp"
      : "image/png";

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(buffer.length),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return notFound("Logo tidak ditemukan");
  }
}
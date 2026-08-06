import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import {
  unauthorized,
  notFound,
  internalError,
} from "@/lib/security/api-response";
import { ExportService } from "@/lib/services/export.service";
import { SystemSettingService } from "@/lib/services/system-setting.service";
import { getClientIp } from "@/lib/security/rate-limit";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const { id } = await params;

  try {
    const systemName = await SystemSettingService.getSystemName();
    const logoPath = await SystemSettingService.getLogoPath();

    const buffer = await ExportService.exportToPdf(
      id,
      session.user.id,
      systemName,
      logoPath || undefined,
      {
        ipAddress: getClientIp(req),
        userAgent: req.headers.get("user-agent"),
      }
    );

    // Get ticket ID for filename
    const log = await ExportService.getFilteredChangeLogs({});
    const item = log.find((l) => l.id === id);
    const filename = item ? `${item.ticketId}.pdf` : "change-log.pdf";

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buffer.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "NOT_FOUND") return notFound("Change log tidak ditemukan");
    console.error("[API export/pdf]:", err);
    return internalError();
  }
}

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import {
  unauthorized,
  notFound,
  internalError,
  tooManyRequests,
} from "@/lib/security/api-response";
import { setRateLimitHeaders } from "@/lib/security/api-response";
import { ExportService } from "@/lib/services/export.service";
import { SystemSettingService } from "@/lib/services/system-setting.service";
import { getClientIp, rateLimit, getRateLimitKey } from "@/lib/security/rate-limit";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const { id } = await params;

  // Rate limit export (same as /api/export/excel)
  const ip = getClientIp(req);
  const rlKey = getRateLimitKey(ip, "export", session.user.id);
  const rl = rateLimit(rlKey, { requests: 10, windowMs: 60 * 1000 });
  if (!rl.allowed) {
    return setRateLimitHeaders(tooManyRequests(), rl);
  }

  try {
    // Resolve ticket ID for filename without scanning the whole table
    const log = await db.changeLog.findUnique({
      where: { id },
      select: { ticketId: true, isDeleted: true },
    });
    if (!log) return notFound("Change log tidak ditemukan");
    // Prevent exporting soft-deleted logs for non-ADMIN/AUDITOR
    if (
      log.isDeleted &&
      session.user.role !== "ADMIN" &&
      session.user.role !== "AUDITOR"
    ) {
      return notFound("Change log tidak ditemukan");
    }

    const systemName = await SystemSettingService.getSystemName();
    const logoPath = await SystemSettingService.getLogoPath();

    const buffer = await ExportService.exportToPdf(
      id,
      session.user.id,
      systemName,
      logoPath || undefined,
      {
        ipAddress: ip,
        userAgent: req.headers.get("user-agent"),
      }
    );

    const filename = `${log.ticketId}.pdf`;

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

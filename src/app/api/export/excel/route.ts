import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import {
  unauthorized,
  internalError,
  tooManyRequests,
} from "@/lib/security/api-response";
import { ExportService } from "@/lib/services/export.service";
import { getClientIp, rateLimit, getRateLimitKey } from "@/lib/security/rate-limit";
import { RATE_LIMITS } from "@/lib/constants";
import { setRateLimitHeaders } from "@/lib/security/api-response";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  // Rate limit export
  const ip = getClientIp(req);
  const rlKey = getRateLimitKey(ip, "export", session.user.id);
  const rl = rateLimit(rlKey, { requests: 10, windowMs: 60 * 1000 });
  if (!rl.allowed) {
    return setRateLimitHeaders(tooManyRequests(), rl);
  }

  const url = new URL(req.url);
  const filters = {
    search: url.searchParams.get("search") || undefined,
    deviceTypeId: url.searchParams.get("deviceTypeId") || undefined,
    riskLevel: url.searchParams.get("riskLevel") || undefined,
    picId: url.searchParams.get("picId") || undefined,
    changeType: url.searchParams.get("changeType") || undefined,
    from: url.searchParams.get("from") ? new Date(url.searchParams.get("from")!) : undefined,
    to: url.searchParams.get("to") ? new Date(url.searchParams.get("to")!) : undefined,
    includeDeleted:
      url.searchParams.get("includeDeleted") === "true" &&
      (session.user.role === "ADMIN" || session.user.role === "AUDITOR"),
  };

  try {
    const buffer = await ExportService.exportToExcel(
      filters,
      session.user.id,
      {
        ipAddress: ip,
        userAgent: req.headers.get("user-agent"),
      }
    );

    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `change-logs-${dateStr}.xlsx`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buffer.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[API export/excel]:", err);
    return internalError();
  }
}

import { NextResponse } from "next/server";

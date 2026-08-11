import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import {
  unauthorized,
  forbidden,
  internalError,
} from "@/lib/security/api-response";
import { db } from "@/lib/db";
import { AuditTrailService } from "@/lib/services/audit-trail.service";
import { getClientIp } from "@/lib/security/rate-limit";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  // Only supervisor+ can export all; engineer can export own
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId") || undefined;
  const action = url.searchParams.get("action") || undefined;
  const entityType = url.searchParams.get("entityType") || undefined;
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  try {
    const result = await AuditTrailService.list({
      page: 1,
      pageSize: 10000, // Export all
      userId,
      action,
      entityType,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      currentUserRole: session.user.role,
      currentUserId: session.user.id,
    });

    const items = result.items;

    // Log export
    await AuditTrailService.log({
      userId: session.user.id,
      action: "EXPORT_EXCEL",
      entityType: "AuditTrail",
      entityId: "export",
      metadata: { count: items.length },
      ipAddress: getClientIp(req),
      userAgent: req.headers.get("user-agent"),
    });

    const XLSX = await import("@e965/xlsx");

    const sheetData = items.map((item) => ({
      "Timestamp": new Date(item.timestamp).toISOString().replace("T", " ").slice(0, 19),
      "User": item.user?.name || "Unknown",
      "Email": item.user?.email || "",
      "Role": item.user?.role || "",
      "Action": item.actionText || item.action,
      "Action Code": item.action,
      "Entity Type": item.entityType,
      "Entity": item.entityLabel || item.entityId,
      "Entity ID": item.entityId,
      "IP Address": item.ipAddress || "",
      "User Agent": item.userAgent || "",
    }));

    const ws = XLSX.utils.json_to_sheet(sheetData);
    ws["!cols"] = [
      { wch: 20 }, { wch: 20 }, { wch: 25 }, { wch: 12 },
      { wch: 30 }, { wch: 24 }, { wch: 15 }, { wch: 24 }, { wch: 20 }, { wch: 15 }, { wch: 30 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Audit Trail");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `audit-trail-${dateStr}.xlsx`;

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
    console.error("[API export/audit-trail/excel]:", err);
    return internalError();
  }
}

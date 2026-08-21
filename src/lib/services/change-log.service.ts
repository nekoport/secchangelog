import { db } from "@/lib/db";
import { AuditTrailService } from "./audit-trail.service";
import type { CreateChangeLogInput, UpdateChangeLogInput } from "@/lib/validations/change-log";
import {
  canLinkScreenshot,
  canUpdateChangeLog,
  type AppRole,
} from "@/lib/security/authorization";
import { formatTicketId } from "@/lib/security/ticket-id";

async function assertScreenshotsCanBeLinked(
  screenshotIds: string[],
  targetChangeLogId: string,
  userId: string,
  userRole: AppRole
) {
  if (screenshotIds.length === 0) return;

  const screenshots = await db.screenshot.findMany({
    where: { id: { in: screenshotIds } },
    select: { id: true, uploadedById: true, changeLogId: true },
  });

  if (screenshots.length !== screenshotIds.length) {
    throw new Error("FORBIDDEN");
  }

  const authorized = screenshots.every((screenshot) =>
    canLinkScreenshot({
      role: userRole,
      userId,
      uploadedById: screenshot.uploadedById,
      currentChangeLogId: screenshot.changeLogId,
      targetChangeLogId,
    })
  );
  if (!authorized) throw new Error("FORBIDDEN");
}

export class ChangeLogService {
  static async generateTicketId(): Promise<string> {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const prefix = `SOC-${yyyy}${mm}${dd}-`;

    // Find the highest sequence for today
    const lastLog = await db.changeLog.findFirst({
      where: { ticketId: { startsWith: prefix } },
      orderBy: { ticketId: "desc" },
    });

    let nextSeq = 1;
    if (lastLog) {
      const lastSeq = parseInt(lastLog.ticketId.slice(prefix.length), 10);
      if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
    }

    return formatTicketId(now, nextSeq);
  }

  static async create(
    input: CreateChangeLogInput,
    userId: string,
    userRole: AppRole,
    requestInfo?: { ipAddress?: string | null; userAgent?: string | null }
  ) {
    const ticketId = await this.generateTicketId();
    const implementedAt = new Date(input.implementedAt);

    // Resolve device (hostname + IP) if deviceId provided
    let deviceTypeId = input.deviceTypeId;
    let deviceId: string | null = input.deviceId || null;
    let deviceName = input.deviceName;
    let deviceIp = input.deviceIp || null;
    if (deviceId) {
      const device = await db.device.findUnique({ where: { id: deviceId } });
      if (!device) {
        throw new Error("DEVICE_NOT_FOUND");
      }
      deviceTypeId = device.deviceTypeId;
      deviceName = device.name;
      deviceIp = device.ipAddress || null;
    }

    // Verify device type exists
    const deviceType = await db.deviceType.findUnique({
      where: { id: deviceTypeId },
    });
    if (!deviceType) {
      throw new Error("DEVICE_TYPE_NOT_FOUND");
    }

    await assertScreenshotsCanBeLinked(
      input.screenshotIds,
      "__new_change_log__",
      userId,
      userRole
    );

    // Use transaction to ensure atomicity
    const changeLog = await db.$transaction(async (tx) => {
      const log = await tx.changeLog.create({
        data: {
          ticketId,
          deviceTypeId,
          deviceId,
          requestor: input.requestor || null,
          deviceName,
          deviceIp,
          changeType: input.changeType,
          descriptionBefore: input.descriptionBefore,
          descriptionAfter: input.descriptionAfter,
          reason: input.reason || "",
          riskLevel: input.riskLevel || "LOW",
          picId: userId, // PIC is the creator by default
          rollbackPlan: input.rollbackPlan || null,
          implementedAt,
          createdById: userId,
        },
      });

      // Link screenshots (they were uploaded beforehand with changeLogId=null)
      if (input.screenshotIds && input.screenshotIds.length > 0) {
        const linked = await tx.screenshot.updateMany({
          where: {
            id: { in: input.screenshotIds },
            changeLogId: null,
          },
          data: { changeLogId: log.id },
        });
        if (linked.count !== input.screenshotIds.length) {
          throw new Error("FORBIDDEN");
        }
      }

      return log;
    });

    await AuditTrailService.log({
      userId,
      action: "CREATE_CHANGE_LOG",
      entityType: "ChangeLog",
      entityId: changeLog.id,
      metadata: {
        ticketId: changeLog.ticketId,
        deviceName: changeLog.deviceName,
        changeType: changeLog.changeType,
        riskLevel: changeLog.riskLevel,
      },
      ipAddress: requestInfo?.ipAddress,
      userAgent: requestInfo?.userAgent,
    });

    return changeLog;
  }

  static async list(params: {
    page: number;
    pageSize: number;
    search?: string;
    deviceTypeId?: string;
    riskLevel?: string;
    picId?: string;
    changeType?: string;
    from?: Date;
    to?: Date;
    includeDeleted?: boolean;
    sort?: string;
    currentUserRole?: string;
    currentUserId?: string;
  }) {
    const {
      page,
      pageSize,
      search,
      deviceTypeId,
      riskLevel,
      picId,
      changeType,
      from,
      to,
      includeDeleted = false,
      sort = "-createdAt",
      currentUserRole,
      currentUserId,
    } = params;

    const where: Record<string, unknown> = {};

    // Soft delete filter (admin can see deleted)
    if (!includeDeleted) {
      where.isDeleted = false;
    }

    // Search
    if (search) {
      where.OR = [
        { ticketId: { contains: search } },
        { requestor: { contains: search } },
        { deviceName: { contains: search } },
        { deviceIp: { contains: search } },
        { descriptionBefore: { contains: search } },
        { descriptionAfter: { contains: search } },
        { reason: { contains: search } },
      ];
    }

    // Filters
    if (deviceTypeId) where.deviceTypeId = deviceTypeId;
    if (riskLevel) where.riskLevel = riskLevel;
    if (picId) where.picId = picId;
    if (changeType) where.changeType = changeType;

    if (from || to) {
      const dateFilter: Record<string, Date> = {};
      if (from) dateFilter.gte = from;
      if (to) dateFilter.lte = to;
      where.implementedAt = dateFilter;
    }

    // Sort
    let orderBy: Record<string, "asc" | "desc"> = { createdAt: "desc" };
    if (sort) {
      const isDesc = sort.startsWith("-");
      const field = isDesc ? sort.slice(1) : sort;
      const validFields = [
        "createdAt",
        "updatedAt",
        "ticketId",
        "deviceName",
        "riskLevel",
        "implementedAt",
      ];
      if (validFields.includes(field)) {
        orderBy = { [field]: isDesc ? "desc" : "asc" };
      }
    }

    const [items, total] = await Promise.all([
      db.changeLog.findMany({
        where,
        include: {
          deviceType: { select: { id: true, name: true } },
          pic: { select: { id: true, name: true } },
          creator: { select: { id: true, name: true } },
          _count: { select: { screenshots: true } },
        },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.changeLog.count({ where }),
    ]);

    return {
      items,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  static async getById(id: string, options?: { includeScreenshots?: boolean }) {
    const log = await db.changeLog.findUnique({
      where: { id },
      include: {
        deviceType: { select: { id: true, name: true } },
        pic: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true } },
        screenshots: options?.includeScreenshots
          ? {
              select: {
                id: true,
                filename: true,
                originalName: true,
                mimeType: true,
                size: true,
                type: true,
                createdAt: true,
              },
            }
          : false,
        deleteRequests: {
          where: { status: "PENDING" },
          select: {
            id: true,
            status: true,
            reason: true,
            requestedBy: { select: { id: true, name: true } },
            createdAt: true,
          },
        },
      },
    });

    return log;
  }

  static async update(
    id: string,
    input: UpdateChangeLogInput,
    userId: string,
    userRole: AppRole,
    requestInfo?: { ipAddress?: string | null; userAgent?: string | null }
  ) {
    const existing = await db.changeLog.findUnique({ where: { id } });
    if (!existing) {
      throw new Error("NOT_FOUND");
    }
    if (
      !canUpdateChangeLog({
        role: userRole,
        userId,
        createdById: existing.createdById,
        isDeleted: existing.isDeleted,
      })
    ) {
      throw new Error("FORBIDDEN");
    }

    if (input.screenshotIds !== undefined) {
      await assertScreenshotsCanBeLinked(
        input.screenshotIds,
        id,
        userId,
        userRole
      );
    }

    const updateData: Record<string, unknown> = {};

    // If deviceId provided, resolve hostname/IP/type from the device record
    if (input.deviceId !== undefined) {
      if (input.deviceId) {
        const device = await db.device.findUnique({ where: { id: input.deviceId } });
        if (!device) {
          throw new Error("DEVICE_NOT_FOUND");
        }
        updateData.deviceId = device.id;
        updateData.deviceTypeId = device.deviceTypeId;
        updateData.deviceName = device.name;
        updateData.deviceIp = device.ipAddress || null;
      } else {
        updateData.deviceId = null;
      }
    }

    if (input.deviceTypeId !== undefined && input.deviceId === undefined) updateData.deviceTypeId = input.deviceTypeId;
    if (input.requestor !== undefined) updateData.requestor = input.requestor || null;
    if (input.deviceName !== undefined && input.deviceId === undefined) updateData.deviceName = input.deviceName;
    if (input.deviceIp !== undefined && input.deviceId === undefined) updateData.deviceIp = input.deviceIp || null;
    if (input.changeType !== undefined) updateData.changeType = input.changeType;
    if (input.descriptionBefore !== undefined) updateData.descriptionBefore = input.descriptionBefore;
    if (input.descriptionAfter !== undefined) updateData.descriptionAfter = input.descriptionAfter;
    if (input.reason !== undefined) updateData.reason = input.reason;
    if (input.riskLevel !== undefined) updateData.riskLevel = input.riskLevel;
    if (input.rollbackPlan !== undefined) updateData.rollbackPlan = input.rollbackPlan || null;
    if (input.implementedAt !== undefined) updateData.implementedAt = new Date(input.implementedAt);

    const updated = await db.$transaction(async (tx) => {
      const log = await tx.changeLog.update({
        where: { id },
        data: updateData,
      });

      if (input.screenshotIds !== undefined) {
        await tx.screenshot.updateMany({
          where: { changeLogId: id },
          data: { changeLogId: null },
        });
        if (input.screenshotIds.length > 0) {
          const linked = await tx.screenshot.updateMany({
            where: {
              id: { in: input.screenshotIds },
              changeLogId: null,
            },
            data: { changeLogId: id },
          });
          if (linked.count !== input.screenshotIds.length) {
            throw new Error("FORBIDDEN");
          }
        }
      }

      return log;
    });

    await AuditTrailService.log({
      userId,
      action: "UPDATE_CHANGE_LOG",
      entityType: "ChangeLog",
      entityId: id,
      metadata: { ticketId: existing.ticketId, fields: Object.keys(updateData) },
      ipAddress: requestInfo?.ipAddress,
      userAgent: requestInfo?.userAgent,
    });

    return updated;
  }

  static async softDelete(
    id: string,
    userId: string,
    requestInfo?: { ipAddress?: string | null; userAgent?: string | null }
  ) {
    const updated = await db.changeLog.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    await AuditTrailService.log({
      userId,
      action: "SOFT_DELETE_CHANGE_LOG",
      entityType: "ChangeLog",
      entityId: id,
      metadata: { ticketId: updated.ticketId },
      ipAddress: requestInfo?.ipAddress,
      userAgent: requestInfo?.userAgent,
    });

    return updated;
  }

  static async restore(
    id: string,
    userId: string,
    requestInfo?: { ipAddress?: string | null; userAgent?: string | null }
  ) {
    const updated = await db.changeLog.update({
      where: { id },
      data: {
        isDeleted: false,
        deletedAt: null,
      },
    });

    await AuditTrailService.log({
      userId,
      action: "RESTORE_CHANGE_LOG",
      entityType: "ChangeLog",
      entityId: id,
      metadata: { ticketId: updated.ticketId },
      ipAddress: requestInfo?.ipAddress,
      userAgent: requestInfo?.userAgent,
    });

    return updated;
  }

  static async getStats() {
    const [
      total,
      thisMonth,
      lastMonth,
      byDeviceType,
      byRiskLevel,
      byPic,
      last30Days,
      pendingDeleteCount,
    ] = await Promise.all([
      db.changeLog.count({ where: { isDeleted: false } }),
      db.changeLog.count({
        where: {
          isDeleted: false,
          implementedAt: {
            gte: new Date(new Date().setDate(1)),
            lt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
          },
        },
      }),
      db.changeLog.count({
        where: {
          isDeleted: false,
          implementedAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1),
            lt: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      }),
      db.changeLog.groupBy({
        by: ["deviceTypeId"],
        where: { isDeleted: false },
        _count: true,
      }),
      db.changeLog.groupBy({
        by: ["riskLevel"],
        where: { isDeleted: false },
        _count: true,
      }),
      db.changeLog.groupBy({
        by: ["picId"],
        where: { isDeleted: false },
        _count: true,
        orderBy: { _count: { picId: "desc" } },
        take: 5,
      }),
      db.changeLog.findMany({
        where: {
          isDeleted: false,
          implementedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
        select: { implementedAt: true },
      }),
      db.deleteRequest.count({ where: { status: "PENDING" } }),
    ]);

    // Enrich byDeviceType with names
    const deviceTypeIds = byDeviceType.map((b) => b.deviceTypeId);
    const deviceTypes = await db.deviceType.findMany({
      where: { id: { in: deviceTypeIds } },
      select: { id: true, name: true },
    });
    const deviceTypeMap = new Map(deviceTypes.map((d) => [d.id, d.name]));

    const byDeviceTypeWithNames = byDeviceType.map((b) => ({
      deviceType: deviceTypeMap.get(b.deviceTypeId) || "Unknown",
      count: b._count,
    }));

    // Enrich byPic with names
    const picIds = byPic.map((b) => b.picId);
    const pics = await db.user.findMany({
      where: { id: { in: picIds } },
      select: { id: true, name: true },
    });
    const picMap = new Map(pics.map((p) => [p.id, p.name]));

    const byPicWithNames = byPic.map((b) => ({
      user: { id: b.picId, name: picMap.get(b.picId) || "Unknown" },
      count: b._count,
    }));

    // Group last 30 days by date
    const trend30Days: Array<{ date: string; count: number }> = [];
    const dateMap = new Map<string, number>();
    for (const log of last30Days) {
      const dateStr = log.implementedAt.toISOString().slice(0, 10);
      dateMap.set(dateStr, (dateMap.get(dateStr) || 0) + 1);
    }
    // Fill missing days
    for (let i = 29; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().slice(0, 10);
      trend30Days.push({ date: dateStr, count: dateMap.get(dateStr) || 0 });
    }

    // Format byRiskLevel as object
    const riskLevelMap: Record<string, number> = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0,
    };
    for (const b of byRiskLevel) riskLevelMap[b.riskLevel] = b._count;

    return {
      totalChangeLogs: total,
      thisMonth,
      lastMonth,
      byDeviceType: byDeviceTypeWithNames,
      byRiskLevel: riskLevelMap,
      byPic: byPicWithNames,
      trend30Days,
      pendingDeleteRequests: pendingDeleteCount,
    };
  }
}

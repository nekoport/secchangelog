import { db } from "@/lib/db";
import { AuditTrailService } from "./audit-trail.service";
import { ChangeLogService } from "./change-log.service";

export class DeleteRequestService {
  static async create(
    changeLogId: string,
    reason: string,
    userId: string,
    userRole: string,
    requestInfo?: { ipAddress?: string | null; userAgent?: string | null }
  ) {
    const changeLog = await db.changeLog.findUnique({
      where: { id: changeLogId },
    });
    if (!changeLog) throw new Error("CHANGE_LOG_NOT_FOUND");
    if (changeLog.isDeleted) throw new Error("ALREADY_DELETED");

    // Check existing pending request
    const existingPending = await db.deleteRequest.findFirst({
      where: { changeLogId, status: "PENDING" },
    });
    if (existingPending) throw new Error("PENDING_REQUEST_EXISTS");

    // Only creator, supervisor, or admin can request delete
    if (
      changeLog.createdById !== userId &&
      userRole !== "SUPERVISOR" &&
      userRole !== "ADMIN"
    ) {
      throw new Error("FORBIDDEN");
    }

    const deleteRequest = await db.deleteRequest.create({
      data: {
        changeLogId,
        requestedById: userId,
        reason,
        status: "PENDING",
      },
      include: {
        changeLog: {
          select: {
            id: true,
            ticketId: true,
            deviceName: true,
          },
        },
        requestedBy: { select: { id: true, name: true, email: true } },
      },
    });

    await AuditTrailService.log({
      userId,
      action: "CREATE_DELETE_REQUEST",
      entityType: "DeleteRequest",
      entityId: deleteRequest.id,
      metadata: {
        changeLogId,
        ticketId: changeLog.ticketId,
        reason,
      },
      ipAddress: requestInfo?.ipAddress,
      userAgent: requestInfo?.userAgent,
    });

    return deleteRequest;
  }

  static async list(params: {
    page: number;
    pageSize: number;
    status?: string;
    requestedById?: string;
    currentUserRole?: string;
    currentUserId?: string;
  }) {
    const where: Record<string, unknown> = {};
    if (params.status) where.status = params.status;
    if (params.requestedById) where.requestedById = params.requestedById;

    // Engineers see only their own requests
    if (params.currentUserRole === "ENGINEER") {
      where.requestedById = params.currentUserId;
    }

    const [items, total] = await Promise.all([
      db.deleteRequest.findMany({
        where,
        include: {
          changeLog: {
            select: {
              id: true,
              ticketId: true,
              deviceName: true,
              riskLevel: true,
              isDeleted: true,
            },
          },
          requestedBy: { select: { id: true, name: true } },
          approvedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      db.deleteRequest.count({ where }),
    ]);

    return {
      items,
      meta: {
        page: params.page,
        pageSize: params.pageSize,
        total,
        totalPages: Math.ceil(total / params.pageSize),
      },
    };
  }

  static async approve(
    id: string,
    note: string | undefined,
    userId: string,
    userRole: string,
    requestInfo?: { ipAddress?: string | null; userAgent?: string | null }
  ) {
    if (userRole !== "SUPERVISOR" && userRole !== "ADMIN") {
      throw new Error("FORBIDDEN");
    }

    const dr = await db.deleteRequest.findUnique({ where: { id } });
    if (!dr) throw new Error("NOT_FOUND");
    if (dr.status !== "PENDING") throw new Error("ALREADY_PROCESSED");

    // Transaction: update request + soft delete change log
    const [updated, _] = await db.$transaction([
      db.deleteRequest.update({
        where: { id },
        data: {
          status: "APPROVED",
          approvedById: userId,
          approvedAt: new Date(),
          approverNote: note || null,
        },
      }),
      db.changeLog.update({
        where: { id: dr.changeLogId },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
        },
      }),
    ]);

    await AuditTrailService.log({
      userId,
      action: "APPROVE_DELETE_REQUEST",
      entityType: "DeleteRequest",
      entityId: id,
      metadata: {
        changeLogId: dr.changeLogId,
        note,
      },
      ipAddress: requestInfo?.ipAddress,
      userAgent: requestInfo?.userAgent,
    });

    await AuditTrailService.log({
      userId,
      action: "SOFT_DELETE_CHANGE_LOG",
      entityType: "ChangeLog",
      entityId: dr.changeLogId,
      metadata: { via: "delete_request", requestId: id },
      ipAddress: requestInfo?.ipAddress,
      userAgent: requestInfo?.userAgent,
    });

    return updated;
  }

  static async reject(
    id: string,
    note: string | undefined,
    userId: string,
    userRole: string,
    requestInfo?: { ipAddress?: string | null; userAgent?: string | null }
  ) {
    if (userRole !== "SUPERVISOR" && userRole !== "ADMIN") {
      throw new Error("FORBIDDEN");
    }

    const dr = await db.deleteRequest.findUnique({ where: { id } });
    if (!dr) throw new Error("NOT_FOUND");
    if (dr.status !== "PENDING") throw new Error("ALREADY_PROCESSED");

    const updated = await db.deleteRequest.update({
      where: { id },
      data: {
        status: "REJECTED",
        approvedById: userId,
        approvedAt: new Date(),
        approverNote: note || null,
      },
    });

    await AuditTrailService.log({
      userId,
      action: "REJECT_DELETE_REQUEST",
      entityType: "DeleteRequest",
      entityId: id,
      metadata: {
        changeLogId: dr.changeLogId,
        note,
      },
      ipAddress: requestInfo?.ipAddress,
      userAgent: requestInfo?.userAgent,
    });

    return updated;
  }
}

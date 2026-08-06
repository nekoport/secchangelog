import { db } from "@/lib/db";
import type { AuditAction } from "@/lib/constants";

interface AuditLogParams {
  userId: string;
  action: AuditAction | string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export class AuditTrailService {
  static async log(params: AuditLogParams) {
    try {
      await db.auditTrail.create({
        data: {
          userId: params.userId,
          action: params.action,
          entityType: params.entityType,
          entityId: params.entityId,
          metadata: JSON.stringify(params.metadata || {}),
          ipAddress: params.ipAddress || null,
          userAgent: params.userAgent || null,
        },
      });
    } catch (error) {
      // Don't fail the main operation if audit trail fails
      console.error("[AuditTrail] Failed to log:", error);
    }
  }

  static async list(params: {
    page: number;
    pageSize: number;
    userId?: string;
    action?: string;
    entityType?: string;
    entityId?: string;
    from?: Date;
    to?: Date;
    currentUserRole?: string;
    currentUserId?: string;
  }) {
    const where: Record<string, unknown> = {};

    // Engineers only see their own audit trail
    if (
      params.currentUserRole === "ENGINEER" ||
      params.currentUserRole === "AUDITOR"
    ) {
      where.userId = params.currentUserId;
    } else if (params.userId) {
      where.userId = params.userId;
    }

    if (params.action) where.action = params.action;
    if (params.entityType) where.entityType = params.entityType;
    if (params.entityId) where.entityId = params.entityId;

    if (params.from || params.to) {
      const timestampFilter: Record<string, Date> = {};
      if (params.from) timestampFilter.gte = params.from;
      if (params.to) timestampFilter.lte = params.to;
      where.timestamp = timestampFilter;
    }

    const [items, total] = await Promise.all([
      db.auditTrail.findMany({
        where,
        include: {
          user: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
        orderBy: { timestamp: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      db.auditTrail.count({ where }),
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
}

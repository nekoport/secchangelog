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

interface AuditListItem {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: string;
  ipAddress: string | null;
  userAgent: string | null;
  timestamp: Date;
  user: { id: string; name: string; email: string; role: string } | null;
}

export interface EnrichedAuditItem extends AuditListItem {
  actionText: string;
  entityLabel: string;
}

function parseMeta(metadata: string): Record<string, unknown> {
  try {
    const v = JSON.parse(metadata);
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function fmt(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function firstNonEmpty(...vals: (string | undefined)[]): string | undefined {
  return vals.find((v) => v && v.trim().length > 0);
}

function shortId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 12)}...` : id;
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
  }): Promise<{ items: EnrichedAuditItem[]; meta: { page: number; pageSize: number; total: number; totalPages: number } }> {
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
      items: await this.enrich(items as AuditListItem[]),
      meta: {
        page: params.page,
        pageSize: params.pageSize,
        total,
        totalPages: Math.ceil(total / params.pageSize),
      },
    };
  }

  // =====================================================
  // Human-readable labels for the audit trail UI & exports
  // =====================================================

  private static async enrich(items: AuditListItem[]): Promise<EnrichedAuditItem[]> {
    if (items.length === 0) return [];

    const metas = items.map((it) => parseMeta(it.metadata));

    const changeLogIds = new Set<string>();
    const deleteRequestIds = new Set<string>();
    const screenshotIds = new Set<string>();
    const userIds = new Set<string>();
    const deviceTypeIds = new Set<string>();
    const deviceIds = new Set<string>();

    items.forEach((it, index) => {
      const m = metas[index];
      const push = (set: Set<string>, v: unknown) => {
        if (typeof v === "string" && v) set.add(v);
      };

      if (it.entityType === "ChangeLog") changeLogIds.add(it.entityId);
      if (it.entityType === "DeleteRequest") deleteRequestIds.add(it.entityId);
      if (it.entityType === "Screenshot") screenshotIds.add(it.entityId);
      if (it.entityType === "User") userIds.add(it.entityId);
      if (it.entityType === "DeviceType") deviceTypeIds.add(it.entityId);
      if (it.entityType === "Device") deviceIds.add(it.entityId);

      push(changeLogIds, m.changeLogId);
      push(deleteRequestIds, m.requestId);
    });

    const [changeLogs, deleteRequests, screenshots, users, deviceTypes, devices] =
      await Promise.all([
        changeLogIds.size
          ? db.changeLog.findMany({
              where: { id: { in: [...changeLogIds] } },
              select: { id: true, ticketId: true },
            })
          : Promise.resolve<{ id: string; ticketId: string }[]>([]),
        deleteRequestIds.size
          ? db.deleteRequest.findMany({
              where: { id: { in: [...deleteRequestIds] } },
              include: { changeLog: { select: { ticketId: true } } },
            })
          : Promise.resolve<{ id: string; changeLog: { ticketId: string } }[]>([]),
        screenshotIds.size
          ? db.screenshot.findMany({
              where: { id: { in: [...screenshotIds] } },
              select: { id: true, originalName: true },
            })
          : Promise.resolve<{ id: string; originalName: string }[]>([]),
        userIds.size
          ? db.user.findMany({
              where: { id: { in: [...userIds] } },
              select: { id: true, email: true, name: true },
            })
          : Promise.resolve<{ id: string; email: string; name: string }[]>([]),
        deviceTypeIds.size
          ? db.deviceType.findMany({
              where: { id: { in: [...deviceTypeIds] } },
              select: { id: true, name: true },
            })
          : Promise.resolve<{ id: string; name: string }[]>([]),
        deviceIds.size
          ? db.device.findMany({
              where: { id: { in: [...deviceIds] } },
              select: { id: true, name: true },
            })
          : Promise.resolve<{ id: string; name: string }[]>([]),
      ]);

    const ticketByChangeLog = new Map(changeLogs.map((r) => [r.id, r.ticketId]));
    const ticketByDeleteRequest = new Map(
      deleteRequests.map((r) => [r.id, r.changeLog.ticketId])
    );
    const originalNameByScreenshot = new Map(
      screenshots.map((r) => [r.id, r.originalName])
    );
    const emailByUser = new Map(users.map((r) => [r.id, r.email]));
    const nameByUser = new Map(users.map((r) => [r.id, r.name]));
    const nameByDeviceType = new Map(deviceTypes.map((r) => [r.id, r.name]));
    const nameByDevice = new Map(devices.map((r) => [r.id, r.name]));

    return items.map((it, index) => {
      const m = metas[index];

      const ticket = firstNonEmpty(
        fmt(m.ticketId),
        it.entityType === "ChangeLog" ? ticketByChangeLog.get(it.entityId) : undefined,
        it.entityType === "DeleteRequest"
          ? ticketByDeleteRequest.get(it.entityId)
          : undefined,
        ticketByChangeLog.get(fmt(m.changeLogId))
      );

      return {
        ...it,
        actionText: this.toActionText(it.action, m, ticket),
        entityLabel: this.toEntityLabel(it, m, ticket, {
          originalNameByScreenshot,
          emailByUser,
          nameByUser,
          nameByDeviceType,
          nameByDevice,
        }),
      };
    });
  }

  private static toActionText(
    action: string,
    m: Record<string, unknown>,
    ticket: string | undefined
  ): string {
    const suffix = ticket ? ` ${ticket}` : "";
    switch (action) {
      case "LOGIN_SUCCESS":
        return "Login berhasil";
      case "LOGIN_FAILED":
        return "Login gagal";
      case "LOGOUT":
        return "Logout";
      case "ACCOUNT_LOCKED":
        return "Akun terkunci";
      case "CREATE_CHANGE_LOG":
        return `Membuat change log${suffix}`;
      case "VIEW_CHANGE_LOG":
        return `Lihat change log${suffix}`;
      case "UPDATE_CHANGE_LOG":
        return `Update change log${suffix}`;
      case "VERIFY_CHANGE_LOG":
        return `Verifikasi change log${suffix}`;
      case "CREATE_DELETE_REQUEST":
        return `Ajukan hapus${suffix}`;
      case "APPROVE_DELETE_REQUEST":
        return `Approve hapus${suffix}`;
      case "REJECT_DELETE_REQUEST":
        return `Reject hapus${suffix}`;
      case "SOFT_DELETE_CHANGE_LOG":
        return `Soft delete${suffix}`;
      case "RESTORE_CHANGE_LOG":
        return `Restore${suffix}`;
      case "UPLOAD_SCREENSHOT": {
        const f = firstNonEmpty(fmt(m.originalName), fmt(m.filename));
        return f ? `Upload screenshot ${f}` : "Upload screenshot";
      }
      case "DELETE_SCREENSHOT": {
        const f = firstNonEmpty(fmt(m.originalName), fmt(m.filename));
        return f ? `Hapus screenshot ${f}` : "Hapus screenshot";
      }
      case "CREATE_USER": {
        const who = firstNonEmpty(fmt(m.email), fmt(m.username), fmt(m.name));
        return who ? `Buat user ${who}` : "Buat user";
      }
      case "UPDATE_USER":
        return "Update user";
      case "DEACTIVATE_USER": {
        const who = firstNonEmpty(fmt(m.email), fmt(m.username), fmt(m.name));
        return who ? `Nonaktifkan user ${who}` : "Nonaktifkan user";
      }
      case "ACTIVATE_USER": {
        const who = firstNonEmpty(fmt(m.email), fmt(m.username), fmt(m.name));
        return who ? `Aktifkan user ${who}` : "Aktifkan user";
      }
      case "CREATE_DEVICE_TYPE":
        return fmt(m.name) ? `Buat device type ${fmt(m.name)}` : "Buat device type";
      case "UPDATE_DEVICE_TYPE":
        return "Update device type";
      case "DEACTIVATE_DEVICE_TYPE":
        return "Nonaktifkan device type";
      case "CREATE_DEVICE":
        return fmt(m.name) ? `Buat perangkat ${fmt(m.name)}` : "Buat perangkat";
      case "UPDATE_DEVICE":
        return "Update perangkat";
      case "DEACTIVATE_DEVICE":
        return fmt(m.name)
          ? `Nonaktifkan perangkat ${fmt(m.name)}`
          : "Nonaktifkan perangkat";
      case "UPDATE_SYSTEM_SETTING": {
        const keys = Array.isArray(m.keys)
          ? m.keys.map(String).join(", ")
          : fmt(m.keys);
        return keys ? `Update setting: ${keys}` : "Update setting";
      }
      case "UPDATE_SYSTEM_LOGO":
        return m.action === "reset" ? "Reset logo sistem" : "Update logo sistem";
      case "UPDATE_SYSTEM_FAVICON":
        return m.action === "reset"
          ? "Reset favicon sistem"
          : "Update favicon sistem";
      case "EXPORT_EXCEL": {
        const count = m.count;
        return typeof count === "number"
          ? `Export Excel (${count} baris)`
          : "Export Excel";
      }
      case "EXPORT_PDF":
        return `Export PDF${suffix}`;
      case "CHANGE_THEME":
        return "Ganti tema";
      case "NTP_SYNC": {
        const offset = m.offsetMs;
        return typeof offset === "number"
          ? `Sync waktu (offset ${Math.round(offset)}ms)`
          : "Sync waktu NTP";
      }
      case "UPDATE_NTP_SETTING":
        return "Update setting: ntp";
      case "CREATE_DATABASE_BACKUP":
        return fmt(m.filename)
          ? `Membuat backup database (${fmt(m.filename)})`
          : "Membuat backup database";
      case "DOWNLOAD_DATABASE_BACKUP":
        return `Download backup database (${fmt(m.filename)})`;
      case "DELETE_DATABASE_BACKUP":
        return `Menghapus backup database (${fmt(m.filename)})`;
      default:
        return action;
    }
  }

  private static toEntityLabel(
    it: AuditListItem,
    m: Record<string, unknown>,
    ticket: string | undefined,
    maps: {
      originalNameByScreenshot: Map<string, string>;
      emailByUser: Map<string, string>;
      nameByUser: Map<string, string>;
      nameByDeviceType: Map<string, string>;
      nameByDevice: Map<string, string>;
    }
  ): string {
    switch (it.entityType) {
      case "ChangeLog":
        return ticket || shortId(it.entityId);
      case "DeleteRequest":
        return ticket ? `Ticket ${ticket}` : shortId(it.entityId);
      case "Screenshot":
        return (
          firstNonEmpty(
            fmt(m.originalName),
            fmt(m.filename),
            maps.originalNameByScreenshot.get(it.entityId)
          ) || shortId(it.entityId)
        );
      case "User":
        return (
          firstNonEmpty(
            fmt(m.email),
            fmt(m.username),
            fmt(m.name),
            maps.emailByUser.get(it.entityId),
            maps.nameByUser.get(it.entityId)
          ) || shortId(it.entityId)
        );
      case "DeviceType":
        return (
          firstNonEmpty(fmt(m.name), maps.nameByDeviceType.get(it.entityId)) ||
          shortId(it.entityId)
        );
      case "Device":
        return (
          firstNonEmpty(fmt(m.name), maps.nameByDevice.get(it.entityId)) ||
          shortId(it.entityId)
        );
      case "SystemSetting":
        return it.entityId || shortId(it.entityId);
      default:
        return shortId(it.entityId);
    }
  }
}
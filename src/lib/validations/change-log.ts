import { z } from "zod";
import {
  CHANGE_TYPES,
  RISK_LEVELS,
  CHANGE_LOG_STATUS,
  SCREENSHOT_TYPES,
} from "../constants";

export const createChangeLogSchema = z.object({
  deviceTypeId: z.string().min(1, "Jenis perangkat wajib dipilih"),
  deviceName: z
    .string()
    .min(1, "Nama perangkat wajib diisi")
    .max(100, "Nama perangkat maksimal 100 karakter"),
  deviceIp: z
    .string()
    .max(45)
    .optional()
    .or(z.literal("")),
  changeType: z.enum(CHANGE_TYPES, {
    message: "Jenis perubahan tidak valid",
  }),
  descriptionBefore: z
    .string()
    .min(10, "Deskripsi kondisi sebelum minimal 10 karakter")
    .max(5000, "Deskripsi maksimal 5000 karakter"),
  descriptionAfter: z
    .string()
    .min(10, "Deskripsi kondisi setelah minimal 10 karakter")
    .max(5000, "Deskripsi maksimal 5000 karakter"),
  reason: z
    .string()
    .min(10, "Alasan perubahan minimal 10 karakter")
    .max(2000, "Alasan maksimal 2000 karakter"),
  riskLevel: z.enum(
    Object.keys(RISK_LEVELS) as [string, ...string[]],
    { message: "Risk level tidak valid" }
  ),
  status: z
    .enum(Object.keys(CHANGE_LOG_STATUS) as [string, ...string[]])
    .optional()
    .default("IMPLEMENTED"),
  rollbackPlan: z
    .string()
    .max(2000, "Rollback plan maksimal 2000 karakter")
    .optional()
    .or(z.literal("")),
  implementedAt: z.string().min(1, "Waktu implementasi wajib diisi"),
  screenshotIds: z
    .array(z.string().min(1))
    .max(10, "Maksimal 10 screenshot")
    .optional()
    .default([]),
});

export type CreateChangeLogInput = z.infer<typeof createChangeLogSchema>;

export const updateChangeLogSchema = createChangeLogSchema.partial().extend({
  screenshotIds: z.array(z.string().min(1)).max(10).optional(),
});

export type UpdateChangeLogInput = z.infer<typeof updateChangeLogSchema>;

export const listChangeLogsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(200).optional(),
  deviceTypeId: z.string().optional(),
  riskLevel: z.string().optional(),
  status: z.string().optional(),
  picId: z.string().optional(),
  changeType: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  includeDeleted: z.coerce.boolean().default(false),
  sort: z.string().default("-createdAt"),
});

export type ListChangeLogsQuery = z.infer<typeof listChangeLogsQuerySchema>;

export const screenshotTypeSchema = z.enum(
  Object.keys(SCREENSHOT_TYPES) as [string, ...string[]]
);

import { z } from "zod";

export const updateSettingsSchema = z.object({
  "system.name": z.string().min(1).max(100).optional(),
  "system.footerText": z.string().max(200).optional(),
  "system.defaultTheme": z.enum(["light", "dark"]).optional(),
  "ldap.enabled": z.enum(["true", "false"]).optional(),
  "ldap.url": z.string().max(255).optional().or(z.literal("")),
  "ldap.bindDn": z.string().max(255).optional().or(z.literal("")),
  "ldap.bindPassword": z.string().max(255).optional().or(z.literal("")),
  "ldap.searchBase": z.string().max(255).optional().or(z.literal("")),
  "ldap.searchFilter": z.string().max(255).optional().or(z.literal("")),
  "password.minLength": z.string().optional(),
  "password.requireUppercase": z.enum(["true", "false"]).optional(),
  "password.requireLowercase": z.enum(["true", "false"]).optional(),
  "password.requireNumber": z.enum(["true", "false"]).optional(),
  "password.requireSymbol": z.enum(["true", "false"]).optional(),
  "upload.maxFileSizeMb": z.string().optional(),
  "session.timeoutHours": z.string().optional(),
  "ntp.server": z.string().max(255).optional().or(z.literal("")),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

export const createDeviceTypeSchema = z.object({
  name: z.string().min(1, "Nama wajib diisi").max(100),
  description: z.string().max(500).optional().or(z.literal("")),
});

export type CreateDeviceTypeInput = z.infer<typeof createDeviceTypeSchema>;

export const updateDeviceTypeSchema = createDeviceTypeSchema.partial();

export type UpdateDeviceTypeInput = z.infer<typeof updateDeviceTypeSchema>;

export const createDeviceSchema = z.object({
  deviceTypeId: z.string().min(1, "Jenis perangkat wajib dipilih"),
  name: z.string().min(1, "Hostname wajib diisi").max(100),
  ipAddress: z.string().max(45).optional().or(z.literal("")),
});

export type CreateDeviceInput = z.infer<typeof createDeviceSchema>;

export const updateDeviceSchema = createDeviceSchema.partial();

export type UpdateDeviceInput = z.infer<typeof updateDeviceSchema>;

export const createDeleteRequestSchema = z.object({
  changeLogId: z.string().min(1, "Change log ID wajib diisi"),
  reason: z
    .string()
    .min(10, "Alasan penghapusan minimal 10 karakter")
    .max(1000, "Alasan maksimal 1000 karakter"),
});

export type CreateDeleteRequestInput = z.infer<typeof createDeleteRequestSchema>;

export const approveDeleteRequestSchema = z.object({
  note: z.string().max(500).optional().or(z.literal("")),
});

export type ApproveDeleteRequestInput = z.infer<typeof approveDeleteRequestSchema>;

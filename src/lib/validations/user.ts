import { z } from "zod";

const passwordSchema = z
  .string()
  .min(10, "Password minimal 10 karakter")
  .max(128, "Password maksimal 128 karakter")
  .refine((v) => /[A-Z]/.test(v), "Password harus mengandung huruf besar")
  .refine((v) => /[a-z]/.test(v), "Password harus mengandung huruf kecil")
  .refine((v) => /[0-9]/.test(v), "Password harus mengandung angka")
  .refine(
    (v) => /[^A-Za-z0-9]/.test(v),
    "Password harus mengandung simbol"
  );

export const loginSchema = z.object({
  username: z.string().min(1, "Username/email wajib diisi").max(255),
  password: z.string().min(1, "Password wajib diisi").max(128),
});

export type LoginInput = z.infer<typeof loginSchema>;

const usernameSchema = z
  .string()
  .min(3, "Username minimal 3 karakter")
  .max(50, "Username maksimal 50 karakter")
  .regex(
    /^[a-zA-Z0-9._-]+$/,
    "Username hanya boleh huruf, angka, titik, underscore, atau dash"
  )
  .optional()
  .or(z.literal(""));

export const createUserSchema = z.object({
  email: z.string().email("Email tidak valid").max(255),
  username: usernameSchema.optional(),
  name: z.string().min(1, "Nama wajib diisi").max(100),
  password: passwordSchema,
  role: z.enum(["ENGINEER", "SUPERVISOR", "ADMIN", "AUDITOR"]),
  ldapDn: z.string().max(255).optional().or(z.literal("")),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  username: usernameSchema.optional(),
  role: z.enum(["ENGINEER", "SUPERVISOR", "ADMIN", "AUDITOR"]).optional(),
  isActive: z.boolean().optional(),
  ldapDn: z.string().max(255).optional().or(z.literal("")),
  password: passwordSchema.optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export { passwordSchema };

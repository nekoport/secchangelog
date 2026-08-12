// Application constants

export const APP_NAME = "SecChangeLog";
export const APP_VERSION = "1.0.0";

export const ROLES = {
  ENGINEER: "ENGINEER",
  SUPERVISOR: "SUPERVISOR",
  ADMIN: "ADMIN",
  AUDITOR: "AUDITOR",
} as const;

export type Role = keyof typeof ROLES;

export const RISK_LEVELS = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
} as const;

export type RiskLevel = keyof typeof RISK_LEVELS;

export const CHANGE_LOG_STATUS = {
  DRAFT: "DRAFT",
  IMPLEMENTED: "IMPLEMENTED",
  VERIFIED: "VERIFIED",
} as const;

export type ChangeLogStatus = keyof typeof CHANGE_LOG_STATUS;

export const CHANGE_TYPES = [
  "ACL",
  "ROUTING",
  "NAT",
  "INTERFACE",
  "SECURITY_POLICY",
  "VPN",
  "OTHER",
] as const;

export type ChangeType = (typeof CHANGE_TYPES)[number];

export const DELETE_REQUEST_STATUS = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;

export type DeleteRequestStatus = keyof typeof DELETE_REQUEST_STATUS;

export const SCREENSHOT_TYPES = {
  BEFORE: "BEFORE",
  AFTER: "AFTER",
  OTHER: "OTHER",
} as const;

export type ScreenshotType = keyof typeof SCREENSHOT_TYPES;

export const AUDIT_ACTIONS = {
  LOGIN_SUCCESS: "LOGIN_SUCCESS",
  LOGIN_FAILED: "LOGIN_FAILED",
  LOGOUT: "LOGOUT",
  ACCOUNT_LOCKED: "ACCOUNT_LOCKED",
  CREATE_CHANGE_LOG: "CREATE_CHANGE_LOG",
  UPDATE_CHANGE_LOG: "UPDATE_CHANGE_LOG",
  VERIFY_CHANGE_LOG: "VERIFY_CHANGE_LOG",
  VIEW_CHANGE_LOG: "VIEW_CHANGE_LOG",
  CREATE_DELETE_REQUEST: "CREATE_DELETE_REQUEST",
  APPROVE_DELETE_REQUEST: "APPROVE_DELETE_REQUEST",
  REJECT_DELETE_REQUEST: "REJECT_DELETE_REQUEST",
  SOFT_DELETE_CHANGE_LOG: "SOFT_DELETE_CHANGE_LOG",
  RESTORE_CHANGE_LOG: "RESTORE_CHANGE_LOG",
  UPLOAD_SCREENSHOT: "UPLOAD_SCREENSHOT",
  DELETE_SCREENSHOT: "DELETE_SCREENSHOT",
  CREATE_USER: "CREATE_USER",
  UPDATE_USER: "UPDATE_USER",
  DEACTIVATE_USER: "DEACTIVATE_USER",
  ACTIVATE_USER: "ACTIVATE_USER",
  CREATE_DEVICE_TYPE: "CREATE_DEVICE_TYPE",
  UPDATE_DEVICE_TYPE: "UPDATE_DEVICE_TYPE",
  DEACTIVATE_DEVICE_TYPE: "DEACTIVATE_DEVICE_TYPE",
  CREATE_DEVICE: "CREATE_DEVICE",
  UPDATE_DEVICE: "UPDATE_DEVICE",
  DEACTIVATE_DEVICE: "DEACTIVATE_DEVICE",
  UPDATE_SYSTEM_SETTING: "UPDATE_SYSTEM_SETTING",
  UPDATE_SYSTEM_LOGO: "UPDATE_SYSTEM_LOGO",
  UPDATE_SYSTEM_FAVICON: "UPDATE_SYSTEM_FAVICON",
  EXPORT_EXCEL: "EXPORT_EXCEL",
  EXPORT_PDF: "EXPORT_PDF",
  CHANGE_THEME: "CHANGE_THEME",
  NTP_SYNC: "NTP_SYNC",
  UPDATE_NTP_SETTING: "UPDATE_NTP_SETTING",
} as const;

export type AuditAction = keyof typeof AUDIT_ACTIONS;

// File upload config
export const ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
];

export const ALLOWED_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "pdf"];

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_LOGO_SIZE = 2 * 1024 * 1024; // 2MB

// Pagination
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// Rate limiting
export const RATE_LIMITS = {
  LOGIN: { requests: 5, windowMs: 15 * 60 * 1000 }, // 5 / 15 min
  API: { requests: 100, windowMs: 60 * 1000 }, // 100 / min
  UPLOAD: { requests: 20, windowMs: 60 * 1000 }, // 20 / min
} as const;

// Account lockout
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 min

// Session
export const SESSION_MAX_AGE_HOURS = 8;

// Default device types (general categories)
export const DEFAULT_DEVICE_TYPES = [
  { name: "Firewall", description: "Perangkat firewall jaringan" },
  { name: "Network", description: "Perangkat jaringan (router, switch, dll)" },
  { name: "Server", description: "Server fisik maupun virtual" },
  { name: "Virtual Machine", description: "Virtual machine / hypervisor" },
  { name: "Storage", description: "Penyimpanan / SAN / NAS" },
  { name: "Others", description: "Perangkat lainnya" },
];

// Default system settings
export const DEFAULT_SETTINGS = {
  "system.name": "SecChangeLog",
  "system.logoPath": "",
  "system.faviconPath": "",
  "system.defaultTheme": "dark",
  "ldap.enabled": "false",
  "ldap.url": "",
  "ldap.bindDn": "",
  "ldap.bindPassword": "",
  "ldap.searchBase": "",
  "ldap.searchFilter": "(sAMAccountName={username})",
  "password.minLength": "10",
  "password.requireUppercase": "true",
  "password.requireLowercase": "true",
  "password.requireNumber": "true",
  "password.requireSymbol": "true",
  "upload.maxFileSizeMb": "10",
  "session.timeoutHours": "8",
  "ntp.server": "id.pool.ntp.org",
} as const;

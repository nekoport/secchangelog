import type { Role } from "@/lib/constants";

// Augment NextAuth session/types
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: Role;
    };
  }

  interface User {
    id: string;
    email: string;
    name: string;
    role: Role;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
  }
}

// App-level types
export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  data: T;
  meta?: PaginationMeta;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string }>;
    requestId?: string;
  };
}

export interface ChangeLogWithRelations {
  id: string;
  ticketId: string;
  deviceTypeId: string;
  deviceName: string;
  deviceIp: string | null;
  changeType: string;
  descriptionBefore: string;
  descriptionAfter: string;
  reason: string;
  riskLevel: string;
  status: string;
  picId: string;
  rollbackPlan: string | null;
  implementedAt: Date;
  verifiedAt: Date | null;
  verifiedById: string | null;
  isDeleted: boolean;
  deletedAt: Date | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  deviceType: { id: string; name: string };
  pic: { id: string; name: string };
  creator: { id: string; name: string };
  verifier: { id: string; name: string } | null;
  screenshots: Array<{
    id: string;
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
    type: string;
    createdAt: Date;
  }>;
  deleteRequests: Array<{
    id: string;
    status: string;
    requestedBy: { id: string; name: string };
    createdAt: Date;
  }>;
}

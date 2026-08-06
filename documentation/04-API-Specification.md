# API Specification
## SecChangeLog — REST API

| Field | Value |
|-------|-------|
| Document Version | 1.0.0 |
| Status | Final |
| Last Updated | 2026-08-06 |
| Base URL | `/api` |

---

## 1. Konvensi Umum

### 1.1 Authentication
- Semua endpoint (kecuali `/api/auth/*` dan `/api/health`) memerlukan JWT di cookie `next-auth.session-token`
- Token diperoleh dari endpoint login NextAuth

### 1.2 Request Format
- Content-Type: `application/json` (untuk body)
- Untuk upload file: `multipart/form-data`
- Parameter query: snake_case

### 1.3 Response Format
**Sukses (2xx):**
```json
{
  "data": { ... } | [ ... ] | null,
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 145,
    "totalPages": 8
  }
}
```

**Error (4xx/5xx):**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Deskripsi error dalam Bahasa Indonesia",
    "details": [
      { "field": "email", "message": "Email tidak valid" }
    ],
    "requestId": "uuid-untuk-tracing"
  }
}
```

### 1.4 HTTP Status Codes
| Code | Meaning |
|------|---------|
| 200 | OK |
| 201 | Created |
| 204 | No Content |
| 400 | Bad Request (validation) |
| 401 | Unauthorized |
| 403 | Forbidden (RBAC) |
| 404 | Not Found |
| 409 | Conflict (duplicate) |
| 422 | Unprocessable Entity |
| 429 | Too Many Requests (rate limit) |
| 500 | Internal Server Error |

### 1.5 Rate Limiting
- Auth endpoints (login, register): 5 requests / 15 menit per IP
- General API: 100 requests / menit per user
- Upload: 20 requests / menit per user
- Response header: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

### 1.6 Standard Query Parameters (List Endpoints)
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | int | 1 | Page number |
| `pageSize` | int | 20 | Items per page (max 100) |
| `search` | string | - | Full-text search |
| `sort` | string | `-createdAt` | Sort field (prefix `-` for desc) |
| `from` | ISO date | - | Filter dari tanggal |
| `to` | ISO date | - | Filter sampai tanggal |

---

## 2. Authentication Endpoints

### 2.1 POST `/api/auth/callback/credentials`
Login dengan email/password (NextAuth credentials provider).

**Request Body:**
```json
{
  "email": "user@company.com",
  "password": "SecretPassword123!",
  "csrfToken": "..."
}
```

**Response:** Set HTTP-only cookie, redirect ke `/`.

**Error 401:**
```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Email atau password salah"
  }
}
```

**Error 423 (Locked):**
```json
{
  "error": {
    "code": "ACCOUNT_LOCKED",
    "message": "Akun terkunci. Coba lagi dalam 12 menit."
  }
}
```

### 2.2 POST `/api/auth/signout`
Logout dan hapus session cookie.

### 2.3 GET `/api/auth/session`
Ambil session saat ini.

**Response 200:**
```json
{
  "user": {
    "id": "abc123",
    "email": "user@company.com",
    "name": "Budi",
    "role": "ENGINEER"
  },
  "expires": "2026-08-06T16:00:00.000Z"
}
```

### 2.4 POST `/api/auth/change-password`
Ganti password sendiri (session aktif). Rate limited (5/15 menit per user).
Body: `{ currentPassword, newPassword }` → `200 { "message": "Password berhasil diubah" }`.

> Catatan: endpoint `/api/auth/refresh` **tidak diimplementasikan** di kode. Token JWT
> cukup panjang (session MaxAge) sehingga refresh tidak diperlukan.

---

## 3. Change Log Endpoints

### 3.1 GET `/api/change-logs`
List change logs dengan filter, search, pagination.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `page` | int | Page number |
| `pageSize` | int | Items per page |
| `search` | string | Search di ticketId, deviceName, description |
| `deviceTypeId` | string | Filter by device type |
| `riskLevel` | enum | LOW, MEDIUM, HIGH, CRITICAL |
| `status` | enum | DRAFT, IMPLEMENTED, VERIFIED, FAILED |
| `picId` | string | Filter by PIC |
| `changeType` | string | Filter by change type |
| `from` | ISO date | Filter implementedAt dari |
| `to` | ISO date | Filter implementedAt sampai |
| `includeDeleted` | bool | Hanya Admin/Auditor |
| `sort` | string | `-createdAt`, `ticketId`, `riskLevel`, `implementedAt` |

**Response 200:**
```json
{
  "data": [
    {
      "id": "clx123...",
      "ticketId": "CHG-2026-0001",
      "deviceType": { "id": "...", "name": "Switch" },
      "deviceName": "SW-CORE-01",
      "deviceIp": "10.0.0.1",
      "changeType": "ACL",
      "riskLevel": "MEDIUM",
      "status": "IMPLEMENTED",
      "pic": { "id": "...", "name": "Budi" },
      "implementedAt": "2026-08-06T10:30:00.000Z",
      "createdAt": "2026-08-06T10:35:00.000Z",
      "screenshotCount": 2
    }
  ],
  "meta": { "page": 1, "pageSize": 20, "total": 145, "totalPages": 8 }
}
```

### 3.2 POST `/api/change-logs`
Buat change log baru. **Engineer+ only.**

**Request Body:**
```json
{
  "deviceTypeId": "dev_001",
  "deviceName": "SW-CORE-01",
  "deviceIp": "10.0.0.1",
  "changeType": "ACL",
  "descriptionBefore": "ACL 100 permit tcp any any eq 80",
  "descriptionAfter": "ACL 100 permit tcp any any eq 80\nACL 101 deny tcp any any eq 23",
  "reason": "Menutup akses Telnet dari jaringan publik untuk kepatuhan PCI-DSS",
  "riskLevel": "MEDIUM",
  "rollbackPlan": "Hapus ACL 101 dan kembalikan ke konfigurasi sebelumnya",
  "implementedAt": "2026-08-06T10:30:00.000Z",
  "screenshots": [
    { "id": "scr_001", "type": "BEFORE" },
    { "id": "scr_002", "type": "AFTER" }
  ]
}
```

**Response 201:**
```json
{
  "data": {
    "id": "clx...",
    "ticketId": "CHG-2026-0002",
    "status": "IMPLEMENTED",
    ...
  }
}
```

**Validation Errors (400):**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "details": [
      { "field": "deviceName", "message": "Nama perangkat wajib diisi" },
      { "field": "descriptionBefore", "message": "Deskripsi sebelum wajib diisi" }
    ]
  }
}
```

### 3.3 GET `/api/change-logs/:id`
Detail change log lengkap dengan screenshots.

**Response 200:**
```json
{
  "data": {
    "id": "clx...",
    "ticketId": "CHG-2026-0001",
    "deviceType": { "id": "...", "name": "Switch" },
    "deviceName": "SW-CORE-01",
    "deviceIp": "10.0.0.1",
    "changeType": "ACL",
    "descriptionBefore": "...",
    "descriptionAfter": "...",
    "reason": "...",
    "riskLevel": "MEDIUM",
    "status": "IMPLEMENTED",
    "pic": { "id": "...", "name": "Budi" },
    "rollbackPlan": "...",
    "implementedAt": "2026-08-06T10:30:00.000Z",
    "verifiedAt": null,
    "screenshots": [
      {
        "id": "scr_001",
        "type": "BEFORE",
        "url": "/api/files/screenshots/scr_001",
        "originalName": "before-acl.png",
        "size": 234567,
        "mimeType": "image/png"
      }
    ],
    "deleteRequest": null,
    "auditTrails": [
      {
        "action": "CREATE_CHANGE_LOG",
        "user": { "id": "...", "name": "Budi" },
        "timestamp": "2026-08-06T10:35:00.000Z"
      }
    ]
  }
}
```

### 3.4 PATCH `/api/change-logs/:id`
Update change log. **Hanya jika status DRAFT atau user adalah Admin.**

**Request Body (partial):** Same fields as POST.

**Response 200:** Updated change log.

### 3.5 DELETE `/api/change-logs/:id`
**Tidak tersedia langsung.** Penghapusan harus melalui Delete Request workflow (lihat endpoint 4).

Jika dipanggil, response 405:
```json
{
  "error": {
    "code": "METHOD_NOT_ALLOWED",
    "message": "Penghapusan change log harus melalui delete request. Lihat /api/delete-requests"
  }
}
```

### 3.6 POST `/api/change-logs/:id/verify`
Verifikasi change log (ubah status ke VERIFIED). **Supervisor+ only.**

**Response 200:**
```json
{ "data": { "id": "...", "status": "VERIFIED", "verifiedAt": "...", "verifiedBy": {...} } }
```

---

## 4. Delete Request Endpoints

### 4.1 GET `/api/delete-requests`
List delete requests.

**Query Parameters:**
| Param | Description |
|-------|-------------|
| `status` | PENDING, APPROVED, REJECTED |
| `requestedById` | Filter by requester |
| `page`, `pageSize` | Pagination |

**Response 200:**
```json
{
  "data": [
    {
      "id": "drq...",
      "changeLog": { "id": "...", "ticketId": "CHG-2026-0001", "deviceName": "..." },
      "requestedBy": { "id": "...", "name": "Budi" },
      "reason": "Salah input device, perlu dibuat ulang",
      "status": "PENDING",
      "createdAt": "2026-08-06T11:00:00.000Z"
    }
  ],
  "meta": { ... }
}
```

### 4.2 POST `/api/delete-requests`
Ajukan penghapusan. **Engineer+ only.**

**Request Body:**
```json
{
  "changeLogId": "clx...",
  "reason": "Salah input device, perlu dibuat ulang"
}
```

**Response 201:** Delete request object.

**Error 409 (Conflict):**
```json
{
  "error": {
    "code": "PENDING_REQUEST_EXISTS",
    "message": "Sudah ada request penghapusan pending untuk change log ini"
  }
}
```

### 4.3 POST `/api/delete-requests/:id/approve`
Approve penghapusan. **Supervisor+ only.**

**Request Body:**
```json
{
  "note": "Disetujui, memang salah input"
}
```

**Response 200:**
```json
{
  "data": {
    "id": "drq...",
    "status": "APPROVED",
    "approvedBy": { "id": "...", "name": "Supervisor Andi" },
    "approvedAt": "2026-08-06T11:30:00.000Z",
    "changeLog": { "id": "...", "isDeleted": true, "deletedAt": "..." }
  }
}
```

### 4.4 POST `/api/delete-requests/:id/reject`
Reject penghapusan. **Supervisor+ only.**

**Request Body:**
```json
{
  "note": "Change log ini masih relevan untuk audit, tidak boleh dihapus"
}
```

### 4.5 POST `/api/change-logs/:id/restore`
Restore change log yang sudah soft-deleted. **Admin only.**

---

## 5. File Upload Endpoints

### 5.1 POST `/api/upload`
Upload screenshot. **Engineer, Supervisor, Admin only.** Max 10MB per file,
rate limit 20 upload/min/user. Disimpan dengan validasi magic-number
(tidak ada re-encode; file mentah disimpan ke `public/uploads/screenshots/{uuid}.{ext}`).

**Request:** `multipart/form-data`
```
file: <binary>
type: BEFORE | AFTER | OTHER
```

**Response 201:**
```json
{
  "data": {
    "id": "scr_001",
    "filename": "abc123-def456.png",
    "originalName": "screenshot.png",
    "mimeType": "image/png",
    "size": 234567,
    "type": "BEFORE",
    "url": "/api/files/screenshots/scr_001"
  }
}
```

**Error 400 (Invalid file):**
```json
{
  "error": {
    "code": "INVALID_FILE",
    "message": "File type tidak diizinkan. Hanya PNG, JPEG, WEBP, PDF."
  }
}
```

**Error 413 (File too large):**
```json
{
  "error": {
    "code": "FILE_TOO_LARGE",
    "message": "Ukuran file melebihi 10MB"
  }
}
```

### 5.2 GET `/api/files/screenshots/:id`
Serve screenshot file. **Authenticated users only.**

**Response 200:** File binary dengan Content-Type sesuai.

### 5.3 DELETE `/api/files/screenshots/:id`
Hapus screenshot. **Owner or Admin only.**

---

## 6. User Management Endpoints (Admin only)

### 6.1 GET `/api/admin/users`
List users.

### 6.2 POST `/api/admin/users`
Create new user.

**Request Body:**
```json
{
  "email": "user@company.com",
  "name": "Budi",
  "password": "InitialPassword123!",
  "role": "ENGINEER",
  "ldapDn": null
}
```

### 6.3 PATCH `/api/admin/users/:id`
Update user (name, role, isActive, password reset).

### 6.4 POST `/api/admin/users/:id/deactivate`
Deactivate user (soft delete).

### 6.5 POST `/api/admin/users/:id/activate`
Reactivate user.

### 6.6 POST `/api/auth/change-password`
User changes own password.

**Request Body:**
```json
{
  "currentPassword": "OldPassword123!",
  "newPassword": "NewPassword456@"
}
```

---

## 7. Device Type Endpoints

### 7.1 GET `/api/device-types`
List active device types. **All authenticated users.**

### 7.2 POST `/api/admin/device-types`
Create new device type. **Admin only.**

### 7.3 PATCH `/api/admin/device-types/:id`
Update device type.

### 7.4 POST `/api/admin/device-types/:id/deactivate`
Soft-disable device type.

---

## 8. Settings Endpoints (Admin only)

### 8.1 GET `/api/admin/settings`
Get all system settings.

### 8.2 PATCH `/api/admin/settings`
Update settings.

**Request Body:**
```json
{
  "system.name": "CyberSec ChangeLog",
  "system.defaultTheme": "dark"
}
```

### 8.3 POST `/api/admin/settings/logo`
Upload custom logo. **Admin only.** Max 2MB, PNG/SVG.

**Request:** `multipart/form-data`
```
file: <binary>
```

### 8.4 DELETE `/api/admin/settings/logo`
Reset ke default logo.

---

## 9. Dashboard Endpoints

### 9.1 GET `/api/dashboard/stats`
Statistik untuk dashboard.

**Response 200:**
```json
{
  "data": {
    "totalChangeLogs": 145,
    "thisMonth": 23,
    "lastMonth": 18,
    "byDeviceType": [
      { "deviceType": "Switch", "count": 60 },
      { "deviceType": "Router MikroTik", "count": 45 },
      ...
    ],
    "byRiskLevel": {
      "LOW": 80, "MEDIUM": 50, "HIGH": 12, "CRITICAL": 3
    },
    "byStatus": {
      "IMPLEMENTED": 130, "VERIFIED": 10, "DRAFT": 5, "FAILED": 0
    },
    "byPic": [
      { "user": { "id": "...", "name": "Budi" }, "count": 40 }
    ],
    "trend30Days": [
      { "date": "2026-07-08", "count": 3 },
      ...
    ],
    "pendingDeleteRequests": 2,
    "recentActivity": [
      {
        "action": "CREATE_CHANGE_LOG",
        "user": { "name": "Budi" },
        "entityType": "ChangeLog",
        "timestamp": "..."
      }
    ]
  }
}
```

### 9.2 GET `/api/audit-trail`
List audit trail. **Supervisor+ only** (Engineer hanya own).

---

## 10. Export Endpoints

### 10.1 GET `/api/export/excel`
Export list change logs ke Excel (.xlsx).

**Query:** Same as `/api/change-logs` (filter aktif).

**Response 200:**
- Content-Type: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- Content-Disposition: `attachment; filename="change-logs-2026-08-06.xlsx"`
- Binary XLSX content

**Excel Structure:**
- Sheet 1: "Change Logs" — kolom: Ticket ID, Date, Device Type, Device Name, IP, Change Type, Risk, Status, PIC, Description
- Sheet 2: "Summary" — pivot count by device type, risk level, status

### 10.2 GET `/api/export/pdf/:id`
Export single change log ke PDF.

**Response 200:**
- Content-Type: `application/pdf`
- Content-Disposition: `attachment; filename="CHG-2026-0001.pdf"`

**PDF Structure:**
- Header: System name, Logo, Ticket ID
- Section 1: Change Info (device, type, PIC, date, risk, status)
- Section 2: Description (before/after)
- Section 3: Reason & Rollback Plan
- Section 4: Screenshots (embedded images)
- Footer: Generated timestamp, page number

### 10.3 GET `/api/export/audit-trail/excel`
Export audit trail. **Supervisor+ only.**

---

## 11. Health Check

### 11.1 GET `/api/health`
Public endpoint untuk monitoring.

**Response 200:**
```json
{
  "status": "ok",
  "timestamp": "2026-08-06T03:00:00.000Z",
  "uptime": 3600,
  "db": "connected",
  "version": "1.0.0"
}
```

**Response 503:** Saat DB tidak terhubung.

---

## 12. Error Code Reference

| Code | HTTP | Description |
|------|------|-------------|
| `VALIDATION_ERROR` | 400 | Input tidak valid |
| `INVALID_CREDENTIALS` | 401 | Email/password salah |
| `ACCOUNT_LOCKED` | 423 | Akun terkunci karena brute force |
| `ACCOUNT_DEACTIVATED` | 403 | Akun nonaktif |
| `UNAUTHORIZED` | 401 | Tidak login |
| `FORBIDDEN` | 403 | Tidak punya role cukup |
| `NOT_FOUND` | 404 | Resource tidak ditemukan |
| `CONFLICT` | 409 | Duplikat atau conflict |
| `PENDING_REQUEST_EXISTS` | 409 | Sudah ada delete request pending |
| `INVALID_FILE` | 400 | File type tidak diizinkan |
| `FILE_TOO_LARGE` | 413 | File melebihi size limit |
| `RATE_LIMIT_EXCEEDED` | 429 | Terlalu banyak request |
| `INTERNAL_ERROR` | 500 | Server error (log requestId) |

---

## 13. WebSocket / Real-time (Future)

Tidak ada di MVP. Untuk v2 mungkin:
- Real-time notification delete request baru ke supervisor
- Live dashboard updates

---

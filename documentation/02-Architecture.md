# System Architecture Document
## SecChangeLog — Sistem Pencatatan Perubahan Konfigurasi

| Field | Value |
|-------|-------|
| Document Version | 1.0.0 |
| Status | Final |
| Last Updated | 2026-08-06 |

---

## 1. Arsitektur High-Level

SecChangeLog menggunakan **monolithic Next.js 16 application** dengan App Router. Seluruh logika frontend, backend API, dan server actions berada dalam satu codebase untuk kemudahan deployment dan maintenance.

```
┌─────────────────────────────────────────────────────────────┐
│                       BROWSER CLIENT                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  React 19   │  │ TanStack    │  │  Zustand (UI state) │  │
│  │  + Tailwind │  │ Query       │  │  + next-themes      │  │
│  │  + shadcn   │  │ (server)    │  │                     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTPS (REST + Server Actions)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                NEXT.JS 16 (APP ROUTER)                        │
│  ┌───────────────────────────────────────────────────────┐   │
│  │  MIDDLEWARE (Edge)                                     │   │
│  │  - Auth check (JWT)                                    │   │
│  │  - Rate limiting                                       │   │
│  │  - Security headers (CSP, HSTS, X-Frame, etc.)         │   │
│  └───────────────────────────────────────────────────────┘   │
│  ┌───────────────────────────────────────────────────────┐   │
│  │  APP ROUTER PAGES                                      │   │
│  │  / (dashboard)  /logs  /logs/[id]  /settings  /auth    │   │
│  └───────────────────────────────────────────────────────┘   │
│  ┌───────────────────────────────────────────────────────┐   │
│  │  API ROUTES (/api/*)                                   │   │
│  │  - /api/auth/*          (NextAuth)                     │   │
│  │  - /api/change-logs     (CRUD)                         │   │
│  │  - /api/delete-requests (workflow)                     │   │
│  │  - /api/upload          (file upload)                  │   │
│  │  - /api/export          (Excel/PDF/Word)                │   │
│  │  - /api/admin/*         (admin only)                   │   │
│  └───────────────────────────────────────────────────────┘   │
│  ┌───────────────────────────────────────────────────────┐   │
│  │  SERVICE LAYER (server-only)                           │   │
│  │  - AuthService (login, LDAP, JWT)                      │   │
│  │  - ChangeLogService                                    │   │
│  │  - DeleteRequestService                                │   │
│  │  - AuditTrailService                                   │   │
│  │  - FileStorageService (local FS, sanitized)            │   │
│  │  - ExportService (Excel/PDF/Word generation)            │   │
│  └───────────────────────────────────────────────────────┘   │
└──────────────┬──────────────────┬─────────────────────────────┘
               │                  │
               ▼                  ▼
┌──────────────────────┐  ┌───────────────────────────────┐
│   Prisma ORM Layer   │  │   Local Filesystem (/uploads) │
│   - Type-safe query  │  │   - Screenshot files           │
│   - Migration        │  │   - Logo image                │
│   - Transaction      │  │   - PDF exports (temp)        │
└──────────┬───────────┘  └───────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│        DATABASE (SQLite file — production deployment)         │
│  - Users, DeviceTypes, ChangeLogs, Screenshots,               │
│    DeleteRequests, AuditTrails, SystemSettings                │
│  - MySQL 8 merupakan migration path opsional                  │
└─────────────────────────────────────────────────────────────┘
           │
           ▼ (optional)
┌─────────────────────────────────────────────────────────────┐
│              LDAP / ACTIVE DIRECTORY SERVER                   │
│  (configured via SystemSettings; fallback to local auth)      │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Prinsip Desain Arsitektural

### 2.1 Layered Architecture
- **Presentation Layer**: React components, pages, layouts
- **API Layer**: Next.js API routes — validasi input, HTTP handling
- **Service Layer**: Business logic — pure TypeScript, testable
- **Data Access Layer**: Prisma ORM — single source of truth untuk DB access
- **Storage Layer**: SQLite + Local filesystem (uploads)

### 2.2 Server-First Approach
- Gunakan **API Routes** untuk seluruh mutasi data (create/update/approve/reject), file upload/download, dan export
- Gunakan **Server Components** untuk halaman yang tidak butuh interaktivitas (login)
- Gunakan **Client Components** untuk dashboard SPA, form, modal, chart, interactive UI
- Tidak menggunakan Server Actions (semua aksi lewat endpoint `/api/*`)

### 2.3 Security by Design
- **Never trust user input** — semua input divalidasi dengan Zod schema
- **Defense in depth** — middleware + API route + service layer validation
- **Least privilege** — RBAC di-enforce di tiap layer
- **Fail secure** — default deny, error tidak expose sensitive info
- **Audit everything** — semua mutasi tercatat di AuditTrail

### 2.4 Single Source of Truth
- Schema di Prisma → auto-generate TypeScript types
- Validation schema di `src/lib/validations/` → dipakai baik di client maupun server
- Konstanta (role, status, risk level) di `src/lib/constants.ts`

---

## 3. Struktur Folder

> **Catatan**: Aplikasi menggunakan **single-page dashboard** (bukan multi-route). Hanya
> ada 2 halaman server (`/` dan `/login`); seluruh tampilan (change logs, delete
> requests, audit trail, users, settings) dirender sebagai **tab dalam satu halaman**
> dan mengambil data via API. Mutasi menggunakan **API Routes** (bukan Server Actions).

```
secchangelog/
├── docs/                          # Dokumentasi profesional
│   ├── 01-PRD.md
│   ├── 02-Architecture.md
│   ├── 03-Database-Schema.md
│   ├── 04-API-Specification.md
│   ├── 05-Security-OWASP.md
│   └── 06-Deployment-Guide.md
├── prisma/
│   └── schema.prisma              # Database schema (single source)
├── src/
│   ├── app/
│   │   ├── page.tsx               # Halaman tunggal (dashboard SPA)
│   │   ├── login/page.tsx         # Halaman login
│   │   ├── layout.tsx             # Root layout (Theme provider, Toaster)
│   │   ├── globals.css            # Global styles + CSS variables
│   │   └── api/                   # REST API routes
│   │       ├── auth/[...nextauth]/route.ts
│   │       ├── auth/change-password/route.ts
│   │       ├── upload/route.ts                         # Upload screenshot
│   │       ├── change-logs/route.ts                    # CRUD list/create
│   │       ├── change-logs/[id]/route.ts
│   │       ├── change-logs/[id]/verify/route.ts
│   │       ├── change-logs/[id]/restore/route.ts
│   │       ├── delete-requests/route.ts
│   │       ├── delete-requests/[id]/approve/route.ts
│   │       ├── delete-requests/[id]/reject/route.ts
│   │       ├── device-types/route.ts
│   │       ├── dashboard/stats/route.ts
│   │       ├── audit-trail/route.ts
│   │       ├── files/screenshots/[id]/route.ts
│   │       ├── health/route.ts
│   │       ├── export/excel/route.ts
│   │       ├── export/pdf/[id]/route.ts
│   │       ├── export/word/[id]/route.ts
│   │       ├── export/audit-trail/excel/route.ts
│   │       └── admin/
│   │           ├── device-types/route.ts
│   │           ├── device-types/[id]/route.ts
│   │           ├── users/route.ts
│   │           ├── users/[id]/route.ts
│   │           ├── users/[id]/activate/route.ts
│   │           ├── users/[id]/deactivate/route.ts
│   │           ├── settings/route.ts
│   │           └── settings/logo/route.ts
│   ├── components/
│   │   ├── ui/                    # shadcn/ui components
│   │   ├── layout/                # Sidebar, Header, Footer
│   │   ├── change-logs/           # Form & list change log
│   │   ├── dashboard/             # Widget dashboard
│   │   ├── settings/              # Settings components
│   │   └── shared/                # Shared widgets
│   ├── lib/
│   │   ├── db.ts                  # Prisma client singleton
│   │   ├── auth-options.ts        # NextAuth config (Credentials + LDAP)
│   │   ├── ldap.ts                # LDAP adapter
│   │   ├── session.ts             # Server-side session helper
│   │   ├── constants.ts           # Role, status, risk, rate limit, defaults
│   │   ├── utils.ts
│   │   ├── validations/           # Zod schemas
│   │   │   ├── change-log.ts
│   │   │   ├── user.ts
│   │   │   └── settings.ts
│   │   ├── services/              # Business logic
│   │   │   ├── change-log.service.ts
│   │   │   ├── delete-request.service.ts
│   │   │   ├── audit-trail.service.ts
│   │   │   ├── file-storage.service.ts
│   │   │   ├── export.service.ts
│   │   │   └── system-setting.service.ts
│   │   └── security/              # Security utilities
│   │       ├── rate-limit.ts
│   │       ├── password.ts
│   │       ├── file-validation.ts
│   │       ├── api-response.ts
│   │       └── pdfkit-patch.ts
│   ├── types/
│   │   └── index.ts               # Tipe / NextAuth augmentation
│   ├── middleware.ts              # Auth check (JWT via next-auth)
│   └── providers/
│       ├── theme-provider.tsx
│       └── query-provider.tsx
├── public/
│   └── uploads/                   # User-uploaded files (gitignored)
│       ├── screenshots/           # Flat: {uuid}.{ext}
│       └── logos/
├── scripts/
│   ├── seed.ts                    # Seed admin, device types, settings
│   ├── security-audit.ts
│   ├── generate-docs-pdf.ts
│   └── zip-source.sh
├── Dockerfile                     # Multi-stage production build
├── docker-compose.yaml            # Orchestrasi (app + caddy)
├── Caddyfile                      # Reverse proxy + TLS (self-signed)
├── .env.example
├── README.md
└── package.json
```

---

## 4. Komponen Arsitektur Detail

### 4.1 Middleware (Edge Runtime)
- Cek JWT token di cookie untuk route protected (via `getToken` next-auth)
- Redirect unauthenticated users ke `/login`
- Security headers (HSTS, X-Frame-Options, dsb.) di-set di `next.config.ts` dan reverse proxy (Caddy), bukan di middleware

### 4.2 NextAuth Configuration
- Strategy: JWT dengan database session fallback
- Providers: Credentials (local) + LDAP (optional, configurable via SystemSettings)
- Callbacks:
  - `jwt`: inject role & permissions ke token
  - `session`: expose role ke client session
- Pages: custom `/login`
- Session expiry: 8 jam
- Cookie: `httpOnly`, `secure` (production), `sameSite: 'lax'`

### 4.3 Service Layer Pattern
Setiap service mengikuti pola:
```typescript
// Pure functions, tidak bergantung pada HTTP context
export class ChangeLogService {
  static async create(input: CreateChangeLogInput, userId: string): Promise<ChangeLog> {
    // 1. Validate (Zod)
    // 2. Business rules check
    // 3. DB transaction (Prisma)
    // 4. Write AuditTrail
    // 5. Return result
  }
}
```

### 4.4 File Storage Strategy
- Lokasi: `public/uploads/` (di-set via env `UPLOAD_DIR`, default `./public/uploads` relatif ke project root)
- Struktur: `screenshots/{uuid}.{ext}` (flat) dan `logos/system-logo.{ext}`
- Validasi:
  - MIME type whitelist: `image/png`, `image/jpeg`, `image/webp`, `application/pdf`
  - Magic number verification (tidak percaya Content-Type header)
  - Max size: 10MB per file (logo 2MB)
- Filename sanitization: hanya alphanumeric + dash
- **Path traversal prevention**: selalu generate UUID filename, tidak pernah pakai user-supplied filename

### 4.5 Audit Trail Mechanism
Setiap mutasi data menulis ke tabel `AuditTrail`:
```typescript
{
  userId, action: 'CREATE_CHANGE_LOG' | 'UPDATE_CHANGE_LOG' | 'DELETE_REQUEST' | ...,
  entityType: 'ChangeLog' | 'User' | 'DeviceType' | ...,
  entityId: string,
  metadata: JSON (before/after diff),
  timestamp, ipAddress, userAgent
}
```

### 4.6 Export Pipeline
- **Excel**: gunakan `xlsx` library, generate in-memory, stream sebagai response
- **PDF**: gunakan `pdfkit` (tanpa dependency browser) dengan layout custom (header, content, screenshot embedded)
- **Word**: gunakan `docx` library, menghasilkan dokumen .docx yang dapat diedit di Microsoft Word (header, informasi perubahan, deskripsi, screenshot embedded)

---

## 5. Security Architecture

### 5.1 Authentication Flow
```
[Login Form] → POST /api/auth/callback/credentials
              → Verify credentials (local DB or LDAP)
              → Generate JWT (8h expiry)
              → Set httpOnly cookie
              → Return user profile to client
```

### 5.2 Authorization Matrix
| Resource | Engineer | Supervisor | Admin | Auditor |
|----------|----------|------------|-------|---------|
| Dashboard | Own data | All | All | All (read) |
| Change Logs | CRUD own | Read all | CRUD all | Read all |
| Delete Request | Create own | Approve/Reject | All | Read |
| Users | Read self | Read self | CRUD all | Read all |
| Device Types | Read | Read | CRUD | Read |
| Settings | Read (limited) | Read (limited) | CRUD | Read |
| Audit Trail | Read own | Read all | Read all | Read all |
| Export | Own data | All | All | All |

### 5.3 Input Validation Strategy
- **Client-side**: React Hook Form + Zod resolver (UX)
- **Server-side API**: Zod schema parse (mandatory)
- **Database**: Prisma type-safe queries (final defense)

### 5.4 File Upload Security Pipeline
```
1. Check authentication (getServerSession)
2. Check authorization (role ENGINEER/SUPERVISOR/ADMIN)
3. Rate limit (20 uploads/menit)
4. Check size (≤ 10MB)
5. Verify magic number (PNG: 89504E47, JPEG: FFD8FF, WEBP: RIFF/WEBP, PDF: 25504446)
6. Simpan file mentah dengan UUID filename (tanpa re-encode/sharp)
7. Buat record Screenshot di DB
8. Return safe URL
```

---

## 6. Database Strategy

### 6.1 Production Deployment: SQLite
- Deploy Docker menggunakan SQLite file di volume (`/app/data/secchangelog.db`)
- Zero-config, tidak butuh infrastruktur DB terpisah
- Prisma sebagai single source of truth

### 6.2 Migration Path Opsional: MySQL 8
- Engine: InnoDB (transaction support, row-level locking)
- Charset: `utf8mb4`, collation `utf8mb4_unicode_ci`
- Schema Prisma dirancang portabel (String, Int, Boolean, DateTime)
- Cara: ubah `provider = "mysql"`, set `DATABASE_URL`, jalankan `prisma migrate deploy`

> **Catatan**: Aplikasi berjalan di SQLite untuk deployment saat ini. Skema yang
> memakai kolom String untuk enum/metadata/JSON-encoded dirancang agar kompatibel
> lintas provider.

### 6.3 Backup Strategy
- Backup volume SQLite file + folder uploads (contoh di 06-Deployment-Guide, `docker run ... tar`)
- Retention: 30 hari
- Backup di-encrypt dengan GPG sebelum dikirim ke offsite storage

---

## 7. Performance Considerations

### 7.1 Database Indexing
- Index pada kolom yang sering di-filter: `ticketId`, `deviceType`, `riskLevel`, `status`, `picId`, `createdAt`
- Composite index untuk query umum: `(deviceType, createdAt)`, `(status, createdAt)`
- Full-text search (MySQL) untuk kolom `description` (production-only)

### 7.2 Caching Strategy
- TanStack Query cache di client (stale-while-revalidate, 60s default)
- Revalidate tag-based untuk Server Components (60s)
- Tidak menggunakan Redis di MVP (in-memory sudah cukup untuk 50 concurrent users)

### 7.3 Image Optimization
- Gunakan Next.js `<Image>` component untuk automatic optimization
- Upload screenshot disimpan mentah (tanpa re-encode/sharp); validasi hanya magic-number
- Lazy load screenshot di list view

### 7.4 Bundle Size
- Code splitting per route (App Router automatic)
- Tree-shaking untuk library besar
- Dynamic import untuk export libraries (xlsx, pdfkit) — hanya load saat dibutuhkan

---

## 8. Error Handling Strategy

### 8.1 Error Hierarchy
```
AppError (base)
├── ValidationError (400 Bad Request)
├── AuthenticationError (401 Unauthorized)
├── AuthorizationError (403 Forbidden)
├── NotFoundError (404 Not Found)
├── ConflictError (409 Conflict)
└── InternalError (500 Internal Server Error)
```

### 8.2 Error Response Format
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Deskripsi error yang user-friendly (Bahasa Indonesia)",
    "details": [
      { "field": "email", "message": "Email tidak valid" }
    ],
    "requestId": "uuid untuk tracing"
  }
}
```

### 8.3 Logging
- Semua error di-log ke console (structured JSON)
- Tidak ada sensitive data (password, token) di log
- Production: forward ke external log service (Sentry/Datadog) — out of scope MVP

---

## 9. Deployment Architecture

### 9.1 Docker Compose (Current)
```
┌──────────────────────────────────────────┐
│            PRODUCTION SERVER              │
│  ┌───────────────────────────────────┐   │
│  │  Caddy (reverse proxy, :80/:443)  │   │
│  │  - TLS self-signed/Let's Encrypt  │   │
│  │  - HSTS, redirect ke HTTPS        │   │
│  └──────────────┬────────────────────┘   │
│                 │                         │
│  ┌──────────────▼────────────────────┐   │
│  │  Next.js standalone (app:3000)    │   │
│  └──────────────┬────────────────────┘   │
│                 │                         │
│  ┌──────────────▼────────────────────┐   │
│  │  Volume secchangelog_data         │   │
│  │  - SQLite: /app/data/*.db         │   │
│  └───────────────────────────────────┘   │
│  ┌───────────────────────────────────┐   │
│  │  Volume secchangelog_uploads      │   │
│  │  /app/public/uploads              │   │
│  └───────────────────────────────────┘   │
└──────────────────────────────────────────┘
```

### 9.2 Reverse Proxy (Production)
- Caddy di depan Next.js (container terpisah di docker-compose)
- TLS termination (self-signed untuk internal, atau Let's Encrypt bila ada domain)
- HSTS header via Caddy
- Detail lengkap: `06-Deployment-Guide.md`

---

## 10. Monitoring & Observability

### 10.1 Health Check
- Endpoint: `GET /api/health` → `{ status: 'ok', db: 'connected', uptime: ... }`
- Database connectivity check
- Disk space check untuk uploads folder

### 10.2 Logging
- Request/response logging (method, path, status, duration)
- Error logging dengan stack trace
- Audit trail di database (untuk compliance)

### 10.3 Metrics (Future)
- Application metrics: request count, response time, error rate
- Business metrics: change logs per day, active users
- Database metrics: connection pool, slow queries

---

## 11. Scalability Path (Future)

Untuk MVP, single server sudah cukup. Jika butuh scale:
1. **Vertical scaling**: upgrade server RAM/CPU
2. **Horizontal scaling**: 
   - Stateless app instances di belakang load balancer
   - Shared session via database (bukan cookie JWT)
   - Move uploads ke S3-compatible storage
3. **Database scaling**:
   - Read replicas untuk query berat
   - Connection pooling via PgBouncer/ProxySQL

---

## 12. Technology Decision Log

| Decision | Choice | Alternatives Considered | Reason |
|----------|--------|------------------------|--------|
| Framework | Next.js 16 | Remix, Nuxt | App Router, RSC, ecosystem |
| Database | SQLite (file `/app/data/secchangelog.db`) | PostgreSQL, MySQL 8 | Tanpa infrastruktur DB terpisah untuk deploy container |
| ORM | Prisma 6 | Drizzle, TypeORM | Type-safe, best DX, migration tool |
| Auth | NextAuth.js | Lucia, custom | Battle-tested, LDAP-ready via custom provider |
| UI Library | shadcn/ui | MUI, Ant Design | Modern, customizable, copy-paste ownership |
| State | Zustand + TanStack Query | Redux Toolkit | Simpler, less boilerplate |
| Charts | Recharts | Chart.js, Nivo | React-native, declarative |
| File Validation | custom (magic number) | multer | Magic number check + size limit |
| Export Excel | xlsx (SheetJS) | exceljs | Lightweight, widely used |
| Export PDF | pdfkit | puppeteer, jsPDF | No browser dependency, faster |
| Export Word | docx | html-docx-js, officegen | Editable output (.docx), rich API |

---

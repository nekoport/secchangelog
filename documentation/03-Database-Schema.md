# Database Schema Design
## SecChangeLog — Sistem Pencatatan Perubahan Konfigurasi

| Field | Value |
|-------|-------|
| Document Version | 1.0.0 |
| Status | Final |
| Last Updated | 2026-08-06 |
| DBMS Target | SQLite (aktif, deploy Docker), MySQL 8.0+ (opsional path) |

---

## 1. Diagram ERD (Entity Relationship)

```
┌──────────────────┐       ┌──────────────────┐
│      User        │       │   DeviceType     │
├──────────────────┤       ├──────────────────┤
│ id (PK)          │       │ id (PK)          │
│ email (UQ)       │       │ name (UQ)        │
│ name             │       │ description      │
│ passwordHash     │       │ isActive         │
│ role             │       │ createdAt        │
│ ldapDn?          │       │ updatedAt        │
│ isActive         │       └────────┬─────────┘
│ failedAttempts   │                │
│ lockedUntil?     │                │ 1..N
│ lastLoginAt?     │                │
│ createdAt        │                ▼
│ updatedAt        │       ┌──────────────────┐
└────────┬─────────┘       │   ChangeLog      │
         │                 ├──────────────────┤
         │ 1..N            │ id (PK)          │
         │ (PIC)           │ ticketId (UQ)    │
         ├────────────────►│ deviceTypeId(FK) │
         │                 │ deviceName       │
         │                 │ deviceIp         │
         │                 │ changeType       │
         │                 │ descriptionBefore│
         │                 │ descriptionAfter │
         │                 │ reason           │
         │                 │ riskLevel        │
         │                 │ status           │
         │                 │ picId (FK) ──────┤
         │                 │ rollbackPlan     │
         │                 │ implementedAt    │
         │                 │ verifiedAt?      │
         │                 │ isDeleted        │
         │                 │ deletedAt?       │
         │                 │ createdAt        │
         │                 │ updatedAt        │
         │                 │ createdById (FK) │
         │                 └────────┬─────────┘
         │                          │
         │                          │ 1..N
         │                          ▼
         │                 ┌──────────────────┐
         │                 │   Screenshot     │
         │                 ├──────────────────┤
         │                 │ id (PK)          │
         │                 │ changeLogId (FK) │
         │                 │ filename         │
         │                 │ originalName     │
         │                 │ mimeType         │
         │                 │ size             │
         │                 │ type (before/after)│
         │                 │ createdAt        │
         │                 └──────────────────┘
         │
         │ 1..N            ┌──────────────────┐
         ├────────────────►│  DeleteRequest   │
         │ (requester)     ├──────────────────┤
         │                 │ id (PK)          │
         │                 │ changeLogId (FK) │
         │                 │ requestedById(FK)│
         │                 │ reason           │
         │                 │ status           │
         │                 │ approvedById?    │
         │                 │ approvedAt?      │
         │                 │ approverNote?    │
         │                 │ createdAt        │
         │                 │ updatedAt        │
         │                 └──────────────────┘
         │
         │ 1..N            ┌──────────────────┐
         └────────────────►│  AuditTrail      │
                           ├──────────────────┤
                           │ id (PK)          │
                           │ userId (FK)      │
                           │ action           │
                           │ entityType       │
                           │ entityId         │
                           │ metadata (JSON)  │
                           │ ipAddress        │
                           │ userAgent        │
                           │ timestamp        │
                           └──────────────────┘

┌──────────────────┐
│ SystemSetting    │
├──────────────────┤
│ id (PK)          │
│ key (UQ)         │
│ value (TEXT)     │
│ updatedAt        │
│ updatedBy (FK)   │
└──────────────────┘

┌──────────────────┐
│ Account (NextAuth)│
├──────────────────┤
│ id (PK)          │
│ userId (FK)      │
│ providerType     │
│ providerId       │
│ providerAccountId│
│ refreshToken     │
│ accessToken      │
│ expiresAt        │
│ tokenType        │
│ scope            │
│ idToken          │
│ sessionState     │
└──────────────────┘

┌──────────────────┐
│ Session (NextAuth)│
├──────────────────┤
│ id (PK)          │
│ sessionToken (UQ)│
│ userId (FK)      │
│ expires          │
└──────────────────┘

┌──────────────────┐
│ VerificationToken│
├──────────────────┤
│ identifier       │
│ token (UQ)       │
│ expires          │
└──────────────────┘
```

---

## 2. Detail Tabel

### 2.1 User
Menyimpan data pengguna sistem. Mendukung autentikasi local (passwordHash) dan LDAP (ldapDn).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | String( cuid) | PK | Unique identifier |
| email | String | UQ, NOT NULL | Email login (case-insensitive) |
| name | String | NOT NULL | Display name |
| passwordHash | String? | nullable | bcrypt hash; null jika pure LDAP |
| role | Enum | NOT NULL, default 'ENGINEER' | ENGINEER, SUPERVISOR, ADMIN, AUDITOR |
| ldapDn | String? | nullable | LDAP Distinguished Name |
| isActive | Boolean | NOT NULL, default true | Soft disable account |
| failedAttempts | Int | NOT NULL, default 0 | Counter untuk lockout |
| lockedUntil | DateTime? | nullable | Lock expiry timestamp |
| lastLoginAt | DateTime? | nullable | Audit terakhir login |
| lastLoginIp | String? | nullable | Audit terakhir login IP |
| createdAt | DateTime | NOT NULL, default now() | |
| updatedAt | DateTime | NOT NULL, auto | |

**Indexes:**
- UNIQUE INDEX on `email` (lowercased untuk case-insensitive)
- INDEX on `role`
- INDEX on `isActive`

### 2.2 DeviceType
Jenis perangkat yang dapat dikonfigurasi secara dinamis.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | String(cuid) | PK | |
| name | String | UQ, NOT NULL | Misal "Switch", "Router MikroTik", "Firewall Palo Alto" |
| description | String? | | Catatan opsional |
| isActive | Boolean | NOT NULL, default true | Soft disable |
| createdAt | DateTime | | |
| updatedAt | DateTime | | |

**Seed Data:**
- Switch
- Router MikroTik
- Firewall Palo Alto
- Firewall Fortinet
- Server Linux
- Server Windows

### 2.3 ChangeLog
Catatan inti sistem.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | String(cuid) | PK | |
| ticketId | String | UQ, NOT NULL | Format: `CHG-YYYY-NNNN` (auto-generate) |
| deviceTypeId | String | FK → DeviceType.id, NOT NULL | |
| deviceName | String | NOT NULL | Nama hostname perangkat |
| deviceIp | String? | | IP address perangkat |
| changeType | String | NOT NULL | ACL, ROUTING, NAT, INTERFACE, SECURITY_POLICY, VPN, OTHER |
| descriptionBefore | String | NOT NULL (text) | Kondisi sebelum perubahan |
| descriptionAfter | String | NOT NULL (text) | Kondisi setelah perubahan |
| reason | String | NOT NULL (text) | Alasan bisnis/teknis |
| riskLevel | Enum | NOT NULL | LOW, MEDIUM, HIGH, CRITICAL |
| status | Enum | NOT NULL, default 'IMPLEMENTED' | DRAFT, IMPLEMENTED, VERIFIED, FAILED |
| picId | String | FK → User.id, NOT NULL | Person In Charge |
| rollbackPlan | String? | (text) | Rencana rollback |
| implementedAt | DateTime | NOT NULL | Waktu perubahan dilakukan |
| verifiedAt | DateTime? | | Waktu verifikasi (jika ada) |
| verifiedById | String? | FK → User.id | |
| isDeleted | Boolean | NOT NULL, default false | Soft delete flag |
| deletedAt | DateTime? | | |
| createdById | String | FK → User.id, NOT NULL | Pencatat |
| createdAt | DateTime | NOT NULL, default now() | |
| updatedAt | DateTime | NOT NULL, auto | |

**Indexes:**
- UNIQUE INDEX on `ticketId`
- INDEX on `(deviceTypeId, createdAt)`
- INDEX on `(status, createdAt)`
- INDEX on `(riskLevel, createdAt)`
- INDEX on `picId`
- INDEX on `isDeleted` (partial: WHERE isDeleted = false)
- INDEX on `implementedAt`

### 2.4 Screenshot
File bukti perubahan.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | String(cuid) | PK | |
| changeLogId | String? | FK → ChangeLog.id, nullable, ON DELETE CASCADE | Link ke change log; null saat upload sementara |
| filename | String | NOT NULL | UUID-based filename di disk |
| originalName | String | NOT NULL | Nama asli file (sanitized) |
| mimeType | String | NOT NULL | image/png, image/jpeg, application/pdf |
| size | Int | NOT NULL | Bytes |
| type | Enum | NOT NULL | BEFORE, AFTER, OTHER |
| createdAt | DateTime | NOT NULL, default now() | |

**Indexes:**
- INDEX on `(changeLogId, type)`

### 2.5 DeleteRequest
Pengajuan penghapusan change log yang butuh approval supervisor.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | String(cuid) | PK | |
| changeLogId | String | FK → ChangeLog.id, NOT NULL | |
| requestedById | String | FK → User.id, NOT NULL | |
| reason | String | NOT NULL (text) | Alasan penghapusan |
| status | Enum | NOT NULL, default 'PENDING' | PENDING, APPROVED, REJECTED |
| approvedById | String? | FK → User.id | |
| approvedAt | DateTime? | | |
| approverNote | String? | (text) | Catatan approver |
| createdAt | DateTime | NOT NULL, default now() | |
| updatedAt | DateTime | NOT NULL, auto | |

**Indexes:**
- INDEX on `(status, createdAt)` (untuk query pending approvals)
- INDEX on `requestedById`
- INDEX on `changeLogId`

**Business Rules:**
- Satu change log hanya bisa punya satu `PENDING` delete request
- Setelah approved, `ChangeLog.isDeleted = true` dan `deletedAt = now()`
- Setelah rejected, status kembali ke semula (tidak ada cooldown 24 jam — dokumen sebelumnya tidak akurat)

### 2.6 AuditTrail
Log lengkap aktivitas untuk forensik & compliance.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | String(cuid) | PK | |
| userId | String | FK → User.id, NOT NULL | |
| action | String | NOT NULL | Lihat daftar action di bawah |
| entityType | String | NOT NULL | ChangeLog, User, DeviceType, DeleteRequest, SystemSetting |
| entityId | String | NOT NULL | |
| metadata | String | | JSON-encoded string: before/after diff, additional context (bukan kolom Json) |
| ipAddress | String? | | |
| userAgent | String? | | |
| timestamp | DateTime | NOT NULL, default now() | |

**Action Values:**
- `LOGIN_SUCCESS`, `LOGIN_FAILED`, `LOGOUT`
- `CREATE_CHANGE_LOG`, `UPDATE_CHANGE_LOG`, `VIEW_CHANGE_LOG`
- `CREATE_DELETE_REQUEST`, `APPROVE_DELETE_REQUEST`, `REJECT_DELETE_REQUEST`
- `SOFT_DELETE_CHANGE_LOG`, `RESTORE_CHANGE_LOG`, `HARD_DELETE_CHANGE_LOG`
- `UPLOAD_SCREENSHOT`, `DELETE_SCREENSHOT`
- `CREATE_USER`, `UPDATE_USER`, `DEACTIVATE_USER`, `ACTIVATE_USER`
- `CREATE_DEVICE_TYPE`, `UPDATE_DEVICE_TYPE`, `DEACTIVATE_DEVICE_TYPE`
- `UPDATE_SYSTEM_SETTING`, `UPDATE_SYSTEM_LOGO`
- `EXPORT_EXCEL`, `EXPORT_PDF`
- `CHANGE_THEME`

**Indexes:**
- INDEX on `(userId, timestamp)`
- INDEX on `(entityType, entityId)`
- INDEX on `(action, timestamp)`
- INDEX on `timestamp`

### 2.7 SystemSetting
Key-value store untuk konfigurasi sistem (nama, logo path, theme, LDAP config).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | String(cuid) | PK | |
| key | String | UQ, NOT NULL | |
| value | String | NOT NULL (text) | JSON-encoded untuk complex value |
| updatedAt | DateTime | NOT NULL, auto | |
| updatedById | String | FK → User.id | |

**Default Settings:**
| Key | Default Value | Description |
|-----|---------------|-------------|
| `system.name` | `"SecChangeLog"` | Nama sistem |
| `system.logoPath` | `null` | Path ke custom logo |
| `system.defaultTheme` | `"dark"` | Default theme |
| `ldap.enabled` | `false` | Aktifkan LDAP auth |
| `ldap.url` | `""` | ldap://server:389 |
| `ldap.bindDn` | `""` | |
| `ldap.bindPassword` | `""` | Encrypted |
| `ldap.searchBase` | `""` | |
| `ldap.searchFilter` | `"(sAMAccountName={username})"` | |
| `password.minLength` | `"10"` | |
| `password.requireUppercase` | `"true"` | |
| `password.requireLowercase` | `"true"` | |
| `password.requireNumber` | `"true"` | |
| `password.requireSymbol` | `"true"` | |
| `password.maxAgeDays` | — | Tidak diimplementasikan (tidak ada setting ini di kode) |
| `upload.maxFileSizeMb` | `"10"` | |
| `session.timeoutHours` | `"8"` | |

### 2.8 NextAuth Tables
Model `Account`, `Session`, `VerificationToken` ada di schema (kompatibel dengan
adapter NextAuth v4), namun **tidak aktif dipakai** — aplikasi memakai strategi
**JWT session** dengan provider `Credentials` (custom LDAP + password). Karena itu
tabel-tabel tersebut tetap kosong; data sesi ada di cookie JWT, bukan di DB.

---

## 3. Prisma Schema (Reference)

Schema lengkap ada di `prisma/schema.prisma`. Provider aktif saat ini **SQLite**:

```prisma
datasource db {
  provider = "sqlite"  // aktif: SQLite (file)
  url      = env("DATABASE_URL") // file:./database.db
}
```

> **Migrasi ke MySQL** (opsional): ganti `provider` ke `mysql`, set `DATABASE_URL`
> MySQL, lalu `prisma migrate deploy`. Karena tipe kolom memang dirancang portabel
> (String, Int, Boolean, DateTime), mayoritas tidak perlu perubahan. Untuk standalone
> MySQL, gunakan `@db.Text` / `@db.VarChar(255)` bila diinginkan.

---

## 4. Data Migration Path

### 4.1 Sandbox → Production
1. Export data dari SQLite: `sqlite3 db/app.db .dump > dump.sql`
2. Transform syntax SQLite → MySQL (sedikit perbedaan)
3. Import ke MySQL: `mysql -u user -p db < dump.sql`
4. Atau lebih mudah: gunakan Prisma seed script untuk copy data via ORM

### 4.2 Schema Migration
- Selalu gunakan `prisma migrate dev` untuk development
- `prisma migrate deploy` untuk production
- **Backup database sebelum migration di production**

---

## 5. Data Retention Policy

| Entity | Retention | Action |
|--------|-----------|--------|
| ChangeLog (active) | 7 tahun | Tidak dihapus (compliance) |
| ChangeLog (soft-deleted) | 1 tahun | Hard delete setelah 1 tahun |
| AuditTrail | 7 tahun | Tidak dihapus (compliance) |
| DeleteRequest | 1 tahun setelah resolved | Hard delete |
| Sessions | Sesuai expiry | Auto-cleaned |
| User (deactivated) | 7 tahun | Soft delete, data tetap untuk audit |

**Implementation**: cron job mingguan untuk hard delete data yang sudah expired.

---

## 6. Backup & Recovery

### 6.1 Backup Schedule
- **Daily full backup**: 02:00 WIB, mysqldump, encrypted dengan GPG
- **Binary log**: continuous, untuk point-in-time recovery
- **Offsite copy**: backup dikirim ke S3-compatible storage 03:00 WIB

### 6.2 Recovery Procedures
- **RPO (Recovery Point Objective)**: ≤ 24 jam (daily backup)
- **RTO (Recovery Time Objective)**: ≤ 4 jam
- **Test restore**: bulanan, di staging environment

### 6.3 Backup Verification
- Setiap backup diverifikasi: restore ke staging, jalankan query test
- Checksum verification
- Log backup status ke monitoring

---

## 7. Performance Considerations

### 7.1 Query Optimization
- Gunakan Prisma `select` untuk ambil hanya kolom yang dibutuhkan
- Pagination dengan cursor-based (lebih cepat untuk offset besar)
- Eager loading dengan `include` untuk relasi (hindari N+1)
- Count query terpisah (lebih cepat daripada count + data di satu query)

### 7.2 Index Strategy
- Index dibuat berdasarkan query pattern yang sering dipakai
- Monitor slow query log MySQL
- Composite index untuk filter + sort kombinasi umum

### 7.3 Connection Pooling
- Prisma default connection pool: `?connection_limit=10`
- Production: naikkan ke `?connection_limit=20` sesuai concurrent users
- Monitor pool usage, slow queries

---

## 8. Security di Database Level

### 8.1 Encryption at Rest
- MySQL: enable `innodb_encrypt_tables=ON`
- Atau: disk encryption (LUKS untuk Linux)

### 8.2 Encryption for Sensitive Fields
- `passwordHash`: bcrypt (sudah aman secara design)
- `ldap.bindPassword` di SystemSetting: encrypt dengan AES-256-GCM, key dari env var

### 8.3 Database User Privileges (Production)
- App user: SELECT, INSERT, UPDATE, DELETE pada schema aplikasi
- Migration user: + CREATE, ALTER, DROP, INDEX (hanya untuk migration)
- Backup user: SELECT + LOCK TABLES

### 8.4 SQL Injection Prevention
- **Prisma selalu parameterize queries** — tidak ada raw SQL injection vector
- Jika butuh raw SQL (`$queryRaw`), selalu gunakan tagged template literal: `prisma.$queryRaw\`SELECT * FROM x WHERE id = ${id}\``
- Validasi input tetap dilakukan dengan Zod sebelum query

---

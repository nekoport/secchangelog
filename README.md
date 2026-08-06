# SecChangeLog
### Sistem Pencatatan Perubahan Konfigurasi Cyber Security

[![Status: Production-Ready](https://img.shields.io/badge/Status-Production--Ready-success)](docs/security-audit-report.json)
[![OWASP: 100% Pass](https://img.shields.io/badge/OWASP-100%25%20Pass-brightgreen)](docs/05-Security-OWASP.md)
[![License: Internal](https://img.shields.io/badge/License-Internal-blue)]()

> Sistem pencatatan perubahan konfigurasi perangkat jaringan dan keamanan dengan audit trail lengkap, compliance reporting, dan standar keamanan OWASP. Dibangun khusus untuk tim Cyber Security.

---

## 📋 Daftar Isi

- [Fitur Utama](#-fitur-utama)
- [Tech Stack](#-tech-stack)
- [Quick Start](#-quick-start)
- [Dokumentasi](#-dokumentasi)
- [Default Admin Credentials](#-default-admin-credentials)
- [Screenshots](#-screenshots)
- [Security & Compliance](#-security--compliance)
- [Kontribusi](#-kontribusi)

---

## ✨ Fitur Utama

### Pencatatan Perubahan
- ✅ Form pencatatan perubahan konfigurasi lengkap (Switch, MikroTik, Palo Alto, dan custom)
- ✅ Upload screenshot bukti before/after (PNG, JPEG, WEBP, PDF - maks 10MB)
- ✅ Auto-generate Ticket ID format: `CHG-YYYY-NNNN`
- ✅ Field: jenis perangkat, hostname, IP, jenis perubahan, risk level, status, PIC, rollback plan
- ✅ Validasi input ketat (Zod schemas)

### Delete Approval Workflow
- ✅ Engineer dapat mengajukan penghapusan dengan alasan
- ✅ Supervisor/Admin harus approve sebelum change log dihapus
- ✅ Soft delete dengan audit trail (data tidak benar-benar hilang)
- ✅ Admin bisa restore change log yang sudah dihapus

### Dashboard & Analytics
- ✅ Statistik real-time: total change logs, per bulan, per perangkat, per risk level
- ✅ Grafik tren 30 hari terakhir
- ✅ Distribusi risk level (pie chart)
- ✅ Top PIC contributors
- ✅ Recent activity feed
- ✅ Pending delete requests badge

### Settings & Customization (Admin)
- ✅ Custom system name (langsung update di seluruh UI)
- ✅ Upload custom logo (PNG/WEBP/SVG, maks 2MB)
- ✅ Default theme (dark/light)
- ✅ Manajemen jenis perangkat (CRUD)
- ✅ Konfigurasi LDAP/Active Directory
- ✅ Password policy configuration
- ✅ User management (CRUD, role, activation, password reset)

### Export & Reporting
- ✅ Export Excel (.xlsx) dengan filter aktif — 2 sheet (data + summary)
- ✅ Export PDF per change log — lengkap dengan screenshot embedded
- ✅ Audit trail lengkap untuk compliance (ISO 27001, PCI-DSS)

### Security (OWASP Top 10 Compliant)
- ✅ bcrypt password hashing (cost factor 12)
- ✅ JWT session dengan httpOnly cookie
- ✅ Account lockout setelah 5 percobaan gagal (15 menit)
- ✅ Rate limiting per IP & per user
- ✅ File upload: magic number validation, size limit, filename sanitization, path traversal prevention
- ✅ RBAC: Engineer, Supervisor, Admin, Auditor
- ✅ Audit trail untuk semua aksi penting
- ✅ Security headers: HSTS, X-Frame-Options, CSP, X-Content-Type-Options, Referrer-Policy
- ✅ Prisma ORM (SQL injection prevention)
- ✅ Zod validation di semua API endpoints
- ✅ LDAP injection prevention
- ✅ 100% pass rate pada OWASP security audit (20/20 checks)

### UI/UX
- ✅ Dark theme default (SOC-style dengan neon teal accent)
- ✅ Light theme toggle
- ✅ Responsive (mobile, tablet, desktop)
- ✅ Custom scrollbar styling
- ✅ Bahasa Indonesia untuk semua label

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) + React 19 |
| Language | TypeScript 5 (strict mode) |
| UI | Tailwind CSS 4 + shadcn/ui + Lucide icons |
| State | Zustand + TanStack Query |
| Database | MySQL 8 (production) / SQLite (sandbox) |
| ORM | Prisma 6 |
| Auth | NextAuth.js v4 + bcrypt + LDAP-ready |
| Charts | Recharts |
| Export | xlsx (Excel) + pdfkit (PDF) |
| Validation | Zod |
| File Storage | Local filesystem |

---

## 🚀 Quick Start

### Prasyarat
- Node.js 20+ atau Bun 1.1+
- MySQL 8 (production) atau SQLite (development)

### Installation

```bash
# Clone repo
git clone <repo-url>
cd secchangelog

# Install dependencies
bun install

# Setup environment
cp .env.example .env
# Edit .env dengan nilai yang sesuai

# Push schema ke database
bun run db:push

# Seed default admin & device types
bun run scripts/seed.ts

# Start dev server
bun run dev
```

Buka `http://localhost:3000` di browser.

---

## 🔐 Default Admin Credentials

Setelah seed, admin default:

```
Email:    admin@secchangelog.local
Password: Admin@12345
```

⚠️ **WAJIB ganti password setelah login pertama!**

---

## 📚 Dokumentasi

Semua dokumentasi profesional ada di folder `docs/`:

| Document | Description |
|----------|-------------|
| [`01-PRD.md`](docs/01-PRD.md) | Product Requirements Document — requirements, user personas, acceptance criteria |
| [`02-Architecture.md`](docs/02-Architecture.md) | System architecture, folder structure, design decisions |
| [`03-Database-Schema.md`](docs/03-Database-Schema.md) | ERD, table definitions, indexing strategy, backup & retention |
| [`04-API-Specification.md`](docs/04-API-Specification.md) | REST API endpoints, request/response format, error codes |
| [`05-Security-OWASP.md`](docs/05-Security-OWASP.md) | OWASP Top 10 compliance matrix, security architecture, pentest checklist |
| [`06-Deployment-Guide.md`](docs/06-Deployment-Guide.md) | Production deployment, Nginx config, backup, monitoring, DR |
| [`security-audit-report.json`](docs/security-audit-report.json) | Latest automated OWASP audit results (100% pass) |

---

## 📸 Screenshots

Screenshots preview ada di folder `download/`:
- `dark-theme-preview.png` — tampilan dark theme (default)
- `light-theme-preview.png` — tampilan light theme

---

## 🛡 Security & Compliance

### OWASP Top 10 (2021) — 100% Pass Rate

| Category | Status |
|----------|--------|
| A01: Broken Access Control | ✅ Pass |
| A02: Cryptographic Failures | ✅ Pass |
| A03: Injection | ✅ Pass |
| A04: Insecure Design | ✅ Pass |
| A05: Security Misconfiguration | ✅ Pass |
| A06: Vulnerable Components | ✅ Pass |
| A07: Auth Failures | ✅ Pass |
| A08: Integrity Failures | ✅ Pass |
| A09: Logging Failures | ✅ Pass |
| A10: SSRF | ✅ Pass |

Run security audit:
```bash
bun run scripts/security-audit.ts
```

### Compliance Mapping
- **ISO 27001:2022**: A.5.16, A.5.17, A.5.18, A.8.9, A.8.15, A.8.16
- **PCI-DSS v4.0**: 7.2, 8.3, 10.2, 10.4, 11.3

---

## 🗄 Database Schema

Lihat [`docs/03-Database-Schema.md`](docs/03-Database-Schema.md) untuk ERD lengkap.

**Entities utama:**
- User (dengan RBAC: Engineer, Supervisor, Admin, Auditor)
- DeviceType (CRUD by admin)
- ChangeLog (core entity)
- Screenshot (file bukti before/after)
- DeleteRequest (approval workflow)
- AuditTrail (forensik & compliance)
- SystemSetting (key-value config)
- NextAuth tables (Account, Session, VerificationToken)

---

## 🌐 Production Deployment

Lihat [`docs/06-Deployment-Guide.md`](docs/06-Deployment-Guide.md) untuk panduan lengkap.

### Quick Production Setup

1. **Switch ke MySQL**:
   ```prisma
   datasource db {
     provider = "mysql"
     url      = env("DATABASE_URL")
   }
   ```

2. **Generate secrets**:
   ```bash
   openssl rand -base64 32  # NEXTAUTH_SECRET
   openssl rand -base64 32  # LDAP_ENCRYPTION_KEY
   ```

3. **Build & deploy**:
   ```bash
   bun run build
   pm2 start "bun .next/standalone/server.js" --name secchangelog
   ```

4. **Setup Nginx reverse proxy** dengan SSL Let's Encrypt (lihat deployment guide)

---

## 🧪 Testing

```bash
# Lint check
bun run lint

# Security audit
bun run scripts/security-audit.ts
```

---

## 📁 Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (dashboard)/        # Protected pages
│   ├── api/                # REST API endpoints
│   ├── login/              # Login page
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Main SPA page
├── components/
│   ├── ui/                 # shadcn/ui components
│   ├── layout/             # App shell, sidebar
│   ├── change-logs/        # Domain components
│   ├── dashboard/          # Dashboard widgets
│   ├── settings/           # Settings & user management
│   └── shared/             # Theme toggle, logo
├── lib/
│   ├── auth-options.ts     # NextAuth config
│   ├── ldap.ts             # LDAP adapter
│   ├── constants.ts        # App constants
│   ├── db.ts               # Prisma client
│   ├── session.ts          # Session helpers
│   ├── security/           # Rate limit, password, file validation
│   ├── services/           # Business logic (Service Layer pattern)
│   └── validations/        # Zod schemas
├── providers/              # Theme & Query providers
├── types/                  # TypeScript type augmentations
└── middleware.ts           # Auth & security headers

docs/                       # Professional documentation
scripts/                    # Seed, security audit, maintenance
prisma/schema.prisma        # Database schema (single source of truth)
public/uploads/             # User-uploaded files (gitignored)
```

---

## 🔧 Configuration

### Environment Variables

```bash
DATABASE_URL="mysql://user:pass@localhost:3306/secchangelog"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
NEXTAUTH_URL="https://changelog.company.com"
LDAP_ENCRYPTION_KEY="generate-with-openssl-rand-base64-32"
UPLOAD_DIR="/var/www/secchangelog/uploads"
MAX_FILE_SIZE_MB=10
NODE_ENV="production"
```

---

## 🤝 Kontribusi

1. Fork repo
2. Buat feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push ke branch (`git push origin feature/amazing-feature`)
5. Buat Pull Request

### Coding Standards
- TypeScript strict mode
- ESLint + Prettier
- Zod validation untuk semua input
- Audit trail untuk semua mutasi data
- Service Layer pattern untuk business logic

---

## 📄 License

Internal use only. © 2026 Cyber Security Team.

---

## 📞 Support

- **Tech Lead**: [TBD]
- **Documentation**: `/docs/`
- **Issues**: Internal bug tracker

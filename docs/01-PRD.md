# Product Requirements Document (PRD)
## SecChangeLog — Sistem Pencatatan Perubahan Konfigurasi Cyber Security

| Field | Value |
|-------|-------|
| Document Version | 1.0.0 |
| Status | Final |
| Author | Engineering Team |
| Last Updated | 2026-08-06 |
| Reviewers | Head of Cyber Security, IT Manager |

---

## 1. Ringkasan Eksekutif

**SecChangeLog** adalah sistem pencatatan perubahan konfigurasi perangkat jaringan dan keamanan yang dirancang khusus untuk tim Cyber Security. Sistem ini mencatat seluruh aktivitas perubahan konfigurasi pada perangkat seperti Switch, Router MikroTik, Firewall Palo Alto, dan perangkat lainnya, lengkap dengan bukti screenshot sebelum dan sesudah perubahan.

Sistem dibangun dengan standar keamanan OWASP, mendukung autentikasi lokal maupun LDAP, serta menyediakan audit trail yang lengkap untuk kebutuhan compliance (ISO 27001, PCI-DSS, SOC 2).

---

## 2. Latar Belakang & Masalah

Tim Cyber Security rutin melakukan perubahan konfigurasi pada berbagai perangkat (switch, router, firewall). Saat ini pencatatan dilakukan manual via spreadsheet atau chat, yang menyebabkan:

- **Tidak ada audit trail yang reliable** — sulit melacak siapa mengubah apa, kapan, dan mengapa
- **Bukti perubahan hilang** — screenshot tersebar di chat/email, sulit ditemukan saat audit
- **Tidak ada rollback plan terdokumentasi** — saat terjadi insiden, sulit memutar balik perubahan
- **Sulit menghasilkan laporan compliance** — tidak ada single source of truth
- **Risiko keamanan** — perubahan tidak terdokumentasi = celah untuk audit forensik

---

## 3. Tujuan & Sasaran

### Tujuan Utama
1. Menyediakan single source of truth untuk seluruh perubahan konfigurasi perangkat cyber security
2. Memastikan setiap perubahan terdokumentasi dengan bukti visual (screenshot before/after)
3. Memfasilitasi audit compliance dengan export laporan terstruktur
4. Mencegah penghapusan catatan tanpa persetujuan supervisor

### Sasaran Terukur
- 100% perubahan konfigurasi tercatat dalam sistem dalam ≤ 24 jam setelah implementasi
- Waktu pencarian riwayat perubahan turun dari rata-rata 30 menit menjadi < 30 detik
- Laporan audit bulanan dapat di-generate dalam < 5 menit
- Penghapusan catatan membutuhkan persetujuan supervisor (zero unauthorized deletion)

---

## 4. Stakeholder & User Personas

| Role | Deskripsi | Permission |
|------|-----------|------------|
| **Engineer** | Anggota tim yang melakukan perubahan konfigurasi | Create, read, update own records; cannot delete |
| **Supervisor** | Penanggung jawab yang menyetujui penghapusan | All engineer permissions + approve/reject deletion |
| **Admin** | Administrator sistem | Full access, manage users, manage device types, manage system settings |
| **Auditor (read-only)** | Auditor internal/eksternal | Read-only access untuk semua catatan & export |

---

## 5. Functional Requirements

### 5.1 Authentication & User Management
- **FR-AUTH-01**: Sistem mendukung login dengan username/password (bcrypt hashing)
- **FR-AUTH-02**: Sistem mendukung autentikasi via LDAP/Active Directory (configurable)
- **FR-AUTH-03**: Session management dengan JWT (NextAuth), expiry 8 jam (tanpa refresh token terpisah)
- **FR-AUTH-04**: Password policy: minimum 10 karakter, kombinasi huruf besar/kecil/angka/simbol
- **FR-AUTH-05**: Account lockout setelah 5 percobaan gagal selama 15 menit
- **FR-AUTH-06**: Admin dapat CRUD user accounts
- **FR-AUTH-07**: Role-based access control (RBAC): Engineer, Supervisor, Admin, Auditor

### 5.2 Change Log Management
- **FR-CHG-01**: Engineer dapat membuat change log baru dengan field:
  - Ticket ID (auto-generate format: `CHG-YYYY-NNNN`)
  - Tanggal & waktu perubahan
  - Jenis perangkat (dynamic, configurable dari admin settings)
  - Nama/host perangkat
  - IP address perangkat
  - Jenis perubahan (ACL, Routing, NAT, Interface, Security Policy, VPN, DLL)
  - Deskripsi perubahan (before → after)
  - Alasan perubahan
  - Risk level (Low / Medium / High / Critical)
  - PIC engineer
  - Rollback plan
  - Status (Draft / Implemented / Verified)
- **FR-CHG-02**: Engineer dapat upload multiple screenshot bukti (before & after)
- **FR-CHG-03**: Engineer dapat edit catatan sendiri selama status masih Draft
- **FR-CHG-04**: Setelah status Implemented, catatan terkunci (read-only) kecuali oleh Admin
- **FR-CHG-05**: Sistem mencatat audit trail: siapa, kapan, apa yang diubah

### 5.3 Delete Approval Workflow
- **FR-DEL-01**: Engineer dapat mengajukan request hapus catatan
- **FR-DEL-02**: Request hapus masuk ke antrian persetujuan supervisor
- **FR-DEL-03**: Supervisor dapat approve atau reject request hapus
- **FR-DEL-04**: Setelah approve, catatan di-soft delete (tetap ada di DB, marked as deleted)
- **FR-DEL-05**: Hanya Admin yang dapat hard delete (permanent) untuk keperluan housekeeping
- **FR-DEL-06**: Sistem mencatat siapa yang request, approve, dan eksekusi penghapusan

### 5.4 Device Type Management
- **FR-DEV-01**: Admin dapat menambah jenis perangkat baru (selain Switch/MikroTik/Palo Alto)
- **FR-DEV-02**: Setiap perangkat dapat memiliki field konfigurasi kustom (optional)
- **FR-DEV-03**: Device type dapat diaktifkan/nonaktifkan (tidak bisa dihapus jika masih digunakan)

### 5.5 Settings & Customization
- **FR-SET-01**: Admin dapat mengubah nama sistem (system name)
- **FR-SET-02**: Admin dapat upload custom logo (PNG/SVG, max 2MB)
- **FR-SET-03**: Admin dapat mengubah default theme (light/dark)
- **FR-SET-04**: Admin dapat mengatur LDAP configuration
- **FR-SET-05**: Admin dapat mengatur password policy

### 5.6 Dashboard & Analytics
- **FR-DASH-01**: Dashboard menampilkan statistik: total change logs, per bulan, per perangkat, per PIC, per risk level
- **FR-DASH-02**: Grafik trend perubahan 30 hari terakhir
- **FR-DASH-03**: Recent activity feed
- **FR-DASH-04**: Pending deletion approvals (untuk supervisor)

### 5.7 Search & Filter
- **FR-SRCH-01**: Search by Ticket ID, device name, IP, PIC, description
- **FR-SRCH-02**: Filter by date range, device type, risk level, status, PIC
- **FR-SRCH-03**: Sort by any column (ascending/descending)
- **FR-SRCH-04**: Pagination (default 20 per page, max 100)

### 5.8 Reporting & Export
- **FR-RPT-01**: Export list change logs ke Excel (.xlsx) dengan filter aktif
- **FR-RPT-02**: Export detail single change log ke PDF (termasuk screenshot)
- **FR-RPT-03**: Export monthly summary report ke PDF
- **FR-RPT-04**: Export audit trail log ke Excel

---

## 6. Non-Functional Requirements

### 6.1 Security (OWASP Top 10 Compliance)
- **NFR-SEC-01**: Protection against SQL Injection (Prisma parameterized queries)
- **NFR-SEC-02**: Protection against XSS (React auto-escaping; CSP tidak di-set di aplikasi, disarankan via reverse proxy)
- **NFR-SEC-03**: Protection against CSRF (SameSite cookies; NextAuth built-in CSRF)
- **NFR-SEC-04**: Protection against brute force (rate limiting per IP/user)
- **NFR-SEC-05**: Secure password hashing (bcrypt, cost factor 12)
- **NFR-SEC-06**: HTTPS-only in production (HSTS headers di reverse proxy / Caddy)
- **NFR-SEC-07**: Security headers: X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- **NFR-SEC-08**: File upload validation: type whitelist (PNG/JPEG/WEBP/PDF), size limit, magic number validation
- **NFR-SEC-09**: No sensitive data in logs
- **NFR-SEC-10**: Input validation on all API endpoints (Zod schemas)

### 6.2 Performance
- **NFR-PERF-01**: Page load < 2 detik (First Contentful Paint)
- **NFR-PERF-02**: API response < 500ms untuk query biasa
- **NFR-PERF-03**: Support 50 concurrent users
- **NFR-PERF-04**: File upload max 10MB per file, 50MB per request

### 6.3 Availability
- **NFR-AVL-01**: Uptime target 99.5% (business hours)
- **NFR-AVL-02**: Daily database backup
- **NFR-AVL-03**: Graceful error handling, no white screen

### 6.4 Usability
- **NFR-USE-01**: Responsive design (mobile, tablet, desktop)
- **NFR-USE-02**: Dark theme default dengan toggle light theme
- **NFR-USE-03**: Keyboard accessible (WCAG 2.1 AA)
- **NFR-USE-04**: Bahasa Indonesia untuk UI labels

### 6.5 Maintainability
- **NFR-MAIN-01**: Code coverage > 70% untuk business logic
- **NFR-MAIN-02**: TypeScript strict mode
- **NFR-MAIN-03**: ESLint + Prettier enforced
- **NFR-MAIN-04**: Dokumentasi inline untuk semua API endpoints

---

## 7. Tech Stack

| Layer | Technology | Alasan |
|-------|-----------|--------|
| Frontend | Next.js 16 (App Router) + React 19 | SSR, file-based routing, modern |
| UI | Tailwind CSS 4 + shadcn/ui + Lucide icons | Konsistensi visual, aksesibilitas |
| State | Zustand (client) + TanStack Query (server) | Lightweight, performant |
| Backend | Next.js API Routes | Single codebase, type-safe (tanpa Server Actions) |
| ORM | Prisma 6 | Type-safe, migration support |
| Database | SQLite (file, deploy Docker) | Tanpa infrastruktur DB terpisah; MySQL opsional |
| Auth | NextAuth.js v4 + bcrypt + LDAP custom provider | Flexible, secure |
| File Storage | Local filesystem (`/uploads`, Docker volume) | Sesuai request, bisa di-upgrade ke S3 |
| Charts | Recharts | React-native, responsive |
| Export | `xlsx` (Excel) + `pdfkit` (PDF) | Tanpa dependency browser |
| Validation | Zod | Type-safe runtime validation |

---

## 8. Data Model (High-Level)

Detail lengkap di dokumen `03-Database-Schema.md`.

**Entities utama:**
- User (id, email, name, role, passwordHash, ldapDn?, ...)
- DeviceType (id, name, isActive, ...)
- ChangeLog (id, ticketId, deviceId, deviceType, changeType, description, ...)
- Screenshot (id, changeLogId, filename, mimeType, size, type [before/after], ...)
- DeleteRequest (id, changeLogId, requestedBy, status, approvedBy?, ...)
- AuditTrail (id, userId, action, entityType, entityId, metadata, timestamp)
- SystemSetting (key, value) — untuk nama sistem, logo, theme, LDAP config
- Session (NextAuth managed)

---

## 9. User Flow Utama

### 9.1 Engineer Mencatat Perubahan
```
Login → Klik "New Change Log" → Isi form (device, change type, before/after, alasan, risk, rollback plan) → Upload screenshot before → Upload screenshot after → Submit → Catatan tersimpan dengan status "Implemented" → Audit trail tercatat
```

### 9.2 Engineer Request Hapus Catatan
```
Buka change log → Klik "Request Delete" → Isi alasan → Submit → Request masuk antrian supervisor → Engineer dapat lihat status request di "My Deletion Requests"
```

### 9.3 Supervisor Approve/Reject Delete
```
Login → Dashboard menampilkan badge "Pending Delete Approvals" → Buka "Delete Requests" → Review detail → Approve atau Reject dengan komentar → Catatan di-soft delete (jika approve) → Audit trail tercatat
```

### 9.4 Auditor Export Laporan
```
Login → Buka list change logs → Apply filter (date range, device, PIC) → Klik "Export to Excel" → File .xlsx diunduh
```

### 9.5 Admin Custom Sistem
```
Login → Settings → Upload logo baru → Ganti system name → Set default theme → Save → Perubahan langsung tampil di seluruh UI
```

---

## 10. Out of Scope (MVP)

Berikut fitur yang **TIDAK** termasuk dalam MVP v1:
- Integrasi auto-pull config dari perangkat (SSH/Telnet automation)
- Real-time notification (email/Slack) — akan di v2
- Multi-tenant organization support
- Mobile app native
- Single Sign-On dengan SAML/OAuth (LDAP sudah cukup untuk v1)
- Approval workflow untuk create change (hanya deletion yang perlu approval)
- Version diff visualization untuk config text

---

## 11. Acceptance Criteria

MVP dinyatakan selesai jika:
- [x] User dapat login & logout dengan aman (register tidak termasuk MVP; user dibuat oleh admin)
- [ ] Engineer dapat membuat, melihat, edit (draft) change log
- [ ] Engineer dapat upload screenshot before/after (multiple files)
- [ ] Engineer dapat request delete, supervisor dapat approve/reject
- [ ] Soft delete berfungsi, audit trail tercatat
- [ ] Admin dapat CRUD device types
- [ ] Admin dapat mengubah nama sistem & upload logo
- [ ] Dashboard menampilkan statistik & grafik dengan benar
- [ ] Search & filter berfungsi dengan pagination
- [ ] Export Excel berfungsi dengan filter aktif
- [ ] Export PDF per change log berfungsi (termasuk screenshot)
- [ ] Light/Dark theme berfungsi (default dark)
- [ ] LDAP configuration tersedia (dapat di-enable/disable)
- [ ] Tidak ada vulnerability OWASP Top 10 yang critical/high
- [ ] Aplikasi berjalan di production build tanpa error

---

## 12. Risk & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Data loss (database corruption) | Low | Critical | Daily backup, transaction support |
| Unauthorized access | Medium | Critical | bcrypt + RBAC + audit trail |
| Malicious file upload | Medium | High | Magic number validation, size limit, antivirus scan |
| LDAP server down | Low | Medium | Fallback ke local auth, log warning |
| Screenshot storage penuh | Medium | Medium | Monitoring disk usage, archive policy |

---

## 13. Timeline & Milestones

| Phase | Deliverable | Duration |
|-------|-------------|----------|
| Phase 1 | Documentation (PRD, architecture, API, security) | 1 day |
| Phase 2 | Database schema, auth, base UI | 1 day |
| Phase 3 | Change log CRUD + upload + delete workflow | 1 day |
| Phase 4 | Settings, dashboard, export | 0.5 day |
| Phase 5 | Security audit, testing, polish | 0.5 day |

---

## 14. Glossary

- **Change Log**: Catatan satu kali perubahan konfigurasi pada perangkat
- **PIC**: Person In Charge — engineer yang melakukan perubahan
- **Risk Level**: Tingkat risiko perubahan (Low/Medium/High/Critical)
- **Rollback Plan**: Rencana membatalkan perubahan jika terjadi masalah
- **Audit Trail**: Log lengkap aktivitas user untuk forensik & compliance
- **Soft Delete**: Data ditandai deleted tetapi tidak benar-benar dihapus dari DB
- **RBAC**: Role-Based Access Control — kontrol akses berbasis peran user
- **OWASP**: Open Web Application Security Project — standar keamanan aplikasi web

#!/bin/bash
# Zip source code + ALL documentation (MD, PDF, screenshots) for download
set -e

PROJECT_DIR="/home/z/my-project"
OUTPUT_FILE="/home/z/my-project/download/secchangelog-complete.zip"
WORK_DIR="/tmp/secchangelog-zip"

echo "📦 Creating COMPLETE zip (source + all documents)..."
echo ""

# Clean previous
rm -f "$OUTPUT_FILE"
rm -rf "$WORK_DIR"
mkdir -p "$WORK_DIR/secchangelog"

cd "$PROJECT_DIR"

# rsync excludes
cat > /tmp/rsync-excludes.txt << 'EOF'
node_modules
.next
.git
.zscripts
dev.log
server.log
.env
db/*.db
db/*.db-journal
public/uploads/screenshots/*
public/uploads/logos/*
.pdfkit-data
upload
tests
examples
mini-services
skills
*.log
.DS_Store
EOF

# Copy source code (excluding download/, node_modules, etc)
rsync -a \
  --exclude-from='/tmp/rsync-excludes.txt' \
  --exclude='download/' \
  ./ "$WORK_DIR/secchangelog/"

# Create empty uploads directories
mkdir -p "$WORK_DIR/secchangelog/public/uploads/screenshots"
mkdir -p "$WORK_DIR/secchangelog/public/uploads/logos"
mkdir -p "$WORK_DIR/secchangelog/db"
touch "$WORK_DIR/secchangelog/public/uploads/screenshots/.gitkeep"
touch "$WORK_DIR/secchangelog/public/uploads/logos/.gitkeep"

# Create documentation folder with ALL documents
mkdir -p "$WORK_DIR/secchangelog/documentation"

# Copy all .md docs (already in docs/, but also add to documentation/ for visibility)
cp "$PROJECT_DIR"/docs/*.md "$WORK_DIR/secchangelog/documentation/" 2>/dev/null || true
cp "$PROJECT_DIR"/docs/*.json "$WORK_DIR/secchangelog/documentation/" 2>/dev/null || true

# Copy PDF documentation
cp "$PROJECT_DIR"/download/SecChangeLog-Documentation.pdf "$WORK_DIR/secchangelog/documentation/" 2>/dev/null || true

# Create screenshots folder
mkdir -p "$WORK_DIR/secchangelog/documentation/screenshots"
cp "$PROJECT_DIR"/download/ui-*.png "$WORK_DIR/secchangelog/documentation/screenshots/" 2>/dev/null || true
cp "$PROJECT_DIR"/download/dark-theme-preview.png "$WORK_DIR/secchangelog/documentation/screenshots/" 2>/dev/null || true
cp "$PROJECT_DIR"/download/light-theme-preview.png "$WORK_DIR/secchangelog/documentation/screenshots/" 2>/dev/null || true
cp "$PROJECT_DIR"/download/dashboard-with-edit-verify.png "$WORK_DIR/secchangelog/documentation/screenshots/" 2>/dev/null || true

# Add INSTALL.md quick start guide
cat > "$WORK_DIR/secchangelog/INSTALL.md" << 'INSTALL_EOF'
# SecChangeLog - Installation Guide

## Quick Start (Development)

```bash
# 1. Install dependencies
bun install

# 2. Copy env template and edit
cp .env.example .env
# Edit .env with your values (especially NEXTAUTH_SECRET)

# 3. Setup database (SQLite for dev)
bun run db:push

# 4. Seed default admin & device types
bun run scripts/seed.ts

# 5. Start dev server
bun run dev
```

Open http://localhost:3000 and login with:
- Email: admin@secchangelog.local
- Password: Admin@12345

## Production Deployment

See `docs/06-Deployment-Guide.md` or `documentation/06-Deployment-Guide.md` for complete production setup.

## Switch to MySQL

1. Edit `prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "mysql"
     url      = env("DATABASE_URL")
   }
   ```

2. Update `DATABASE_URL` in `.env`

3. Run migration:
   ```bash
   bun run db:migrate --name init
   ```

## Documentation

All documentation is in:
- `docs/` - Markdown source files
- `documentation/` - Complete documentation (MD + PDF + screenshots)

## Security Audit

```bash
bun run scripts/security-audit.ts
```

## Default Credentials

⚠️ CHANGE PASSWORD AFTER FIRST LOGIN!

- Email: admin@secchangelog.local
- Password: Admin@12345
INSTALL_EOF

# Add DOCUMENTATION.md index
cat > "$WORK_DIR/secchangelog/documentation/README.md" << 'DOC_EOF'
# SecChangeLog - Documentation Index

This folder contains all project documentation.

## Documents

| File | Description |
|------|-------------|
| 01-PRD.md | Product Requirements Document |
| 02-Architecture.md | System Architecture & Tech Stack |
| 03-Database-Schema.md | Database Design (ERD, tables, indexing) |
| 04-API-Specification.md | REST API Endpoints |
| 05-Security-OWASP.md | OWASP Top 10 Compliance |
| 06-Deployment-Guide.md | Production Deployment Guide |
| SecChangeLog-Documentation.pdf | All docs combined in PDF |
| security-audit-report.json | Automated OWASP audit result (100% pass) |

## Screenshots

Folder `screenshots/` contains UI previews:
- ui-01-login.png - Login page
- ui-02-dashboard.png - Dashboard (dark theme)
- ui-03-change-logs-list.png - Change logs list
- ui-04-detail-dialog.png - Detail dialog with Verify button
- ui-05-new-log-form.png - New change log form
- ui-06-settings-general.png - Settings - General
- ui-07-settings-device-types.png - Settings - Device types
- ui-08-settings-ldap.png - Settings - LDAP config
- ui-09-audit-trail.png - Audit trail
- ui-10-user-management.png - User management
- ui-11-profile.png - Profile page (change password)
- ui-12-dashboard-light-theme.png - Dashboard (light theme)
- ui-13-delete-requests.png - Delete requests approval
- dark-theme-preview.png - Dark theme preview
- light-theme-preview.png - Light theme preview
- dashboard-with-edit-verify.png - Dashboard with edit/verify features
DOC_EOF

# Create the zip
cd "$WORK_DIR"
zip -r "$OUTPUT_FILE" secchangelog/ -q

# Show result
echo "✅ Complete zip created successfully!"
echo ""
ls -lh "$OUTPUT_FILE" | awk '{print "File:", $9, "| Size:", $5}'

FILE_COUNT=$(find "$WORK_DIR/secchangelog" -type f | wc -l)
echo "Files included: $FILE_COUNT"
echo ""

# Show documentation folder contents
echo "=== Documentation Folder ==="
ls -la "$WORK_DIR/secchangelog/documentation/" | tail -15
echo ""
echo "=== Screenshots Folder ==="
ls "$WORK_DIR/secchangelog/documentation/screenshots/" | head -20

# Cleanup
rm -rf "$WORK_DIR" /tmp/rsync-excludes.txt

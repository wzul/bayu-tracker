#!/usr/bin/env sh
# backup-postgres.sh
# Daily PostgreSQL dump uploaded to RustFS (S3-compatible object storage)
# Usage: ./scripts/backup-postgres.sh

set -euo pipefail

# Configuration (override via environment variables)
PG_HOST="${PG_HOST:-postgres}"
PG_PORT="${PG_PORT:-5432}"
PG_USER="${POSTGRES_USER:-user}"
PG_PASSWORD="${POSTGRES_PASSWORD:-pass}"
PG_DB="${POSTGRES_DB:-condo_db}"

RUSTFS_ENDPOINT="${RUSTFS_ENDPOINT:-http://rustfs:9000}"
RUSTFS_ACCESS_KEY="${RUSTFS_ACCESS_KEY:-rustfs}"
RUSTFS_SECRET_KEY="${RUSTFS_SECRET_KEY:-rustfspass}"
RUSTFS_BUCKET="${RUSTFS_BUCKET:-condo-maintenance}"
BACKUP_PREFIX="${BACKUP_PREFIX:-postgres-backup}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"

# Timestamped filename
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DUMP_FILE="/tmp/${BACKUP_PREFIX}_${PG_DB}_${TIMESTAMP}.sql.gz"
OBJECT_KEY="${BACKUP_PREFIX}/${PG_DB}/${BACKUP_PREFIX}_${TIMESTAMP}.sql.gz"

echo "=== Starting PostgreSQL backup ==="
echo "Database: ${PG_DB}@${PG_HOST}:${PG_PORT}"
echo "Target  : ${RUSTFS_BUCKET}/${OBJECT_KEY}"

# Ensure mc (MinIO client) is available
if ! command -v mc >/dev/null 2>&1; then
    echo ">>> MinIO client (mc) not found. Attempting to install..."
    # Try common locations / static fetch
    if command -v wget >/dev/null 2>&1; then
        wget -q https://dl.min.io/client/mc/release/linux-amd64/mc -O /tmp/mc
        chmod +x /tmp/mc
        export PATH="/tmp:${PATH}"
    elif command -v curl >/dev/null 2>&1; then
        curl -sL https://dl.min.io/client/mc/release/linux-amd64/mc -o /tmp/mc
        chmod +x /tmp/mc
        export PATH="/tmp:${PATH}"
    else
        echo "ERROR: Neither mc, wget, nor curl is available. Cannot proceed."
        exit 1
    fi
fi

# Create dump
export PGPASSWORD="${PG_PASSWORD}"
echo ">>> Running pg_dump..."
pg_dump -h "${PG_HOST}" -p "${PG_PORT}" -U "${PG_USER}" -F p "${PG_DB}" | gzip > "${DUMP_FILE}"
echo ">>> Dump created: ${DUMP_FILE} ($(du -sh "${DUMP_FILE}" | cut -f1))"

# Configure mc alias for RustFS
mc alias set rustfs "${RUSTFS_ENDPOINT}" "${RUSTFS_ACCESS_KEY}" "${RUSTFS_SECRET_KEY}" --api S3v4 >/dev/null

# Ensure bucket exists (ignore errors if it already exists)
mc mb "rustfs/${RUSTFS_BUCKET}" 2>/dev/null || true

# Upload dump
echo ">>> Uploading to RustFS..."
mc cp "${DUMP_FILE}" "rustfs/${RUSTFS_BUCKET}/${OBJECT_KEY}"

echo ">>> Upload complete: rustfs/${RUSTFS_BUCKET}/${OBJECT_KEY}"

# Cleanup local file
rm -f "${DUMP_FILE}"

# Optional: remove backups older than RETENTION_DAYS
echo ">>> Removing backups older than ${RETENTION_DAYS} days..."
mc rm --recursive --force --older-than "${RETENTION_DAYS}d" "rustfs/${RUSTFS_BUCKET}/${BACKUP_PREFIX}/" 2>/dev/null || true

echo "=== Backup finished successfully ==="

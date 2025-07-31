#!/bin/bash

# Database Backup Script for Production
# This script creates automated backups with rotation

set -e

# Configuration
DB_NAME=${POSTGRES_DB:-"offline_wallet"}
DB_USER=${POSTGRES_USER:-"postgres"}
DB_HOST=${DB_HOST:-"localhost"}
DB_PORT=${DB_PORT:-"5432"}
BACKUP_DIR="/backups"
RETENTION_DAYS=30
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/backup_${DB_NAME}_${DATE}.sql"

# Create backup directory if it doesn't exist
mkdir -p ${BACKUP_DIR}

# Create database backup
echo "Starting database backup..."
pg_dump -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} -d ${DB_NAME} \
    --verbose --clean --no-owner --no-privileges \
    --format=custom --compress=9 \
    --file=${BACKUP_FILE}

# Compress the backup
gzip ${BACKUP_FILE}
BACKUP_FILE="${BACKUP_FILE}.gz"

echo "Backup created: ${BACKUP_FILE}"

# Calculate backup size
BACKUP_SIZE=$(du -h ${BACKUP_FILE} | cut -f1)
echo "Backup size: ${BACKUP_SIZE}"

# Remove old backups (older than retention period)
echo "Cleaning up old backups..."
find ${BACKUP_DIR} -name "backup_${DB_NAME}_*.sql.gz" -mtime +${RETENTION_DAYS} -delete

# Verify backup integrity
echo "Verifying backup integrity..."
if gzip -t ${BACKUP_FILE}; then
    echo "Backup integrity check passed"
else
    echo "ERROR: Backup integrity check failed!"
    exit 1
fi

# Log backup completion
echo "$(date): Database backup completed successfully - ${BACKUP_FILE}" >> ${BACKUP_DIR}/backup.log

# Optional: Upload to cloud storage (uncomment and configure as needed)
# aws s3 cp ${BACKUP_FILE} s3://your-backup-bucket/database-backups/
# gsutil cp ${BACKUP_FILE} gs://your-backup-bucket/database-backups/

echo "Database backup completed successfully!"
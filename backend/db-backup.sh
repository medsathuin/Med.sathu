#!/bin/bash

# ==========================================
# MEDSATHU.INN - DATABASE BACKUP
# ==========================================

BACKUP_DIR="/backups/medsathu"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/medsathu_$DATE.gz"

# ========== CREATE BACKUP ==========
echo "💾 Creating database backup..."
mkdir -p $BACKUP_DIR
mongodump --uri=$MONGODB_URI --archive=$BACKUP_FILE --gzip

# ========== UPLOAD TO S3 ==========
echo "☁️ Uploading to S3..."
aws s3 cp $BACKUP_FILE s3://medsathu-backups/backups/

# ========== RETAIN LAST 7 DAYS ==========
echo "🧹 Cleaning old backups..."
find $BACKUP_DIR -name "*.gz" -mtime +7 -delete

# ========== SEND NOTIFICATION ==========
echo "📧 Sending notification..."
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
    -d "chat_id=$TELEGRAM_CHAT_ID" \
    -d "text=✅ Database backup completed: $BACKUP_FILE"

echo "✅ Backup complete!"
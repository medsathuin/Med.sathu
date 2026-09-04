#!/bin/bash

# ==========================================
# MEDSATHU.INN - DATABASE RESTORE
# ==========================================

BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
    echo "❌ Please provide backup file path"
    echo "Usage: ./db-restore.sh /path/to/backup.gz"
    exit 1
fi

echo "🔄 Restoring database from $BACKUP_FILE..."
mongorestore --uri=$MONGODB_URI --archive=$BACKUP_FILE --gzip

echo "✅ Database restore complete!"
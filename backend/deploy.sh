#!/bin/bash

# ==========================================
# MEDSATHU.INN - QUICK DEPLOY
# ==========================================

echo "🚀 Starting deployment..."

# ========== BACKEND ==========
echo "📦 Building backend..."
cd backend
npm ci --only=production
npm run build
pm2 restart medsathu-backend || pm2 start src/server.js --name medsathu-backend

# ========== WEBSITE ==========
echo "📦 Building website..."
cd ../website
npm ci
npm run build
pm2 restart medsathu-website || pm2 start npm --name medsathu-website -- start

# ========== NGINX RELOAD ==========
echo "🔄 Reloading nginx..."
sudo nginx -t && sudo systemctl reload nginx

# ========== DATABASE BACKUP ==========
echo "💾 Creating database backup..."
mongodump --uri=$MONGODB_URI --out=/backups/medsathu/$(date +%Y%m%d)

echo "✅ Deployment complete!"
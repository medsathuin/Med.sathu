#!/bin/bash

# ==========================================
# MEDSATHU.INN - QUICK LAUNCH
# ==========================================

# ========== 1. START BACKEND ==========
echo "🚀 Starting backend..."
cd /var/www/medsathu/backend
pm2 start src/server.js --name medsathu-backend --env production

# ========== 2. START WEBSITE ==========
echo "🚀 Starting website..."
cd /var/www/medsathu/website
pm2 start node_modules/.bin/next --name medsathu-website -- start

# ========== 3. STATUS CHECK ==========
echo "📊 Checking services..."
pm2 status

# ========== 4. HEALTH CHECK ==========
echo "🏥 Checking health..."
sleep 5
curl -s https://api.medsathu.inn/health

# ========== 5. LOGS ==========
echo "📋 Viewing logs..."
pm2 logs --lines 20

echo "✅ Medsathu.inn is running!"
#!/bin/bash

# ==========================================
# MEDSATHU.INN - COMPLETE SERVER SETUP
# ==========================================

echo "🚀 Starting Medsathu.inn server setup..."

# ========== CHECK ROOT ==========
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Please run as root (sudo ./server-setup.sh)"
    exit 1
fi

# ========== 1. UPDATE SYSTEM ==========
echo "📦 Updating system..."
apt-get update -y
apt-get upgrade -y

# ========== 2. INSTALL ESSENTIALS ==========
echo "📦 Installing essential packages..."
apt-get install -y \
    git \
    curl \
    wget \
    build-essential \
    nginx \
    fail2ban \
    ufw

# ========== 3. INSTALL NODE.JS ==========
echo "📦 Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# ========== 4. INSTALL PM2 ==========
echo "📦 Installing PM2..."
npm install -g pm2

# ========== 5. INSTALL MONGODB ==========
echo "📦 Installing MongoDB..."
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/7.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list
apt-get update -y
apt-get install -y mongodb-org
systemctl start mongod
systemctl enable mongod

# ========== 6. INSTALL REDIS ==========
echo "📦 Installing Redis..."
apt-get install -y redis-server
systemctl start redis-server
systemctl enable redis-server

# ========== 7. INSTALL CERTBOT ==========
echo "📦 Installing Certbot..."
apt-get install -y certbot python3-certbot-nginx

# ========== 8. CLONE REPOSITORY ==========
echo "📥 Cloning repository..."
mkdir -p /var/www/medsathu
cd /var/www/medsathu
git clone https://github.com/YOUR_USERNAME/medsathu-inn.git .

# ========== 9. INSTALL BACKEND ==========
echo "📦 Installing backend..."
cd /var/www/medsathu/backend
npm ci --only=production
cp .env.example .env.production

# ========== 10. INSTALL WEBSITE ==========
echo "📦 Installing website..."
cd /var/www/medsathu/website
npm ci
npm run build

# ========== 11. INSTALL MOBILE APP ==========
echo "📦 Installing mobile app..."
cd /var/www/medsathu/mobile-app
npm ci

# ========== 12. RUN FIREWALL SCRIPTS ==========
echo "🛡️ Running firewall scripts..."
cd /var/www/medsathu
chmod +x *.sh
./firewall-setup.sh
./advanced-firewall-setup.sh
./ddos-protection.sh

# ========== 13. START PM2 ==========
echo "🚀 Starting PM2..."
cd /var/www/medsathu
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# ========== 14. SET UP SSL ==========
echo "🔐 Setting up SSL..."
certbot --nginx -d medsathu.inn -d www.medsathu.inn -d api.medsathu.inn \
    --non-interactive --agree-tos --email rathodsathunayak@gmail.com

# ========== 15. SHOW STATUS ==========
echo ""
echo "═══════════════════════════════════════════"
echo "✅ SERVER SETUP COMPLETE!"
echo "═══════════════════════════════════════════"
pm2 status
echo ""
echo "🌐 Website: https://medsathu.inn"
echo "🔗 API: https://api.medsathu.inn"
echo "═══════════════════════════════════════════"
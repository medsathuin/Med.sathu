#!/bin/bash

# ==========================================
# MEDSATHU.INN - PRODUCTION SERVER SETUP
# ==========================================

echo "🖥️ Starting Medsathu.inn production server setup..."

# ========== 1. UPDATE SYSTEM ==========
echo "📦 Updating system..."
sudo apt-get update -y
sudo apt-get upgrade -y

# ========== 2. INSTALL NODE.JS ==========
echo "📦 Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# ========== 3. INSTALL PM2 ==========
echo "📦 Installing PM2..."
sudo npm install -g pm2

# ========== 4. INSTALL NGINX ==========
echo "📦 Installing Nginx..."
sudo apt-get install -y nginx

# ========== 5. INSTALL MONGODB ==========
echo "📦 Installing MongoDB..."
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt-get update -y
sudo apt-get install -y mongodb-org
sudo systemctl start mongod
sudo systemctl enable mongod

# ========== 6. INSTALL REDIS ==========
echo "📦 Installing Redis..."
sudo apt-get install -y redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server

# ========== 7. INSTALL CERTBOT (SSL) ==========
echo "📦 Installing Certbot..."
sudo apt-get install -y certbot python3-certbot-nginx

# ========== 8. CLONE REPOSITORY ==========
echo "📥 Cloning repository..."
cd /var/www
sudo mkdir -p medsathu
sudo chown -R $USER:$USER medsathu
cd medsathu
git clone https://github.com/YOUR_USERNAME/medsathu-inn.git .

# ========== 9. INSTALL BACKEND ==========
echo "📦 Installing backend..."
cd backend
npm ci --only=production
cp .env.example .env
# Edit .env with production values

# ========== 10. INSTALL WEBSITE ==========
echo "📦 Installing website..."
cd ../website
npm ci
npm run build

# ========== 11. INSTALL MOBILE APP ==========
echo "📦 Installing mobile app..."
cd ../mobile-app
npm ci

# ========== 12. SET UP NGINX ==========
echo "📦 Configuring Nginx..."
sudo cp /var/www/medsathu/nginx.conf /etc/nginx/sites-available/medsathu
sudo ln -s /etc/nginx/sites-available/medsathu /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# ========== 13. SET UP PM2 ==========
echo "📦 Configuring PM2..."
cd /var/www/medsathu
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# ========== 14. SET UP SSL ==========
echo "🔐 Setting up SSL certificates..."
sudo certbot --nginx -d medsathu.inn -d www.medsathu.inn -d api.medsathu.inn \
    --non-interactive --agree-tos --email admin@medsathu.inn

# ========== 15. SET UP LOG ROTATION ==========
echo "📦 Setting up log rotation..."
sudo tee /etc/logrotate.d/medsathu << EOF
/var/log/medsathu/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 0640 ubuntu ubuntu
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
EOF

# ========== 16. SET UP MONITORING ==========
echo "📦 Setting up monitoring..."
sudo tee /etc/cron.d/medsathu-monitor << EOF
*/5 * * * * ubuntu cd /var/www/medsathu && node monitoring.js
0 0 * * * ubuntu cd /var/www/medsathu && mongodump --out=/backups/medsathu/\$(date +%Y%m%d)
EOF

echo "✅ Production server setup complete!"
echo ""
echo "🌐 Website: https://medsathu.inn"
echo "🔗 API: https://api.medsathu.inn"
echo "📱 App: https://play.google.com/store/apps/details?id=com.medsathu.inn"
echo ""
echo "🔑 PM2 Commands:"
echo "  pm2 status      - Check services"
echo "  pm2 logs        - View logs"
echo "  pm2 restart all - Restart all services"
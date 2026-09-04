#!/bin/bash

# ==========================================
# MEDSATHU.INN - AWS DEPLOYMENT SCRIPT
# ==========================================

echo "🚀 Starting Medsathu.inn AWS deployment..."

# ========== 1. SET VARIABLES ==========
EC2_IP="your-ec2-ip"
EC2_USER="ubuntu"
SSH_KEY_PATH="~/.ssh/medsathu-key.pem"
PROJECT_DIR="/var/www/medsathu"

# ========== 2. SSH INTO EC2 ==========
ssh -i $SSH_KEY_PATH $EC2_USER@$EC2_IP << 'ENDSSH'

echo "🔑 Connected to EC2 instance..."

# ========== 3. UPDATE SYSTEM ==========
sudo apt-get update -y
sudo apt-get upgrade -y

# ========== 4. INSTALL DOCKER ==========
if ! command -v docker &> /dev/null; then
    echo "📦 Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $EC2_USER
fi

# ========== 5. INSTALL DOCKER COMPOSE ==========
if ! command -v docker-compose &> /dev/null; then
    echo "📦 Installing Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi

# ========== 6. CREATE PROJECT DIRECTORY ==========
mkdir -p $PROJECT_DIR
cd $PROJECT_DIR

# ========== 7. CLONE OR PULL REPO ==========
if [ -d ".git" ]; then
    echo "🔄 Pulling latest code..."
    git pull origin main
else
    echo "📥 Cloning repository..."
    git clone https://github.com/YOUR_USERNAME/medsathu-inn.git .
fi

# ========== 8. CREATE .ENV FILE ==========
cat > .env << 'EOFENV'
# Production Environment Variables
NODE_ENV=production
JWT_SECRET=your_secure_jwt_secret_change_this
ADMIN_EMAIL=admin@medsathu.inn
ADMIN_PASSWORD=SecureAdminPassword123
MONGO_ROOT_USER=medsathu_admin
MONGO_ROOT_PASSWORD=SecureMongoPassword456
EMAIL_HOST=smtp.gmail.com
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxx
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxx
OPENAI_API_KEY=sk-xxxxxxxxxx
GEMINI_API_KEY=xxxxxxxxxx
API_URL=https://api.medsathu.inn
FRONTEND_URL=https://medsathu.inn
EOFENV

# ========== 9. SSL CERTIFICATES ==========
echo "🔐 Setting up SSL certificates..."
sudo apt-get install -y certbot
sudo systemctl stop nginx || true
sudo certbot certonly --standalone -d medsathu.inn -d www.medsathu.inn -d api.medsathu.inn \
    --non-interactive --agree-tos --email admin@medsathu.inn

# Copy certificates to nginx SSL directory
sudo mkdir -p /etc/nginx/ssl
sudo cp /etc/letsencrypt/live/medsathu.inn/fullchain.pem /etc/nginx/ssl/medsathu.crt
sudo cp /etc/letsencrypt/live/medsathu.inn/privkey.pem /etc/nginx/ssl/medsathu.key
sudo cp /etc/letsencrypt/live/medsathu.inn/fullchain.pem /etc/nginx/ssl/api.medsathu.crt
sudo cp /etc/letsencrypt/live/medsathu.inn/privkey.pem /etc/nginx/ssl/api.medsathu.key

# ========== 10. START APPLICATION ==========
echo "🚀 Starting Medsathu.inn services..."
sudo docker-compose down
sudo docker-compose up -d --build

# ========== 11. CHECK HEALTH ==========
sleep 10
echo "🏥 Checking health status..."
curl -s https://api.medsathu.inn/health

echo "✅ Deployment complete!"
echo "🌐 Website: https://medsathu.inn"
echo "🔗 API: https://api.medsathu.inn"

ENDSSH

echo "🎉 Medsathu.inn deployed successfully!"
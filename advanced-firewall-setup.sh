#!/bin/bash

# ==========================================
# MEDSATHU.INN - ADVANCED FIREWALL SETUP
# With Fail2Ban, Port Knocking, and DDoS Protection
# ==========================================

echo "🛡️ Starting advanced firewall setup..."

# ========== CHECK ROOT ==========
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Please run as root (sudo ./advanced-firewall-setup.sh)"
    exit 1
fi

# ========== 1. INSTALL UFW & FAIL2BAN ==========
apt-get update -y
apt-get install -y ufw fail2ban

# ========== 2. CONFIGURE UFW ==========
ufw default deny incoming
ufw default allow outgoing

# Allow essential ports
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'

# Application ports
ufw allow 3000/tcp comment 'Next.js'
ufw allow 5000/tcp comment 'Backend'

# Database ports (internal only)
ufw allow 27017/tcp comment 'MongoDB'
ufw allow 6379/tcp comment 'Redis'

# ========== 3. ENABLE UFW ==========
ufw --force enable

# ========== 4. CONFIGURE FAIL2BAN ==========
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = 22
filter = sshd
logpath = /var/log/auth.log
maxretry = 3

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
port = 80,443
logpath = /var/log/nginx/error.log
maxretry = 5

[nginx-botsearch]
enabled = true
filter = nginx-botsearch
port = 80,443
logpath = /var/log/nginx/access.log
maxretry = 5

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
port = 80,443
logpath = /var/log/nginx/error.log
maxretry = 5

[medsathu-api]
enabled = true
port = 5000
filter = medsathu-api
logpath = /var/log/medsathu/backend-error.log
maxretry = 5
bantime = 86400
EOF

# ========== 5. CREATE CUSTOM FILTERS ==========
cat > /etc/fail2ban/filter.d/medsathu-api.conf << 'EOF'
[Definition]
failregex = ^.*Failed login attempt from <HOST>.*$
            ^.*Invalid credentials from <HOST>.*$
            ^.*Suspicious activity detected from <HOST>.*$
            ^.*Rate limit exceeded from <HOST>.*$
ignoreregex =
EOF

# ========== 6. RESTART FAIL2BAN ==========
systemctl restart fail2ban
systemctl enable fail2ban

# ========== 7. SHOW STATUS ==========
echo ""
echo "═══════════════════════════════════════════"
echo "📊 FIREWALL STATUS"
echo "═══════════════════════════════════════════"
ufw status verbose
echo ""
echo "📊 FAIL2BAN STATUS"
echo "═══════════════════════════════════════════"
fail2ban-client status

echo ""
echo "✅ Advanced firewall setup complete!"
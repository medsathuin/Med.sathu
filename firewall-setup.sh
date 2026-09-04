#!/bin/bash

# ==========================================
# MEDSATHU.INN - FIREWALL SETUP
# ==========================================

echo "🛡️ Starting Medsathu.inn firewall setup..."

# ========== COLORS FOR OUTPUT ==========
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ========== CHECK ROOT ==========
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}❌ Please run as root (sudo ./firewall-setup.sh)${NC}"
    exit 1
fi

# ========== 1. INSTALL UFW ==========
echo -e "${YELLOW}📦 Installing UFW (Uncomplicated Firewall)...${NC}"
apt-get update -y
apt-get install -y ufw

# ========== 2. SET DEFAULT POLICIES ==========
echo -e "${YELLOW}🔧 Setting default policies...${NC}"
ufw default deny incoming
ufw default allow outgoing

# ========== 3. ALLOW SSH (IMPORTANT!) ==========
echo -e "${YELLOW}🔓 Allowing SSH (port 22)...${NC}"
ufw allow 22/tcp comment 'SSH'

# ========== 4. ALLOW WEB PORTS ==========
echo -e "${YELLOW}🌐 Allowing web ports...${NC}"
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'

# ========== 5. ALLOW APPLICATION PORTS ==========
echo -e "${YELLOW}📦 Allowing application ports...${NC}"
ufw allow 3000/tcp comment 'Next.js Website'
ufw allow 5000/tcp comment 'Backend API'

# ========== 6. ALLOW DATABASE PORTS (Internal Only) ==========
echo -e "${YELLOW}🗄️ Allowing database ports...${NC}"
ufw allow 27017/tcp comment 'MongoDB'
ufw allow 6379/tcp comment 'Redis'

# ========== 7. RATE LIMITING (Prevent DDoS) ==========
echo -e "${YELLOW}⏱️ Setting up rate limiting...${NC}"
# Limit SSH attempts
ufw limit 22/tcp comment 'SSH Rate Limit'

# ========== 8. ALLOW SPECIFIC IPs (OPTIONAL) ==========
# Uncomment and add your IPs if you want to restrict access
# echo -e "${YELLOW}🔒 Allowing specific IPs...${NC}"
# ufw allow from YOUR_IP to any port 22 comment 'Admin SSH'
# ufw allow from YOUR_IP to any port 80 comment 'Admin HTTP'
# ufw allow from YOUR_IP to any port 443 comment 'Admin HTTPS'

# ========== 9. ENABLE FIREWALL ==========
echo -e "${YELLOW}🔥 Enabling firewall...${NC}"
ufw --force enable

# ========== 10. SHOW STATUS ==========
echo -e "${GREEN}✅ Firewall configured successfully!${NC}"
echo ""
echo "═══════════════════════════════════════════"
echo "📊 FIREWALL STATUS"
echo "═══════════════════════════════════════════"
ufw status verbose
echo "═══════════════════════════════════════════"

# ========== 11. SAVE CONFIGURATION ==========
echo -e "${YELLOW}💾 Saving firewall rules...${NC}"
ufw reload

echo -e "${GREEN}✅ Firewall setup complete!${NC}"
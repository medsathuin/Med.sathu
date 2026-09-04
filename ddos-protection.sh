#!/bin/bash

# ==========================================
# MEDSATHU.INN - DDoS PROTECTION
# ==========================================

echo "🛡️ Configuring DDoS protection..."

# ========== CHECK ROOT ==========
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Please run as root"
    exit 1
fi

# ========== 1. INSTALL CLOUDFLARE (Recommended) ==========
echo "🌐 Setting up Cloudflare integration..."
# Add Cloudflare IPs to allow list
CLOUDFLARE_IPS=(
    "173.245.48.0/20"
    "103.21.244.0/22"
    "103.22.200.0/22"
    "103.31.4.0/22"
    "141.101.64.0/18"
    "108.162.192.0/18"
    "190.93.240.0/20"
    "188.114.96.0/20"
    "197.234.240.0/22"
    "198.41.128.0/17"
    "162.158.0.0/15"
    "104.16.0.0/13"
    "104.24.0.0/14"
    "172.64.0.0/13"
    "131.0.72.0/22"
)

for ip in "${CLOUDFLARE_IPS[@]}"; do
    ufw allow from $ip to any port 80,443 proto tcp comment 'Cloudflare'
done

# ========== 2. CONFIGURE SYNFLOOD PROTECTION ==========
echo "🔧 Configuring SYN flood protection..."
cat >> /etc/sysctl.conf << 'EOF'

# ========== SYN Flood Protection ==========
net.ipv4.tcp_syncookies = 1
net.ipv4.tcp_syn_retries = 2
net.ipv4.tcp_synack_retries = 2
net.ipv4.tcp_max_syn_backlog = 1024

# ========== IP Spoofing Protection ==========
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1

# ========== ICMP Protection ==========
net.ipv4.icmp_echo_ignore_all = 0
net.ipv4.icmp_echo_ignore_broadcasts = 1
net.ipv4.icmp_ignore_bogus_error_responses = 1

# ========== Connection Tracking ==========
net.netfilter.nf_conntrack_max = 65536
net.netfilter.nf_conntrack_tcp_timeout_established = 3600
EOF

# ========== 3. APPLY SYSCONFIG ==========
sysctl -p

# ========== 4. CONFIGURE NGINX RATE LIMITING ==========
echo "📦 Configuring Nginx rate limiting..."
cat >> /etc/nginx/nginx.conf << 'EOF'

# ========== Global Rate Limiting ==========
limit_req_zone $binary_remote_addr zone=ddos:10m rate=10r/s;
limit_conn_zone $binary_remote_addr zone=conn_per_ip:10m;

server {
    # Limit connections per IP
    limit_conn conn_per_ip 10;
    limit_req zone=ddos burst=20 nodelay;
}
EOF

# ========== 5. RELOAD NGINX ==========
nginx -t && systemctl reload nginx

echo "✅ DDoS protection configured!"
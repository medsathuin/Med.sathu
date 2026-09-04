#!/bin/bash

# ==========================================
# MEDSATHU.INN - FIREWALL STATUS
# ==========================================

echo "═══════════════════════════════════════════"
echo "🛡️ FIREWALL STATUS REPORT"
echo "═══════════════════════════════════════════"

# ========== UFW STATUS ==========
echo ""
echo "📊 UFW STATUS"
echo "───────────────────────────────────────────"
ufw status verbose

# ========== LISTENING PORTS ==========
echo ""
echo "🔌 LISTENING PORTS"
echo "───────────────────────────────────────────"
ss -tulpn | grep LISTEN

# ========== FAIL2BAN STATUS ==========
if command -v fail2ban-client &> /dev/null; then
    echo ""
    echo "📊 FAIL2BAN STATUS"
    echo "───────────────────────────────────────────"
    fail2ban-client status
fi

# ========== CONNECTION TRACKING ==========
echo ""
echo "🔗 CONNECTIONS TRACKED"
echo "───────────────────────────────────────────"
if [ -f /proc/net/nf_conntrack ]; then
    cat /proc/net/nf_conntrack | head -20
else
    echo "Connection tracking not available"
fi

# ========== LAST 20 SECURITY EVENTS ==========
echo ""
echo "📋 LAST 20 SECURITY EVENTS"
echo "───────────────────────────────────────────"
sudo journalctl -u ufw --since "1 hour ago" | tail -20

echo ""
echo "═══════════════════════════════════════════"
echo "✅ Status report complete!"
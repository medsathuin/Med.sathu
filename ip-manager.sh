#!/bin/bash

# ==========================================
# MEDSATHU.INN - IP MANAGEMENT
# ==========================================

# ========== USAGE ==========
usage() {
    echo "Usage: $0 {blacklist|whitelist|list|remove} [IP]"
    echo "  blacklist IP   - Block an IP address"
    echo "  whitelist IP   - Allow an IP address"
    echo "  list           - List all rules"
    echo "  remove IP      - Remove a rule"
    exit 1
}

# ========== CHECK ROOT ==========
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Please run as root"
    exit 1
fi

# ========== COMMAND HANDLING ==========
case "$1" in
    blacklist)
        if [ -z "$2" ]; then
            echo "❌ Please provide IP address"
            usage
        fi
        echo "🚫 Blocking IP: $2"
        ufw deny from $2
        echo "✅ IP $2 blocked"
        ;;
    whitelist)
        if [ -z "$2" ]; then
            echo "❌ Please provide IP address"
            usage
        fi
        echo "✅ Allowing IP: $2"
        ufw allow from $2
        echo "✅ IP $2 whitelisted"
        ;;
    list)
        echo "📋 Current rules:"
        ufw status numbered
        ;;
    remove)
        if [ -z "$2" ]; then
            echo "❌ Please provide IP address"
            usage
        fi
        echo "🗑️ Removing rule for IP: $2"
        ufw delete allow from $2 2>/dev/null
        ufw delete deny from $2 2>/dev/null
        echo "✅ Rule removed"
        ;;
    *)
        usage
        ;;
esac
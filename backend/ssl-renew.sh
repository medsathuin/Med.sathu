#!/bin/bash

# ==========================================
# MEDSATHU.INN - SSL RENEWAL
# ==========================================

echo "🔐 Renewing SSL certificates..."
sudo certbot renew --quiet

# ========== RELOAD NGINX ==========
sudo systemctl reload nginx

# ========== SEND NOTIFICATION ==========
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
    -d "chat_id=$TELEGRAM_CHAT_ID" \
    -d "text=✅ SSL certificates renewed successfully!"

echo "✅ SSL renewal complete!"
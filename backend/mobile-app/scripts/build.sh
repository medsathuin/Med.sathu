#!/bin/bash

# ==========================================
# MEDSATHU.INN - MOBILE BUILD SCRIPT
# ==========================================

echo "📱 Building Medsathu.inn mobile app..."

# ========== INSTALL DEPENDENCIES ==========
echo "📦 Installing dependencies..."
npm install

# ========== BUILD ANDROID ==========
echo "🤖 Building Android APK..."
expo build:android --type apk

# ========== BUILD IOS ==========
echo "🍎 Building iOS IPA..."
expo build:ios --type archive

# ========== SUBMIT TO PLAY STORE ==========
echo "📤 Submitting to Google Play Store..."
expo upload:android --latest

# ========== SUBMIT TO APP STORE ==========
echo "📤 Submitting to Apple App Store..."
expo upload:ios --latest

echo "✅ Mobile app build complete!"
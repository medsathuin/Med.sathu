const ContentProtection = require('../models/ContentProtection');
const SecurityLog = require('../models/SecurityLog');
const User = require('../models/User');

class ContentProtectionService {
  
  // ========== APPLY WATERMARK ==========
  applyWatermark(content, userId, contentId, type) {
    // This would modify the content to include a watermark
    // For text content (notes, syllabus), add invisible watermark
    // For video/PDF, overlay watermark

    const user = User.findById(userId);
    const watermarkText = `Medsathu.inn | ${user.name} | ${new Date().toISOString().split('T')[0]}`;

    return {
      watermark: {
        text: watermarkText,
        position: 'diagonal',
        opacity: 0.3,
        applied: true,
      },
      content,
    };
  }

  // ========== CHECK ACCESS ==========
  async checkAccess(userId, resourceType, resourceId) {
    const protection = await ContentProtection.findOne({ resourceType, resourceId });
    if (!protection) return { allowed: true };

    // Check if user is owner
    if (protection.owner.toString() === userId) return { allowed: true };

    // Check IP restrictions
    // This would be done at the request level

    // Check expiration
    if (protection.usageLimits.expireAfter && new Date() > protection.usageLimits.expireAfter) {
      return { allowed: false, reason: 'Content expired' };
    }

    // Check view limits
    if (protection.usageLimits.maxViews > 0 && protection.views >= protection.usageLimits.maxViews) {
      return { allowed: false, reason: 'View limit reached' };
    }

    // Check if content is protected
    if (!protection.isProtected) return { allowed: true };

    return { allowed: true };
  }

  // ========== CREATE PROTECTION ==========
  async createProtection(userId, resourceType, resourceId, settings = {}) {
    const protection = new ContentProtection({
      resourceType,
      resourceId,
      owner: userId,
      watermark: {
        enabled: settings.watermark !== false,
        text: settings.watermarkText || null,
        position: settings.watermarkPosition || 'diagonal',
        opacity: settings.watermarkOpacity || 0.3,
      },
      accessControl: {
        allowedIPs: settings.allowedIPs || [],
        allowedDomains: settings.allowedDomains || [],
        maxDevices: settings.maxDevices || 3,
        maxSessions: settings.maxSessions || 5,
        require2FA: settings.require2FA || false,
      },
      usageLimits: {
        maxViews: settings.maxViews || 0,
        maxDownloads: settings.maxDownloads || 0,
        maxShares: settings.maxShares || 10,
        expireAfter: settings.expireAfter || null,
      },
      copyProtection: {
        disableCopy: settings.disableCopy !== false,
        disablePrint: settings.disablePrint !== false,
        disableScreenshot: settings.disableScreenshot || false,
      },
    });

    await protection.save();
    return protection;
  }

  // ========== TRACK VIEW ==========
  async trackView(resourceType, resourceId) {
    const protection = await ContentProtection.findOne({ resourceType, resourceId });
    if (protection) {
      protection.views += 1;
      protection.lastAccessed = new Date();
      await protection.save();
    }
  }

  // ========== TRACK DOWNLOAD ==========
  async trackDownload(resourceType, resourceId) {
    const protection = await ContentProtection.findOne({ resourceType, resourceId });
    if (protection) {
      protection.downloads += 1;
      await protection.save();
    }
  }

  // ========== GENERATE SHARE TOKEN (with protection) ==========
  async generateShareToken(userId, resourceType, resourceId, options = {}) {
    const protection = await ContentProtection.findOne({ resourceType, resourceId });
    if (!protection) throw new Error('Content not protected');

    // Check share limits
    if (protection.usageLimits.maxShares > 0 && protection.shares >= protection.usageLimits.maxShares) {
      throw new Error('Share limit reached');
    }

    // Generate secure token
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');

    // Store token (would need a ShareToken model)
    // For now, log it
    await SecurityLog.create({
      user: userId,
      action: 'content_share',
      resourceType: resourceType.charAt(0).toUpperCase() + resourceType.slice(1),
      resourceId,
      details: {
        metadata: {
          token,
          expiresAt: options.expiresAt || null,
          maxUses: options.maxUses || null,
        },
      },
      severity: 'info',
    });

    protection.shares += 1;
    await protection.save();

    return token;
  }

  // ========== REMOVE PROTECTION ==========
  async removeProtection(resourceType, resourceId, userId) {
    const protection = await ContentProtection.findOne({ resourceType, resourceId });
    if (!protection) return false;

    if (protection.owner.toString() !== userId) {
      throw new Error('Only owner can remove protection');
    }

    protection.isProtected = false;
    await protection.save();

    return true;
  }
}

module.exports = new ContentProtectionService();
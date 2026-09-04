const mongoose = require('mongoose');

const ContentProtectionSchema = new mongoose.Schema({
  resourceType: {
    type: String,
    enum: ['lecture', 'note', 'syllabus', 'revision', 'qbank'],
    required: true,
  },
  resourceId: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'resourceType' },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // DRM settings
  watermark: {
    enabled: { type: Boolean, default: true },
    text: String,
    position: { type: String, enum: ['center', 'corner', 'diagonal'], default: 'diagonal' },
    opacity: { type: Number, min: 0, max: 1, default: 0.3 },
  },

  // Access control
  accessControl: {
    allowedIPs: [String],
    allowedDomains: [String],
    maxDevices: { type: Number, default: 3 },
    maxSessions: { type: Number, default: 5 },
    require2FA: { type: Boolean, default: false },
  },

  // Usage limits
  usageLimits: {
    maxViews: { type: Number, default: 0 }, // 0 = unlimited
    maxDownloads: { type: Number, default: 0 },
    maxShares: { type: Number, default: 10 },
    expireAfter: { type: Date },
  },

  // Copy protection
  copyProtection: {
    disableCopy: { type: Boolean, default: true },
    disablePrint: { type: Boolean, default: true },
    disableScreenshot: { type: Boolean, default: false }, // Note: can't fully prevent
  },

  // Tracking
  views: { type: Number, default: 0 },
  downloads: { type: Number, default: 0 },
  shares: { type: Number, default: 0 },
  lastAccessed: Date,

  isProtected: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Unique index
ContentProtectionSchema.index({ resourceType: 1, resourceId: 1 }, { unique: true });

module.exports = mongoose.model('ContentProtection', ContentProtectionSchema);
const mongoose = require('mongoose');

const ShareLinkSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  targetType: {
    type: String,
    enum: ['note', 'post', 'syllabus', 'lecture', 'revision_plan', 'course', 'qbank', 'folder'],
    required: true,
  },
  targetId: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'targetType' },
  token: { type: String, unique: true, required: true, index: true },
  password: String, // Optional password protection
  expiresAt: Date,
  maxUses: { type: Number, default: 0 }, // 0 = unlimited
  usedCount: { type: Number, default: 0 },

  // Permissions
  permission: {
    type: String,
    enum: ['view', 'edit', 'comment', 'full'],
    default: 'view',
  },

  // Analytics
  visits: [{
    ip: String,
    userAgent: String,
    timestamp: { type: Date, default: Date.now },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // if logged in
  }],
  lastVisited: Date,

  // Track external shares
  sharedVia: {
    email: [String],
    platform: { type: String, enum: ['whatsapp', 'telegram', 'email', 'link', 'qr'] },
  },

  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Indexes
ShareLinkSchema.index({ token: 1, isActive: 1 });
ShareLinkSchema.index({ user: 1, targetId: 1, targetType: 1 });

// ========== PRE-SAVE: Generate token ==========
ShareLinkSchema.pre('save', function(next) {
  if (!this.token) {
    const crypto = require('crypto');
    this.token = crypto.randomBytes(16).toString('hex');
  }
  this.updatedAt = new Date();
  next();
});

// ========== METHOD: Track visit ==========
ShareLinkSchema.methods.trackVisit = function(ip, userAgent, userId = null) {
  this.visits.push({ ip, userAgent, timestamp: new Date(), user: userId });
  this.usedCount += 1;
  this.lastVisited = new Date();
  return this;
};

// ========== METHOD: Is expired? ==========
ShareLinkSchema.methods.isExpired = function() {
  if (!this.isActive) return true;
  if (this.expiresAt && new Date() > this.expiresAt) return true;
  if (this.maxUses > 0 && this.usedCount >= this.maxUses) return true;
  return false;
};

// ========== METHOD: Get sharing stats ==========
ShareLinkSchema.methods.getStats = function() {
  return {
    totalVisits: this.visits.length,
    uniqueVisitors: new Set(this.visits.map(v => v.user?.toString() || v.ip)).size,
    lastVisited: this.lastVisited,
    usedCount: this.usedCount,
    maxUses: this.maxUses,
    isExpired: this.isExpired(),
  };
};

// ========== STATIC: Find by token with validation ==========
ShareLinkSchema.statics.findByToken = async function(token) {
  const link = await this.findOne({ token, isActive: true });
  if (!link) return null;
  if (link.isExpired()) {
    link.isActive = false;
    await link.save();
    return null;
  }
  return link;
};

module.exports = mongoose.model('ShareLink', ShareLinkSchema);
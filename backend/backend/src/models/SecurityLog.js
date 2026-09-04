const mongoose = require('mongoose');

const SecurityLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  action: {
    type: String,
    enum: [
      'login', 'logout', 'failed_login', '2fa_enabled', '2fa_disabled',
      'password_change', 'email_change', 'profile_update',
      'content_view', 'content_edit', 'content_delete', 'content_share',
      'lecture_join', 'lecture_start', 'lecture_end',
      'note_create', 'note_edit', 'note_delete', 'note_share',
      'syllabus_create', 'syllabus_update', 'syllabus_delete',
      'payment_made', 'subscription_change',
      'admin_action', 'user_ban', 'user_unban',
      'suspicious_activity', 'intrusion_attempt', 'data_export'
    ],
    required: true,
    index: true,
  },
  resourceType: {
    type: String,
    enum: ['user', 'note', 'lecture', 'syllabus', 'revision', 'payment', 'system'],
  },
  resourceId: { type: mongoose.Schema.Types.ObjectId },
  details: {
    ip: String,
    userAgent: String,
    location: String,
    deviceId: String,
    sessionId: String,
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  severity: {
    type: String,
    enum: ['info', 'warning', 'error', 'critical'],
    default: 'info',
  },
  isSuspicious: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now, index: true },
});

// Index for fast querying
SecurityLogSchema.index({ user: 1, createdAt: -1 });
SecurityLogSchema.index({ action: 1, severity: 1 });
SecurityLogSchema.index({ 'details.ip': 1 });

module.exports = mongoose.model('SecurityLog', SecurityLogSchema);
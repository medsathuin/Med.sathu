const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  // Recipient
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

  // Sender (if applicable)
  from: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // Core
  type: {
    type: String,
    enum: [
      'lecture_reminder',
      'revision_reminder',
      'planner_reminder',
      'schedule_reminder',
      'tracker_update',
      'new_message',
      'share_notification',
      'like_notification',
      'comment_notification',
      'friend_request',
      'friend_accepted',
      'system_alert',
      'subscription_expiry',
      'exam_countdown',
      'study_streak',
      'ai_recommendation',
    ],
    required: true,
    index: true,
  },

  // Title & Message (Rich)
  title: { type: String, required: true },
  message: { type: String, required: true },
  htmlMessage: String, // For rich email/push content

  // Deep linking
  targetType: {
    type: String,
    enum: ['lecture', 'revision', 'planner', 'note', 'syllabus', 'post', 'message', 'user', 'course', 'qbank'],
  },
  targetId: { type: mongoose.Schema.Types.ObjectId },
  targetUrl: String,

  // Priority levels
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
  },

  // Channels
  channels: {
    email: { type: Boolean, default: false },
    push: { type: Boolean, default: true },
    inApp: { type: Boolean, default: true },
    sms: { type: Boolean, default: false },
  },

  // Delivery status
  status: {
    type: String,
    enum: ['pending', 'sent', 'delivered', 'read', 'failed'],
    default: 'pending',
  },

  // Read tracking
  readAt: Date,
  clickedAt: Date,
  dismissedAt: Date,

  // Scheduling
  scheduledFor: { type: Date, index: true },
  sentAt: Date,
  expiresAt: Date, // Auto-delete after expiry

  // Recurring notifications
  isRecurring: { type: Boolean, default: false },
  recurrencePattern: {
    frequency: { type: String, enum: ['daily', 'weekly', 'monthly'] },
    interval: { type: Number, default: 1 },
    daysOfWeek: [Number], // 0-6
    timeOfDay: String, // "09:00"
    endDate: Date,
  },

  // Data payload for actions
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
    // Example: { "courseId": "123", "quizId": "456" }
  },

  // Tracking
  retryCount: { type: Number, default: 0 },
  lastError: String,

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Indexes for fast queries
NotificationSchema.index({ user: 1, readAt: 1 });
NotificationSchema.index({ scheduledFor: 1, status: 1 });
NotificationSchema.index({ 'recurrencePattern.frequency': 1, isRecurring: 1 });

// Auto-update timestamps
NotificationSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Static method: mark all as read for user
NotificationSchema.statics.markAllRead = async function(userId) {
  return this.updateMany(
    { user: userId, readAt: null },
    { readAt: new Date() }
  );
};

// Static method: get unread count
NotificationSchema.statics.getUnreadCount = async function(userId) {
  return this.countDocuments({ user: userId, readAt: null });
};

// Instance method: send notification
NotificationSchema.methods.send = async function() {
  const { email, push, inApp } = this.channels;
  const results = [];

  if (inApp) {
    // Already saved in DB
    results.push({ channel: 'inApp', success: true });
  }

  if (email) {
    try {
      await NotificationService.sendEmail(
        this.user.email,
        this.title,
        this.htmlMessage || this.message
      );
      results.push({ channel: 'email', success: true });
    } catch (e) {
      results.push({ channel: 'email', success: false, error: e.message });
    }
  }

  if (push) {
    try {
      await NotificationService.sendPush(this.user, this);
      results.push({ channel: 'push', success: true });
    } catch (e) {
      results.push({ channel: 'push', success: false, error: e.message });
    }
  }

  this.sentAt = new Date();
  this.status = results.some(r => r.success) ? 'sent' : 'failed';
  this.lastError = results.find(r => !r.success)?.error || null;
  await this.save();

  return results;
};

module.exports = mongoose.model('Notification', NotificationSchema);
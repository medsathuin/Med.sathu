const mongoose = require('mongoose');

const ReminderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

  type: {
    type: String,
    enum: [
      'lecture',
      'revision',
      'planner',
      'tracker',
      'schedule',
      'exam',
      'custom',
      'ai_suggested',
    ],
    required: true,
  },

  title: { type: String, required: true },
  description: String,

  // Smart timing
  datetime: { type: Date, required: true, index: true },

  // Smart reminders: send reminder X minutes before
  remindBefore: {
    enabled: { type: Boolean, default: true },
    minutes: { type: Number, default: 30 }, // 30 min before default
    customTimes: [Number], // e.g., [1440, 60, 15] for 1d, 1h, 15min before
  },

  // Smart repetition
  repeat: {
    type: {
      type: String,
      enum: ['none', 'daily', 'weekly', 'biweekly', 'monthly', 'custom'],
      default: 'none',
    },
    interval: Number,
    daysOfWeek: [Number],
    endDate: Date,
    count: Number, // Number of times
  },

  // AI intelligence
  aiSuggestions: {
    suggested: { type: Boolean, default: false },
    reason: String,
    confidence: { type: Number, min: 0, max: 1 },
    alternativeTimes: [Date],
  },

  // Associations
  targetType: {
    type: String,
    enum: ['lecture', 'revision', 'syllabus', 'course', 'plan', 'custom'],
  },
  targetId: { type: mongoose.Schema.Types.ObjectId },

  // Status
  status: {
    type: String,
    enum: ['active', 'completed', 'snoozed', 'dismissed', 'expired'],
    default: 'active',
  },

  // Snooze
  snoozeCount: { type: Number, default: 0 },
  snoozedUntil: Date,
  maxSnoozes: { type: Number, default: 3 },

  // Completion tracking
  completedAt: Date,
  completionNote: String,
  rating: { type: Number, min: 1, max: 5 }, // User rating of reminder

  // Tracking
  lastNotified: Date,
  notificationCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Indexes
ReminderSchema.index({ user: 1, datetime: 1, status: 1 });
ReminderSchema.index({ 'repeat.type': 1, 'repeat.endDate': 1 });

// Pre-save: validate datetime
ReminderSchema.pre('save', function(next) {
  if (this.datetime < new Date()) {
    // Allow past dates for backlog processing
    this.status = this.status === 'active' ? 'expired' : this.status;
  }
  this.updatedAt = new Date();
  next();
});

// Instance method: smart snooze
ReminderSchema.methods.snooze = async function(minutes = 15) {
  if (this.snoozeCount >= this.maxSnoozes) {
    throw new Error('Maximum snoozes reached');
  }
  this.snoozeCount += 1;
  this.snoozedUntil = new Date(Date.now() + minutes * 60 * 1000);
  this.status = 'snoozed';
  await this.save();
  return this;
};

// Instance method: complete with rating
ReminderSchema.methods.complete = async function(rating = 5, note = '') {
  this.status = 'completed';
  this.completedAt = new Date();
  this.rating = rating;
  this.completionNote = note;
  await this.save();
  return this;
};

module.exports = mongoose.model('Reminder', ReminderSchema);
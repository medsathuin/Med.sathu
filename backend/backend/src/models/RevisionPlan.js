const mongoose = require('mongoose');

const RevisionPlanSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true },
  description: String,

  // Associated syllabus
  syllabus: { type: mongoose.Schema.Types.ObjectId, ref: 'Syllabus' },
  subjects: [String],

  // Schedule
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },

  // Revision schedule (spaced repetition)
  schedule: [{
    date: { type: Date, required: true },
    topics: [{
      topicName: String,
      subject: String,
      completed: { type: Boolean, default: false },
      completedAt: Date,
      // Spaced repetition level
      level: { type: Number, default: 1, min: 1, max: 5 },
      // Next review date for spaced repetition
      nextReview: Date,
      // Performance (for adaptive spacing)
      performance: { type: Number, min: 0, max: 100, default: 70 },
    }],
    notes: String,
    completed: { type: Boolean, default: false },
  }],

  // Spaced repetition algorithm parameters
  srParams: {
    initialInterval: { type: Number, default: 1 }, // days
    maxInterval: { type: Number, default: 60 }, // days
    easeFactor: { type: Number, default: 2.5 },
    minimumLevel: { type: Number, default: 1 },
  },

  // Progress
  progress: {
    totalTopics: { type: Number, default: 0 },
    completedTopics: { type: Number, default: 0 },
    overall: { type: Number, default: 0 },
    todayTopics: { type: Number, default: 0 },
    dueTopics: { type: Number, default: 0 },
  },

  // Reminders
  reminders: [{
    type: { type: String, enum: ['daily', 'weekly', 'custom'] },
    time: String, // "09:00"
    sent: { type: Boolean, default: false },
  }],

  // Insights
  insights: {
    streak: { type: Number, default: 0 },
    longestStreak: { type: Number, default: 0 },
    avgDailyTopics: { type: Number, default: 0 },
    projectedCompletion: Date,
  },

  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Indexes
RevisionPlanSchema.index({ user: 1, isActive: 1 });
RevisionPlanSchema.index({ 'schedule.date': 1 });

// ========== PRE-SAVE: Calculate progress ==========
RevisionPlanSchema.pre('save', function(next) {
  let totalTopics = 0;
  let completedTopics = 0;
  let todayTopics = 0;
  let dueTopics = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  this.schedule.forEach(day => {
    day.topics.forEach(topic => {
      totalTopics++;
      if (topic.completed) completedTopics++;
      if (day.date.toDateString() === today.toDateString()) todayTopics++;
      if (!topic.completed && day.date <= new Date()) dueTopics++;
    });
  });

  this.progress.totalTopics = totalTopics;
  this.progress.completedTopics = completedTopics;
  this.progress.overall = totalTopics > 0 ? (completedTopics / totalTopics) * 100 : 0;
  this.progress.todayTopics = todayTopics;
  this.progress.dueTopics = dueTopics;

  // Generate insights
  this.generateInsights();

  this.updatedAt = new Date();
  next();
});

// ========== METHOD: Generate insights ==========
RevisionPlanSchema.methods.generateInsights = function() {
  const schedule = this.schedule;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Calculate streak
  let streak = 0;
  let longestStreak = 0;
  for (let i = schedule.length - 1; i >= 0; i--) {
    const day = schedule[i];
    if (day.completed) {
      streak++;
      if (streak > longestStreak) longestStreak = streak;
    } else {
      break;
    }
  }
  this.insights.streak = streak;
  this.insights.longestStreak = longestStreak;

  // Avg daily topics
  const totalDays = Math.max(1, schedule.length);
  const totalTopics = this.progress.totalTopics;
  this.insights.avgDailyTopics = Math.round(totalTopics / totalDays);

  // Projected completion
  if (this.progress.overall > 0 && this.progress.overall < 100) {
    const daysSince = (Date.now() - new Date(this.startDate).getTime()) / (1000 * 60 * 60 * 24);
    const topicsPerDay = this.progress.completedTopics / Math.max(daysSince, 1);
    if (topicsPerDay > 0) {
      const remaining = this.progress.totalTopics - this.progress.completedTopics;
      const daysRemaining = remaining / topicsPerDay;
      this.insights.projectedCompletion = new Date(Date.now() + daysRemaining * 24 * 60 * 60 * 1000);
    }
  }
};

// ========== METHOD: Apply spaced repetition ==========
RevisionPlanSchema.methods.applySpacedRepetition = function() {
  const now = new Date();
  let updated = 0;

  this.schedule.forEach(day => {
    day.topics.forEach(topic => {
      if (topic.completed && topic.nextReview) {
        // If next review is due, reset it
        if (topic.nextReview <= now) {
          topic.level = Math.min(5, topic.level + 1);
          const interval = this.calculateInterval(topic.level);
          topic.nextReview = new Date(Date.now() + interval * 24 * 60 * 60 * 1000);
          updated++;
        }
      }
    });
  });

  return updated;
};

// ========== HELPER: Calculate spaced repetition interval ==========
RevisionPlanSchema.methods.calculateInterval = function(level) {
  const { initialInterval, maxInterval, easeFactor } = this.srParams;
  let interval = initialInterval;
  for (let i = 1; i < level; i++) {
    interval = Math.min(interval * easeFactor, maxInterval);
  }
  return Math.round(interval);
};

// ========== STATIC: Get due topics for today ==========
RevisionPlanSchema.statics.getDueTopics = async function(userId) {
  const plans = await this.find({ user: userId, isActive: true });
  const due = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  plans.forEach(plan => {
    plan.schedule.forEach(day => {
      if (day.date.toDateString() === today.toDateString()) {
        day.topics.forEach(topic => {
          if (!topic.completed) {
            due.push({
              planId: plan._id,
              planName: plan.name,
              topic: topic.topicName,
              subject: topic.subject,
              date: day.date,
            });
          }
        });
      }
    });
  });

  return due;
};

module.exports = mongoose.model('RevisionPlan', RevisionPlanSchema);
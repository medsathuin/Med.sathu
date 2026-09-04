const mongoose = require('mongoose');

const SyllabusSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true }, // e.g., "Anatomy", "Pathology"
  description: String,
  examType: { type: String, enum: ['NEET PG', 'FMGE', 'USMLE', 'AIIMS', 'Other'] },
  targetExamDate: Date,
  startDate: { type: Date, default: Date.now },
  endDate: Date,

  subjects: [{
    name: { type: String, required: true },
    weightage: { type: Number, default: 0 }, // Percentage of exam
    topics: [{
      name: { type: String, required: true },
      description: String,
      resources: [{
        type: { type: String, enum: ['video', 'pdf', 'link', 'note'] },
        url: String,
        title: String,
      }],
      completed: { type: Boolean, default: false },
      completedAt: Date,
      deadline: Date,
      priority: { type: Number, min: 1, max: 5, default: 3 },
      notes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Note' }],
      // Time tracking
      timeSpent: { type: Number, default: 0 }, // in minutes
      lastStudied: Date,
      studySessions: [{
        start: Date,
        end: Date,
        duration: Number,
      }],
      // AI suggested order
      suggestedOrder: { type: Number },
      difficulty: { type: String, enum: ['easy', 'medium', 'hard', 'expert'] },
    }],
  }],

  // Overall progress
  progress: {
    overall: { type: Number, default: 0, min: 0, max: 100 },
    completedTopics: { type: Number, default: 0 },
    totalTopics: { type: Number, default: 0 },
    bySubject: [{
      subjectName: String,
      completed: Number,
      total: Number,
      percentage: Number,
    }],
  },

  // Study insights
  insights: {
    estimatedCompletionDate: Date,
    recommendedDailyHours: { type: Number, default: 2 },
    projectedScore: { type: Number, min: 0, max: 100 },
    weakTopics: [{ type: String }],
    strongTopics: [{ type: String }],
  },

  isActive: { type: Boolean, default: true },
  isPublic: { type: Boolean, default: false },
  sharedWith: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Indexes
SyllabusSchema.index({ user: 1, isActive: 1 });
SyllabusSchema.index({ 'subjects.topics.name': 'text' });

// ========== PRE-SAVE: Auto-calculate progress ==========
SyllabusSchema.pre('save', function(next) {
  let totalTopics = 0;
  let completedTopics = 0;
  const bySubject = [];

  this.subjects.forEach(sub => {
    let subTotal = sub.topics.length;
    let subCompleted = sub.topics.filter(t => t.completed).length;
    totalTopics += subTotal;
    completedTopics += subCompleted;
    bySubject.push({
      subjectName: sub.name,
      completed: subCompleted,
      total: subTotal,
      percentage: subTotal > 0 ? (subCompleted / subTotal) * 100 : 0,
    });
  });

  this.progress.totalTopics = totalTopics;
  this.progress.completedTopics = completedTopics;
  this.progress.overall = totalTopics > 0 ? (completedTopics / totalTopics) * 100 : 0;
  this.progress.bySubject = bySubject;

  // Generate insights
  this.generateInsights();

  this.updatedAt = new Date();
  next();
});

// ========== METHOD: Generate AI Insights ==========
SyllabusSchema.methods.generateInsights = function() {
  const weak = [];
  const strong = [];

  this.subjects.forEach(sub => {
    sub.topics.forEach(topic => {
      if (topic.completed) {
        strong.push(topic.name);
      } else if (topic.priority >= 4) {
        weak.push(topic.name);
      }
    });
  });

  this.insights.weakTopics = weak.slice(0, 5);
  this.insights.strongTopics = strong.slice(0, 5);

  // Estimated completion date based on current pace
  const totalTopics = this.progress.totalTopics;
  const completed = this.progress.completedTopics;
  if (completed > 0 && this.createdAt) {
    const daysSince = (Date.now() - new Date(this.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    const topicsPerDay = completed / Math.max(daysSince, 1);
    if (topicsPerDay > 0) {
      const remaining = totalTopics - completed;
      const daysRemaining = remaining / topicsPerDay;
      this.insights.estimatedCompletionDate = new Date(Date.now() + daysRemaining * 24 * 60 * 60 * 1000);
    }
  }

  // Recommended daily hours (based on remaining topics and exam date)
  if (this.targetExamDate) {
    const daysLeft = (new Date(this.targetExamDate) - new Date()) / (1000 * 60 * 60 * 24);
    const remaining = totalTopics - completed;
    if (daysLeft > 0 && remaining > 0) {
      const hoursPerTopic = 2; // Assume 2 hours per topic
      const totalHours = remaining * hoursPerTopic;
      this.insights.recommendedDailyHours = Math.ceil(totalHours / daysLeft);
    }
  }
};

// ========== STATIC: Get active syllabus for user ==========
SyllabusSchema.statics.getActive = function(userId) {
  return this.findOne({ user: userId, isActive: true });
};

module.exports = mongoose.model('Syllabus', SyllabusSchema);
const mongoose = require('mongoose');

const AdminDashboardSchema = new mongoose.Schema({
  // Real-time metrics
  metrics: {
    totalUsers: { type: Number, default: 0 },
    activeUsers: { type: Number, default: 0 },
    newUsersToday: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    monthlyRevenue: { type: Number, default: 0 },
    totalCourses: { type: Number, default: 0 },
    totalLectures: { type: Number, default: 0 },
    totalQBank: { type: Number, default: 0 },
    totalNotes: { type: Number, default: 0 },
    totalPosts: { type: Number, default: 0 },
  },

  // User activity metrics
  userActivity: {
    dailyActiveUsers: [{ date: Date, count: Number }],
    weeklyActiveUsers: [{ week: Number, count: Number }],
    monthlyActiveUsers: [{ month: String, count: Number }],
    userGrowth: [{ date: Date, count: Number }],
  },

  // Content metrics
  contentMetrics: {
    topCourses: [{
      courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
      views: Number,
      enrollments: Number,
      rating: Number,
    }],
    topLectures: [{
      lectureId: { type: mongoose.Schema.Types.ObjectId, ref: 'LecturePlan' },
      views: Number,
      attendees: Number,
      rating: Number,
    }],
    topInstructors: [{
      instructorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      totalStudents: Number,
      totalCourses: Number,
      avgRating: Number,
    }],
  },

  // Security metrics
  securityMetrics: {
    totalAlerts: { type: Number, default: 0 },
    criticalAlerts: { type: Number, default: 0 },
    resolvedAlerts: { type: Number, default: 0 },
    suspiciousActivities: [{
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      action: String,
      timestamp: Date,
      severity: String,
      status: { type: String, enum: ['new', 'investigating', 'resolved', 'ignored'] },
    }],
    recentAttacks: [{
      type: String,
      source: String,
      timestamp: Date,
      blocked: Boolean,
    }],
  },

  // Subscription metrics
  subscriptionMetrics: {
    totalSubscribers: { type: Number, default: 0 },
    monthlySubscribers: { type: Number, default: 0 },
    yearlySubscribers: { type: Number, default: 0 },
    freeUsers: { type: Number, default: 0 },
    churnRate: { type: Number, default: 0 },
    revenueByPlan: {
      monthly: { type: Number, default: 0 },
      yearly: { type: Number, default: 0 },
    },
  },

  // Performance metrics
  performanceMetrics: {
    avgResponseTime: { type: Number, default: 0 },
    uptime: { type: Number, default: 100 },
    errorRate: { type: Number, default: 0 },
    requestsPerMinute: { type: Number, default: 0 },
  },

  // AI Insights
  aiInsights: {
    predictedGrowth: { type: Number, default: 0 },
    recommendations: [String],
    riskFactors: [String],
    opportunities: [String],
    lastUpdated: { type: Date, default: Date.now },
  },

  // Timestamps
  lastUpdated: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
});

// Index for fast retrieval
AdminDashboardSchema.index({ lastUpdated: -1 });

// Static method to get latest dashboard
AdminDashboardSchema.statics.getLatest = function() {
  return this.findOne().sort({ lastUpdated: -1 });
};

module.exports = mongoose.model('AdminDashboard', AdminDashboardSchema);
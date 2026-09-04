const AdminDashboard = require('../models/AdminDashboard');
const User = require('../models/User');
const LecturePlan = require('../models/LecturePlan');
const SecurityLog = require('../models/SecurityLog');
const Subscription = require('../models/Subscription');
const { Server } = require('socket.io');
const os = require('os');

class MonitoringService {
  constructor() {
    this.io = null;
    this.monitoringInterval = null;
    this.realtimeClients = new Map();
    this.systemMetrics = {
      cpu: 0,
      memory: 0,
      uptime: 0,
      loadAverage: 0,
    };
  }

  // ========== SET SOCKET.IO ==========
  setSocketIO(io) {
    this.io = io;
    this.setupRealtimeEvents();
  }

  // ========== SETUP REALTIME EVENTS ==========
  setupRealtimeEvents() {
    if (!this.io) return;

    this.io.on('connection', (socket) => {
      console.log('🟢 Monitoring client connected:', socket.id);
      
      // Client joins monitoring room
      socket.join('admin-monitoring');
      
      // Track client
      this.realtimeClients.set(socket.id, {
        connectedAt: new Date(),
        lastHeartbeat: new Date(),
      });

      // Handle heartbeat
      socket.on('monitoring-heartbeat', () => {
        const client = this.realtimeClients.get(socket.id);
        if (client) {
          client.lastHeartbeat = new Date();
        }
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        this.realtimeClients.delete(socket.id);
        console.log('🔴 Monitoring client disconnected:', socket.id);
      });
    });
  }

  // ========== START MONITORING ==========
  startMonitoring(intervalMs = 30000) {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    // Initial collection
    this.collectMetrics();

    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, intervalMs);

    console.log(`📊 Monitoring started (interval: ${intervalMs}ms)`);
  }

  // ========== COLLECT METRICS ==========
  async collectMetrics() {
    try {
      const metrics = await this.gatherAllMetrics();
      
      // Update dashboard
      await this.updateDashboard(metrics);
      
      // Send realtime update
      this.sendRealtimeUpdate(metrics);
      
      // Check for anomalies
      await this.detectAnomalies(metrics);
      
      // Update system metrics
      this.updateSystemMetrics();
      
    } catch (error) {
      console.error('Metrics collection error:', error);
    }
  }

  // ========== GATHER ALL METRICS ==========
  async gatherAllMetrics() {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    // Parallel collection for performance
    const [
      totalUsers,
      activeUsers,
      newUsersToday,
      totalCourses,
      totalLectures,
      totalQBank,
      totalNotes,
      totalPosts,
      totalAlerts,
      criticalAlerts,
      totalRevenue,
      monthlyRevenue,
      totalSubscribers,
      avgResponseTime,
      errorRate,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ 'security.lastLogin': { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
      User.countDocuments({ createdAt: { $gte: todayStart } }),
      LecturePlan.countDocuments({ isDeleted: false }),
      LecturePlan.countDocuments({ isDeleted: false, date: { $gte: new Date() } }),
      // QBank count - placeholder
      Promise.resolve(10000), // Placeholder
      // Notes count - placeholder
      Promise.resolve(5000), // Placeholder
      // Posts count - placeholder
      Promise.resolve(2000), // Placeholder
      SecurityLog.countDocuments({ severity: { $in: ['warning', 'error', 'critical'] } }),
      SecurityLog.countDocuments({ severity: 'critical' }),
      // Revenue - placeholder
      Promise.resolve(25000),
      Promise.resolve(5000),
      // Subscribers - placeholder
      Promise.resolve(1500),
      // Performance - placeholder
      Promise.resolve(125),
      Promise.resolve(0.5),
    ]);

    // Gather user activity
    const userGrowth = await this.getUserGrowth(30);
    const activeUsersDaily = await this.getActiveUsersDaily(7);

    // Gather top content
    const topCourses = await this.getTopCourses(5);
    const topLectures = await this.getTopLectures(5);
    const topInstructors = await this.getTopInstructors(5);

    // Gather security alerts
    const suspiciousActivities = await SecurityLog.find({
      isSuspicious: true,
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('user', 'name email');

    return {
      timestamp: now,
      metrics: {
        totalUsers,
        activeUsers,
        newUsersToday,
        totalCourses,
        totalLectures,
        totalQBank,
        totalNotes,
        totalPosts,
        totalRevenue,
        monthlyRevenue,
      },
      userActivity: {
        dailyActiveUsers: activeUsersDaily,
        userGrowth,
      },
      contentMetrics: {
        topCourses,
        topLectures,
        topInstructors,
      },
      securityMetrics: {
        totalAlerts,
        criticalAlerts,
        suspiciousActivities: suspiciousActivities.map(a => ({
          userId: a.user?._id || null,
          userEmail: a.user?.email || 'Unknown',
          action: a.action,
          timestamp: a.createdAt,
          severity: a.severity,
          details: a.details,
          status: 'new',
        })),
      },
      subscriptionMetrics: {
        totalSubscribers,
        monthlySubscribers: Math.floor(totalSubscribers * 0.6),
        yearlySubscribers: Math.floor(totalSubscribers * 0.3),
        freeUsers: totalUsers - totalSubscribers,
        churnRate: 2.5,
        revenueByPlan: {
          monthly: 30000,
          yearly: 15000,
        },
      },
      performanceMetrics: {
        avgResponseTime,
        uptime: 99.95,
        errorRate,
        requestsPerMinute: 1250,
      },
    };
  }

  // ========== GET USER GROWTH ==========
  async getUserGrowth(days) {
    const growth = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      
      const count = await User.countDocuments({
        createdAt: { $gte: date, $lt: nextDate },
      });
      
      growth.push({
        date: date.toISOString().split('T')[0],
        count,
      });
    }
    return growth;
  }

  // ========== GET ACTIVE USERS DAILY ==========
  async getActiveUsersDaily(days) {
    const daily = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      
      const count = await User.countDocuments({
        'security.lastLogin': { $gte: date, $lt: nextDate },
      });
      
      daily.push({
        date: date.toISOString().split('T')[0],
        count,
      });
    }
    return daily;
  }

  // ========== GET TOP COURSES ==========
  async getTopCourses(limit) {
    // Placeholder - would query actual course data
    return [
      { courseId: null, views: 5000, enrollments: 1200, rating: 4.5 },
      { courseId: null, views: 4000, enrollments: 900, rating: 4.3 },
      { courseId: null, views: 3500, enrollments: 800, rating: 4.7 },
    ].slice(0, limit);
  }

  // ========== GET TOP LECTURES ==========
  async getTopLectures(limit) {
    // Placeholder
    return [
      { lectureId: null, views: 3000, attendees: 500, rating: 4.8 },
      { lectureId: null, views: 2500, attendees: 400, rating: 4.6 },
      { lectureId: null, views: 2000, attendees: 350, rating: 4.9 },
    ].slice(0, limit);
  }

  // ========== GET TOP INSTRUCTORS ==========
  async getTopInstructors(limit) {
    // Placeholder
    return [
      { instructorId: null, totalStudents: 5000, totalCourses: 12, avgRating: 4.7 },
      { instructorId: null, totalStudents: 4000, totalCourses: 8, avgRating: 4.5 },
      { instructorId: null, totalStudents: 3000, totalCourses: 6, avgRating: 4.9 },
    ].slice(0, limit);
  }

  // ========== UPDATE DASHBOARD ==========
  async updateDashboard(metrics) {
    try {
      // Find existing dashboard or create new
      let dashboard = await AdminDashboard.getLatest();
      
      if (!dashboard) {
        dashboard = new AdminDashboard();
      }

      // Update metrics
      dashboard.metrics = metrics.metrics;
      dashboard.userActivity = metrics.userActivity;
      dashboard.contentMetrics = metrics.contentMetrics;
      dashboard.securityMetrics = metrics.securityMetrics;
      dashboard.subscriptionMetrics = metrics.subscriptionMetrics;
      dashboard.performanceMetrics = metrics.performanceMetrics;
      dashboard.lastUpdated = new Date();

      // Generate AI insights
      dashboard.aiInsights = await this.generateAIInsights(metrics);

      await dashboard.save();
      
    } catch (error) {
      console.error('Update dashboard error:', error);
    }
  }

  // ========== GENERATE AI INSIGHTS ==========
  async generateAIInsights(metrics) {
    const insights = {
      predictedGrowth: 0,
      recommendations: [],
      riskFactors: [],
      opportunities: [],
      lastUpdated: new Date(),
    };

    // Growth prediction based on user growth
    const growthRate = metrics.userActivity.userGrowth.slice(-7);
    const avgGrowth = growthRate.reduce((sum, d) => sum + d.count, 0) / growthRate.length;
    insights.predictedGrowth = avgGrowth * 1.15; // 15% growth projection

    // Recommendations
    if (metrics.securityMetrics.criticalAlerts > 5) {
      insights.recommendations.push('⚠️ High security alerts - review security logs immediately');
    }
    if (metrics.metrics.activeUsers < metrics.metrics.totalUsers * 0.3) {
      insights.recommendations.push('📉 Low user engagement - consider engagement campaigns');
    }
    if (metrics.subscriptionMetrics.churnRate > 5) {
      insights.recommendations.push('🔄 High churn rate - review subscription plans');
    }
    if (metrics.performanceMetrics.errorRate > 1) {
      insights.recommendations.push('⚠️ High error rate - check server performance');
    }

    // Risk factors
    if (metrics.securityMetrics.criticalAlerts > 10) {
      insights.riskFactors.push('Critical security risk - multiple alerts');
    }
    if (metrics.performanceMetrics.uptime < 99) {
      insights.riskFactors.push('Service reliability risk - low uptime');
    }
    if (metrics.subscriptionMetrics.churnRate > 10) {
      insights.riskFactors.push('High churn risk - review user retention');
    }

    // Opportunities
    if (metrics.metrics.totalUsers < 10000) {
      insights.opportunities.push('🚀 Growth opportunity - expand to new colleges');
    }
    if (metrics.metrics.totalCourses < 50) {
      insights.opportunities.push('📚 Content opportunity - add more courses');
    }
    if (metrics.metrics.totalQBank < 15000) {
      insights.opportunities.push('📖 QBank opportunity - expand question database');
    }

    return insights;
  }

  // ========== SEND REALTIME UPDATE ==========
  sendRealtimeUpdate(metrics) {
    if (!this.io) return;

    const update = {
      timestamp: new Date().toISOString(),
      metrics: {
        totalUsers: metrics.metrics.totalUsers,
        activeUsers: metrics.metrics.activeUsers,
        newUsersToday: metrics.metrics.newUsersToday,
        totalRevenue: metrics.metrics.totalRevenue,
        monthlyRevenue: metrics.metrics.monthlyRevenue,
        totalCourses: metrics.metrics.totalCourses,
        totalLectures: metrics.metrics.totalLectures,
        totalAlerts: metrics.securityMetrics.totalAlerts,
        criticalAlerts: metrics.securityMetrics.criticalAlerts,
      },
      performance: {
        avgResponseTime: metrics.performanceMetrics.avgResponseTime,
        uptime: metrics.performanceMetrics.uptime,
        errorRate: metrics.performanceMetrics.errorRate,
      },
      system: this.systemMetrics,
    };

    this.io.to('admin-monitoring').emit('dashboard-update', update);
  }

  // ========== UPDATE SYSTEM METRICS ==========
  updateSystemMetrics() {
    this.systemMetrics = {
      cpu: Math.random() * 40 + 20, // Placeholder - would use real CPU metrics
      memory: Math.random() * 30 + 40, // Placeholder
      uptime: process.uptime(),
      loadAverage: Math.random() * 2 + 0.5, // Placeholder
    };
  }

  // ========== DETECT ANOMALIES ==========
  async detectAnomalies(metrics) {
    const anomalies = [];

    // Check for unusual user activity
    if (metrics.metrics.activeUsers > metrics.metrics.totalUsers * 0.8) {
      anomalies.push({
        type: 'user_activity',
        severity: 'info',
        message: 'Unusually high user activity detected',
      });
    }

    // Check for security anomalies
    if (metrics.securityMetrics.criticalAlerts > 5) {
      anomalies.push({
        type: 'security',
        severity: 'critical',
        message: `High number of critical security alerts: ${metrics.securityMetrics.criticalAlerts}`,
      });
    }

    // Check for performance anomalies
    if (metrics.performanceMetrics.errorRate > 5) {
      anomalies.push({
        type: 'performance',
        severity: 'warning',
        message: `High error rate detected: ${metrics.performanceMetrics.errorRate}%`,
      });
    }

    // Check for revenue anomalies
    if (metrics.metrics.totalRevenue < metrics.metrics.monthlyRevenue * 0.5) {
      anomalies.push({
        type: 'revenue',
        severity: 'warning',
        message: 'Revenue anomaly: Monthly revenue significantly below expected',
      });
    }

    // Log anomalies
    if (anomalies.length > 0) {
      for (const anomaly of anomalies) {
        await SecurityLog.create({
          action: 'system_alert',
          resourceType: 'system',
          details: {
            metadata: {
              type: anomaly.type,
              severity: anomaly.severity,
              message: anomaly.message,
              timestamp: new Date().toISOString(),
            },
          },
          severity: anomaly.severity === 'critical' ? 'critical' : 'error',
          isSuspicious: anomaly.severity === 'critical',
        });

        // Send realtime alert
        this.io?.to('admin-monitoring').emit('anomaly-alert', anomaly);
      }
    }
  }

  // ========== GET DASHBOARD DATA ==========
  async getDashboardData() {
    const dashboard = await AdminDashboard.getLatest();
    if (!dashboard) {
      await this.collectMetrics();
      return await AdminDashboard.getLatest();
    }
    return dashboard;
  }

  // ========== STOP MONITORING ==========
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    console.log('📊 Monitoring stopped');
  }
}

module.exports = new MonitoringService();
const AdminDashboard = require('../models/AdminDashboard');
const User = require('../models/User');
const SecurityLog = require('../models/SecurityLog');
const MonitoringService = require('../services/monitoring.service');
const mongoose = require('mongoose');

// ========== GET DASHBOARD SUMMARY ==========
exports.getDashboardSummary = async (req, res) => {
  try {
    const dashboard = await MonitoringService.getDashboardData();
    
    res.json({
      success: true,
      data: {
        summary: dashboard.metrics,
        userActivity: dashboard.userActivity,
        subscriptionMetrics: dashboard.subscriptionMetrics,
        performance: dashboard.performanceMetrics,
        aiInsights: dashboard.aiInsights,
        lastUpdated: dashboard.lastUpdated,
      },
    });
  } catch (error) {
    console.error('Dashboard summary error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== GET REAL-TIME METRICS ==========
exports.getRealtimeMetrics = async (req, res) => {
  try {
    const metrics = await MonitoringService.gatherAllMetrics();
    
    res.json({
      success: true,
      data: {
        users: {
          total: metrics.metrics.totalUsers,
          active: metrics.metrics.activeUsers,
          newToday: metrics.metrics.newUsersToday,
        },
        revenue: {
          total: metrics.metrics.totalRevenue,
          monthly: metrics.metrics.monthlyRevenue,
        },
        content: {
          courses: metrics.metrics.totalCourses,
          lectures: metrics.metrics.totalLectures,
          qbank: metrics.metrics.totalQBank,
        },
        security: {
          totalAlerts: metrics.securityMetrics.totalAlerts,
          criticalAlerts: metrics.securityMetrics.criticalAlerts,
        },
        performance: metrics.performanceMetrics,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Realtime metrics error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== GET USER ANALYTICS ==========
exports.getUserAnalytics = async (req, res) => {
  try {
    const { period = 'month', limit = 10 } = req.query;

    const analytics = {
      totalUsers: 0,
      activeUsers: 0,
      newUsers: 0,
      userGrowth: [],
      usersByRole: { student: 0, teacher: 0, admin: 0 },
      usersBySubscription: { free: 0, monthly: 0, yearly: 0 },
      recentUsers: [],
    };

    // Get totals
    analytics.totalUsers = await User.countDocuments();
    analytics.activeUsers = await User.countDocuments({
      'security.lastLogin': { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    });

    // Get users by role
    analytics.usersByRole.student = await User.countDocuments({ role: 'student' });
    analytics.usersByRole.teacher = await User.countDocuments({ role: 'teacher' });
    analytics.usersByRole.admin = await User.countDocuments({ role: 'admin' });

    // Get users by subscription
    analytics.usersBySubscription.free = await User.countDocuments({ 'subscription.plan': 'free' });
    analytics.usersBySubscription.monthly = await User.countDocuments({ 'subscription.plan': 'monthly' });
    analytics.usersBySubscription.yearly = await User.countDocuments({ 'subscription.plan': 'yearly' });

    // Get recent users
    analytics.recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .select('name email role subscription.plan createdAt');

    // Get user growth (last 30 days)
    const days = period === 'month' ? 30 : period === 'week' ? 7 : 90;
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      
      const count = await User.countDocuments({
        createdAt: { $gte: date, $lt: nextDate },
      });
      
      analytics.userGrowth.push({
        date: date.toISOString().split('T')[0],
        count,
      });
    }

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    console.error('User analytics error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== GET SECURITY ANALYTICS ==========
exports.getSecurityAnalytics = async (req, res) => {
  try {
    const { period = 'week' } = req.query;
    const days = period === 'week' ? 7 : period === 'month' ? 30 : 90;

    const analytics = {
      totalAlerts: 0,
      criticalAlerts: 0,
      resolvedAlerts: 0,
      alertsByType: {},
      alertsBySeverity: { info: 0, warning: 0, error: 0, critical: 0 },
      recentAlerts: [],
      alertsTrend: [],
      topThreats: [],
    };

    // Get alerts by severity
    analytics.totalAlerts = await SecurityLog.countDocuments({
      createdAt: { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) },
      severity: { $in: ['warning', 'error', 'critical'] },
    });

    analytics.criticalAlerts = await SecurityLog.countDocuments({
      createdAt: { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) },
      severity: 'critical',
    });

    analytics.resolvedAlerts = await SecurityLog.countDocuments({
      createdAt: { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) },
      isResolved: true,
    });

    // Get alerts by severity
    const severityCounts = await SecurityLog.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) },
        },
      },
      {
        $group: {
          _id: '$severity',
          count: { $sum: 1 },
        },
      },
    ]);

    severityCounts.forEach(item => {
      analytics.alertsBySeverity[item._id] = item.count;
    });

    // Get recent alerts
    analytics.recentAlerts = await SecurityLog.find({
      createdAt: { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) },
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('user', 'name email');

    // Get alerts trend
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      
      const count = await SecurityLog.countDocuments({
        createdAt: { $gte: date, $lt: nextDate },
        severity: { $in: ['warning', 'error', 'critical'] },
      });
      
      analytics.alertsTrend.push({
        date: date.toISOString().split('T')[0],
        count,
      });
    }

    // Get top threats (most common actions)
    const topActions = await SecurityLog.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) },
          isSuspicious: true,
        },
      },
      {
        $group: {
          _id: '$action',
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
      {
        $limit: 5,
      },
    ]);

    analytics.topThreats = topActions;

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    console.error('Security analytics error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== GET SYSTEM PERFORMANCE ==========
exports.getSystemPerformance = async (req, res) => {
  try {
    const dashboard = await AdminDashboard.getLatest();
    
    res.json({
      success: true,
      data: {
        performance: dashboard?.performanceMetrics || {
          avgResponseTime: 0,
          uptime: 100,
          errorRate: 0,
          requestsPerMinute: 0,
        },
        system: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          cpu: process.cpuUsage(),
        },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('System performance error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== RESOLVE ALERT ==========
exports.resolveAlert = async (req, res) => {
  try {
    const { alertId } = req.params;
    const { resolution } = req.body;

    const alert = await SecurityLog.findById(alertId);
    if (!alert) {
      return res.status(404).json({ success: false, message: 'Alert not found' });
    }

    alert.isResolved = true;
    alert.resolvedAt = new Date();
    alert.resolvedBy = req.userId;
    alert.resolution = resolution || 'Resolved by admin';
    await alert.save();

    res.json({
      success: true,
      message: 'Alert resolved successfully',
      data: alert,
    });
  } catch (error) {
    console.error('Resolve alert error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
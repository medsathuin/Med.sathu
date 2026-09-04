const express = require('express');
const router = express.Router();
const { auth, roleCheck } = require('../middleware/auth');
const adminAnalyticsController = require('../controllers/adminAnalytics.controller');

// All routes require admin authentication
router.use(auth, roleCheck('admin'));

// ========== DASHBOARD ==========
router.get('/dashboard', adminAnalyticsController.getDashboardSummary);
router.get('/realtime', adminAnalyticsController.getRealtimeMetrics);

// ========== USER ANALYTICS ==========
router.get('/users', adminAnalyticsController.getUserAnalytics);

// ========== SECURITY ANALYTICS ==========
router.get('/security', adminAnalyticsController.getSecurityAnalytics);

// ========== PERFORMANCE ==========
router.get('/performance', adminAnalyticsController.getSystemPerformance);

// ========== ALERTS ==========
router.put('/alert/:alertId/resolve', adminAnalyticsController.resolveAlert);

module.exports = router;
const express = require('express');
const router = express.Router();
const { auth, roleCheck } = require('../middleware/auth');
const { advancedRateLimit, validateRequest, sqlInjectionCheck } = require('../middleware/advancedSecurity');
const UnifiedController = require('../controllers/unified.controller');

// ========== STUDENT ROUTES ==========
router.get('/dashboard', auth, advancedRateLimit, UnifiedController.getDashboard);
router.post('/search', auth, sqlInjectionCheck, UnifiedController.smartSearch);
router.post('/subscription', auth, validateRequest('subscription'), UnifiedController.manageSubscription);

// ========== SOCIAL ROUTES ==========
router.post('/social', auth, UnifiedController.socialActions);

// ========== TEACHER ROUTES ==========
router.get('/teacher/analytics', auth, roleCheck('teacher'), UnifiedController.getTeacherAnalytics);
router.post('/teacher/course', auth, roleCheck('teacher'), UnifiedController.createCourse);
router.put('/teacher/course/:id', auth, roleCheck('teacher'), UnifiedController.updateCourse);

// ========== ADMIN ROUTES ==========
router.get('/admin/users', auth, roleCheck('admin'), UnifiedController.getAllUsers);
router.put('/admin/user/:id', auth, roleCheck('admin'), UnifiedController.updateUser);
router.delete('/admin/user/:id', auth, roleCheck('admin'), UnifiedController.deleteUser);
router.get('/admin/analytics', auth, roleCheck('admin'), UnifiedController.getSystemAnalytics);

module.exports = router;
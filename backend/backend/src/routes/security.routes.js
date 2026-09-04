const express = require('express');
const router = express.Router();
const { auth, roleCheck } = require('../middleware/auth');
const SecurityLog = require('../models/SecurityLog');
const ContentProtection = require('../models/ContentProtection');
const EncryptionService = require('../services/encryption.service');
const ContentProtectionService = require('../services/contentProtection.service');
const IntrusionDetectionService = require('../services/intrusionDetection.service');
const DataPrivacyService = require('../services/dataPrivacy.service');

// ========== GET SECURITY LOGS ==========
router.get('/logs', auth, roleCheck('admin'), async (req, res) => {
  try {
    const { limit = 100, offset = 0, severity, action, userId } = req.query;
    const filter = {};
    if (severity) filter.severity = severity;
    if (action) filter.action = action;
    if (userId) filter.user = userId;

    const logs = await SecurityLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit))
      .populate('user', 'name email');

    const total = await SecurityLog.countDocuments(filter);

    res.json({
      success: true,
      data: logs,
      pagination: { total, limit: parseInt(limit), offset: parseInt(offset) },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========== GET USER SECURITY LOGS ==========
router.get('/logs/me', auth, async (req, res) => {
  try {
    const logs = await SecurityLog.find({ user: req.userId })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========== ENABLE CONTENT PROTECTION ==========
router.post('/protect/:type/:id', auth, async (req, res) => {
  try {
    const { type, id } = req.params;
    const protection = await ContentProtectionService.createProtection(
      req.userId,
      type,
      id,
      req.body
    );
    res.status(201).json({ success: true, data: protection });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========== GET PROTECTION STATUS ==========
router.get('/protect/:type/:id', auth, async (req, res) => {
  try {
    const { type, id } = req.params;
    const protection = await ContentProtection.findOne({ resourceType: type, resourceId: id });
    res.json({ success: true, data: protection || { isProtected: false } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========== REMOVE PROTECTION ==========
router.delete('/protect/:type/:id', auth, async (req, res) => {
  try {
    await ContentProtectionService.removeProtection(req.params.type, req.params.id, req.userId);
    res.json({ success: true, message: 'Protection removed' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========== ROTATE ENCRYPTION KEYS ==========
router.post('/rotate-keys', auth, async (req, res) => {
  try {
    const { resourceType = 'all' } = req.body;
    const result = await EncryptionService.rotateKey(req.userId, resourceType);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========== DATA EXPORT ==========
router.post('/export-data', auth, async (req, res) => {
  try {
    const exportData = await DataPrivacyService.requestDataExport(req.userId);
    res.json({ success: true, data: exportData });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========== DELETE MY DATA (GDPR) ==========
router.delete('/my-data', auth, async (req, res) => {
  try {
    await DataPrivacyService.deleteUserData(req.userId);
    res.json({ success: true, message: 'Your data has been deleted permanently' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========== GET INTRUSION ANALYSIS ==========
router.get('/intrusion-analysis', auth, roleCheck('admin'), async (req, res) => {
  try {
    const { userId } = req.query;
    const analysis = await IntrusionDetectionService.analyzeAccessPattern(userId);
    res.json({ success: true, data: analysis });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========== LOCK USER ACCOUNT ==========
router.post('/lock-account/:userId', auth, roleCheck('admin'), async (req, res) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    user.security.isLocked = true;
    await user.save();

    await SecurityLog.create({
      user: req.params.userId,
      action: 'admin_action',
      resourceType: 'user',
      details: { metadata: { action: 'lock_account', by: req.userId } },
      severity: 'critical',
    });

    res.json({ success: true, message: 'Account locked' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========== UNLOCK USER ACCOUNT ==========
router.post('/unlock-account/:userId', auth, roleCheck('admin'), async (req, res) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    user.security.isLocked = false;
    user.security.loginAttempts = 0;
    await user.save();

    await SecurityLog.create({
      user: req.params.userId,
      action: 'admin_action',
      resourceType: 'user',
      details: { metadata: { action: 'unlock_account', by: req.userId } },
      severity: 'info',
    });

    res.json({ success: true, message: 'Account unlocked' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
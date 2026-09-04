const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const NotificationService = require('../services/notification.service');
const Reminder = require('../models/Reminder');

// ========== CREATE REMINDER ==========
router.post('/', auth, async (req, res) => {
  try {
    const reminder = await NotificationService.createReminder({
      userId: req.userId,
      ...req.body,
    });
    res.status(201).json({ success: true, data: reminder });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========== GET REMINDERS ==========
router.get('/', auth, async (req, res) => {
  try {
    const reminders = await NotificationService.getActiveReminders(req.userId);
    res.json({ success: true, data: reminders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========== GET NOTIFICATIONS ==========
router.get('/notifications', auth, async (req, res) => {
  try {
    const { limit, offset, unreadOnly } = req.query;
    const result = await NotificationService.getUserNotifications(req.userId, {
      limit: parseInt(limit) || 20,
      offset: parseInt(offset) || 0,
      unreadOnly: unreadOnly === 'true',
    });
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========== MARK NOTIFICATION READ ==========
router.put('/notifications/:id/read', auth, async (req, res) => {
  try {
    const notification = await NotificationService.markAsRead(req.userId, req.params.id);
    res.json({ success: true, data: notification });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========== MARK ALL READ ==========
router.put('/notifications/read-all', auth, async (req, res) => {
  try {
    await NotificationService.markAllRead(req.userId);
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========== SNOOZE REMINDER ==========
router.post('/:id/snooze', auth, async (req, res) => {
  try {
    const reminder = await Reminder.findById(req.params.id);
    if (!reminder) return res.status(404).json({ success: false, message: 'Reminder not found' });
    if (reminder.user.toString() !== req.userId) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    const snoozed = await reminder.snooze(req.body.minutes || 15);
    res.json({ success: true, data: snoozed });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========== COMPLETE REMINDER ==========
router.put('/:id/complete', auth, async (req, res) => {
  try {
    const reminder = await Reminder.findById(req.params.id);
    if (!reminder) return res.status(404).json({ success: false, message: 'Reminder not found' });
    if (reminder.user.toString() !== req.userId) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    const completed = await reminder.complete(req.body.rating || 5, req.body.note || '');
    res.json({ success: true, data: completed });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========== AI SUGGESTIONS ==========
router.get('/ai-suggest', auth, async (req, res) => {
  try {
    const suggestions = await NotificationService.aiSuggestReminders(req.userId);
    res.json({ success: true, data: suggestions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
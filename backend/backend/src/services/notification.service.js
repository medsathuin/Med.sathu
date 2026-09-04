const nodemailer = require('nodemailer');
const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const Reminder = require('../models/Reminder');
const User = require('../models/User');
const { Server } = require('socket.io');

class NotificationService {
  constructor() {
    this.io = null;
    this.emailTransporter = null;
    this.emailQueue = [];
    this.batchSize = 100;
    this.initEmail();
  }

  // ========== INIT EMAIL ==========
  initEmail() {
    if (process.env.EMAIL_HOST && process.env.EMAIL_USER) {
      this.emailTransporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT) || 587,
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
        pool: true, // Use pooled connections
        maxConnections: 5,
        rateLimit: 10, // Max emails per second
      });
    }
  }

  // ========== SET SOCKET.IO ==========
  setSocketIO(io) {
    this.io = io;
  }

  // ========== CREATE NOTIFICATION ==========
  async createNotification(data) {
    try {
      const notification = new Notification({
        user: data.userId,
        from: data.fromId,
        type: data.type,
        title: data.title,
        message: data.message,
        htmlMessage: data.htmlMessage,
        targetType: data.targetType,
        targetId: data.targetId,
        targetUrl: data.targetUrl,
        priority: data.priority || 'medium',
        channels: data.channels || { email: false, push: true, inApp: true },
        scheduledFor: data.scheduledFor || new Date(),
        isRecurring: data.isRecurring || false,
        recurrencePattern: data.recurrencePattern || null,
        metadata: data.metadata || {},
      });

      await notification.save();

      // If not scheduled in future, send immediately
      if (!notification.scheduledFor || notification.scheduledFor <= new Date()) {
        await notification.send();
      }

      return notification;
    } catch (error) {
      console.error('Create notification error:', error);
      throw error;
    }
  }

  // ========== CREATE REMINDER ==========
  async createReminder(data) {
    try {
      // Check if reminder already exists for this target
      if (data.targetId && data.targetType) {
        const existing = await Reminder.findOne({
          user: data.userId,
          targetId: data.targetId,
          targetType: data.targetType,
          status: 'active',
        });
        if (existing) {
          // Update existing instead
          existing.datetime = data.datetime || existing.datetime;
          existing.title = data.title || existing.title;
          existing.description = data.description || existing.description;
          await existing.save();
          return existing;
        }
      }

      const reminder = new Reminder({
        user: data.userId,
        type: data.type,
        title: data.title,
        description: data.description,
        datetime: data.datetime,
        remindBefore: data.remindBefore || { enabled: true, minutes: 30 },
        repeat: data.repeat || { type: 'none' },
        targetType: data.targetType,
        targetId: data.targetId,
        aiSuggestions: data.aiSuggestions || null,
      });

      await reminder.save();

      // Auto-create notification for reminder
      await this.createNotification({
        userId: data.userId,
        type: `${data.type}_reminder`,
        title: `⏰ ${data.title}`,
        message: data.description || `Your ${data.type} reminder is set for ${new Date(data.datetime).toLocaleString()}`,
        targetType: data.targetType,
        targetId: data.targetId,
        priority: 'high',
        channels: { email: true, push: true, inApp: true },
        scheduledFor: new Date(data.datetime.getTime() - (data.remindBefore?.minutes || 30) * 60 * 1000),
      });

      return reminder;
    } catch (error) {
      console.error('Create reminder error:', error);
      throw error;
    }
  }

  // ========== SEND EMAIL ==========
  async sendEmail(to, subject, html, plainText = null) {
    if (!this.emailTransporter) {
      console.log('Email not configured, skipping');
      return false;
    }

    try {
      const mailOptions = {
        from: `"Medsathu.inn" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
            <div style="text-align: center; margin-bottom: 20px;">
              <h1 style="color: #1e3a8a;">🏥 Medsathu.inn</h1>
            </div>
            ${html}
            <hr style="margin: 20px 0;" />
            <div style="text-align: center; font-size: 12px; color: #999;">
              <p>You received this email because you're registered on Medsathu.inn</p>
              <p><a href="${process.env.FRONTEND_URL}/settings/notifications">Manage notifications</a></p>
            </div>
          </div>
        `,
        text: plainText || html.replace(/<[^>]+>/g, ''),
      };

      await this.emailTransporter.sendMail(mailOptions);
      return true;
    } catch (error) {
      console.error('Email error:', error);
      return false;
    }
  }

  // ========== SEND PUSH NOTIFICATION ==========
  async sendPush(user, notification) {
    if (!this.io) {
      console.log('Socket.io not initialized');
      return false;
    }

    try {
      const socketId = `user-${user._id || user}`;
      this.io.to(socketId).emit('notification', {
        id: notification._id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        targetType: notification.targetType,
        targetId: notification.targetId,
        targetUrl: notification.targetUrl,
        priority: notification.priority,
        metadata: notification.metadata || {},
        timestamp: notification.createdAt,
      });
      return true;
    } catch (error) {
      console.error('Push error:', error);
      return false;
    }
  }

  // ========== PROCESS PENDING NOTIFICATIONS (CRON) ==========
  async processPendingNotifications() {
    const now = new Date();

    // Get pending notifications due now
    const pending = await Notification.find({
      scheduledFor: { $lte: now },
      status: 'pending',
    }).populate('user', 'email name');

    let processed = 0;
    for (const notification of pending) {
      await notification.send();
      processed++;
    }

    // Process recurring notifications
    await this.processRecurringNotifications();

    // Process reminders
    await this.processReminders();

    return processed;
  }

  // ========== PROCESS RECURRING NOTIFICATIONS ==========
  async processRecurringNotifications() {
    const now = new Date();
    const recurring = await Notification.find({
      isRecurring: true,
      'recurrencePattern.endDate': { $gt: now },
      status: { $in: ['sent', 'delivered'] },
    });

    for (const notification of recurring) {
      const pattern = notification.recurrencePattern;
      if (!pattern) continue;

      // Determine next occurrence
      const nextDate = this.getNextRecurrence(notification.scheduledFor, pattern);
      if (!nextDate) continue;

      // Create new notification instance
      const newNotification = new Notification({
        user: notification.user,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        htmlMessage: notification.htmlMessage,
        targetType: notification.targetType,
        targetId: notification.targetId,
        targetUrl: notification.targetUrl,
        priority: notification.priority,
        channels: notification.channels,
        scheduledFor: nextDate,
        isRecurring: false,
        metadata: notification.metadata,
      });
      await newNotification.save();
      // It will be sent by the processor
    }
  }

  // ========== PROCESS REMINDERS ==========
  async processReminders() {
    const now = new Date();

    // Active reminders that are due
    const dueReminders = await Reminder.find({
      status: 'active',
      datetime: { $lte: now },
      $or: [
        { lastNotified: null },
        { lastNotified: { $lt: new Date(now.getTime() - 5 * 60 * 1000) } }, // Not notified in last 5 min
      ],
    }).populate('user');

    for (const reminder of dueReminders) {
      // Check if we should remind now based on remindBefore settings
      const minutesUntil = Math.floor((reminder.datetime - now) / (60 * 1000));
      const shouldRemind = reminder.remindBefore.enabled && 
        (minutesUntil <= reminder.remindBefore.minutes && minutesUntil >= 0);

      if (shouldRemind) {
        await this.createNotification({
          userId: reminder.user._id,
          type: `${reminder.type}_reminder`,
          title: `⏰ Reminder: ${reminder.title}`,
          message: reminder.description || `Your ${reminder.type} is due soon!`,
          targetType: reminder.targetType,
          targetId: reminder.targetId,
          priority: 'high',
          channels: { email: true, push: true, inApp: true },
        });

        reminder.lastNotified = new Date();
        reminder.notificationCount += 1;
        await reminder.save();
      }

      // If reminder is overdue by more than 1 hour, mark as expired
      if (minutesUntil < -60) {
        reminder.status = 'expired';
        await reminder.save();
      }
    }
  }

  // ========== GET NEXT RECURRENCE ==========
  getNextRecurrence(fromDate, pattern) {
    const date = new Date(fromDate);
    const { frequency, interval, daysOfWeek, timeOfDay } = pattern;

    if (frequency === 'daily') {
      date.setDate(date.getDate() + (interval || 1));
    } else if (frequency === 'weekly') {
      date.setDate(date.getDate() + 7 * (interval || 1));
      // Adjust to specified day of week if provided
      if (daysOfWeek && daysOfWeek.length > 0) {
        const currentDay = date.getDay();
        const targetDay = daysOfWeek[0];
        const diff = (targetDay - currentDay + 7) % 7;
        if (diff > 0) date.setDate(date.getDate() + diff);
      }
    } else if (frequency === 'monthly') {
      date.setMonth(date.getMonth() + (interval || 1));
    } else {
      return null;
    }

    // Set time of day if specified
    if (timeOfDay) {
      const [hours, minutes] = timeOfDay.split(':').map(Number);
      date.setHours(hours || 0, minutes || 0, 0, 0);
    }

    return date;
  }

  // ========== BULK SEND ==========
  async bulkSend(userIds, notificationData) {
    const results = [];
    for (const userId of userIds) {
      try {
        const notif = await this.createNotification({
          ...notificationData,
          userId,
        });
        results.push({ userId, success: true, id: notif._id });
      } catch (error) {
        results.push({ userId, success: false, error: error.message });
      }
    }
    return results;
  }

  // ========== GET USER NOTIFICATIONS ==========
  async getUserNotifications(userId, { limit = 20, offset = 0, unreadOnly = false } = {}) {
    const filter = { user: userId };
    if (unreadOnly) {
      filter.readAt = null;
    }
    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .populate('from', 'name email social.profilePicture'),
      Notification.countDocuments(filter),
      Notification.getUnreadCount(userId),
    ]);

    return {
      notifications,
      total,
      unreadCount,
      hasMore: offset + limit < total,
    };
  }

  // ========== MARK NOTIFICATION AS READ ==========
  async markAsRead(userId, notificationId) {
    const notification = await Notification.findOne({
      _id: notificationId,
      user: userId,
    });
    if (!notification) throw new Error('Notification not found');
    notification.readAt = new Date();
    await notification.save();
    return notification;
  }

  // ========== MARK ALL AS READ ==========
  async markAllRead(userId) {
    return Notification.markAllRead(userId);
  }

  // ========== GET ACTIVE REMINDERS ==========
  async getActiveReminders(userId) {
    return Reminder.find({
      user: userId,
      status: 'active',
      datetime: { $gt: new Date() },
    }).sort({ datetime: 1 });
  }

  // ========== AI SUGGEST REMINDERS ==========
  async aiSuggestReminders(userId, context = {}) {
    // This would use OpenAI to suggest study reminders based on user's syllabus, weak areas, etc.
    // Placeholder implementation
    const suggestions = [];
    
    // Check if user has syllabus
    const Syllabus = mongoose.model('Syllabus');
    const syllabus = await Syllabus.findOne({ user: userId, isActive: true });
    if (syllabus) {
      const pendingTopics = syllabus.subjects.flatMap(s => 
        s.topics.filter(t => !t.completed).map(t => ({ name: t.name, subject: s.name }))
      );
      if (pendingTopics.length > 0) {
        suggestions.push({
          title: `Study ${pendingTopics[0].name} (${pendingTopics[0].subject})`,
          description: 'AI suggests reviewing this topic based on your syllabus progress',
          type: 'ai_suggested',
          datetime: new Date(Date.now() + 24 * 60 * 60 * 1000),
          confidence: 0.85,
        });
      }
    }

    // Check study streak
    const streak = await this.getStudyStreak(userId);
    if (streak > 0 && streak % 7 === 0) {
      suggestions.push({
        title: '🎉 Weekly Study Streak!',
        description: `You've studied consistently for ${streak} days! Keep it up!`,
        type: 'ai_suggested',
        datetime: new Date(),
        confidence: 1.0,
      });
    }

    return suggestions;
  }

  // ========== GET STUDY STREAK ==========
  async getStudyStreak(userId) {
    const User = mongoose.model('User');
    const user = await User.findById(userId);
    return user?.studyPlan?.studyStreak || 0;
  }
}

module.exports = new NotificationService();
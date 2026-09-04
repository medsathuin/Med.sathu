const Syllabus = require('../models/Syllabus');
const LecturePlan = require('../models/LecturePlan');
const RevisionPlan = require('../models/RevisionPlan');
const ShareLink = require('../models/ShareLink');
const PlannerService = require('../services/planner.service');
const NotificationService = require('../services/notification.service');
const mongoose = require('mongoose');

// ========== SYLLABUS CRUD ==========

exports.createSyllabus = async (req, res) => {
  try {
    const syllabus = new Syllabus({
      ...req.body,
      user: req.userId,
    });
    await syllabus.save();
    res.status(201).json({ success: true, data: syllabus });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getSyllabus = async (req, res) => {
  try {
    const syllabus = await Syllabus.findOne({ user: req.userId, isActive: true });
    if (!syllabus) return res.status(404).json({ success: false, message: 'No active syllabus found' });
    res.json({ success: true, data: syllabus });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateSyllabus = async (req, res) => {
  try {
    const syllabus = await Syllabus.findOne({ _id: req.params.id, user: req.userId });
    if (!syllabus) return res.status(404).json({ success: false, message: 'Syllabus not found' });
    Object.assign(syllabus, req.body);
    await syllabus.save();
    res.json({ success: true, data: syllabus });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.markTopicComplete = async (req, res) => {
  try {
    const { subjectIndex, topicIndex } = req.body;
    const syllabus = await Syllabus.findOne({ _id: req.params.id, user: req.userId });
    if (!syllabus) return res.status(404).json({ success: false, message: 'Syllabus not found' });
    
    if (syllabus.subjects[subjectIndex] && syllabus.subjects[subjectIndex].topics[topicIndex]) {
      const topic = syllabus.subjects[subjectIndex].topics[topicIndex];
      topic.completed = !topic.completed;
      topic.completedAt = topic.completed ? new Date() : null;
      await syllabus.save();
      
      // Update study streak
      const user = await mongoose.model('User').findById(req.userId);
      if (user && topic.completed) {
        const today = new Date().toDateString();
        if (user.studyPlan.lastActive?.toDateString() !== today) {
          user.studyPlan.studyStreak = (user.studyPlan.studyStreak || 0) + 1;
          user.studyPlan.lastActive = new Date();
          await user.save();
        }
      }
      
      res.json({ success: true, data: syllabus });
    } else {
      res.status(404).json({ success: false, message: 'Topic not found' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteSyllabus = async (req, res) => {
  try {
    await Syllabus.findOneAndDelete({ _id: req.params.id, user: req.userId });
    res.json({ success: true, message: 'Syllabus deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.generateAISyllabus = async (req, res) => {
  try {
    const { subject, examType, year } = req.body;
    const syllabus = await PlannerService.generateAISyllabus(req.userId, subject, examType, year);
    res.status(201).json({ success: true, data: syllabus });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getDailyPlan = async (req, res) => {
  try {
    const plan = await PlannerService.getDailyPlan(req.userId);
    res.json({ success: true, data: plan });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.generateSchedule = async (req, res) => {
  try {
    const { startDate, endDate, syllabusId } = req.body;
    const schedule = await PlannerService.generateSchedule(req.userId, startDate, endDate, syllabusId);
    res.json({ success: true, data: schedule });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== LECTURE PLANNER ==========

exports.createLecture = async (req, res) => {
  try {
    // Check conflicts
    const conflicts = await PlannerService.checkConflict(
      req.userId,
      new Date(req.body.date),
      req.body.startTime,
      req.body.endTime
    );
    if (conflicts.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Lecture time conflicts with existing lectures',
        conflicts,
      });
    }

    const lecture = new LecturePlan({
      ...req.body,
      user: req.userId,
    });
    await lecture.save();

    // Create reminders
    if (req.body.reminders) {
      for (const rem of req.body.reminders) {
        const reminderTime = new Date(lecture.date);
        reminderTime.setHours(0, 0, 0, 0);
        reminderTime.setMinutes(reminderTime.getMinutes() - rem.minutesBefore);
        await NotificationService.createReminder({
          userId: req.userId,
          type: 'lecture',
          title: `📚 Upcoming Lecture: ${lecture.title}`,
          description: `Your lecture "${lecture.title}" is starting soon!`,
          datetime: reminderTime,
          remindBefore: { enabled: true, minutes: rem.minutesBefore },
          targetType: 'lecture',
          targetId: lecture._id,
        });
      }
    }

    res.status(201).json({ success: true, data: lecture });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getLectures = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const filter = { user: req.userId, isDeleted: false };
    if (startDate) filter.date = { $gte: new Date(startDate) };
    if (endDate) filter.date = { ...filter.date, $lte: new Date(endDate) };
    
    const lectures = await LecturePlan.find(filter)
      .populate('instructor', 'name email')
      .sort({ date: 1, startTime: 1 });
    res.json({ success: true, data: lectures });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateLecture = async (req, res) => {
  try {
    const lecture = await LecturePlan.findOne({ _id: req.params.id, user: req.userId });
    if (!lecture) return res.status(404).json({ success: false, message: 'Lecture not found' });
    
    // Check conflicts excluding self
    if (req.body.date && req.body.startTime && req.body.endTime) {
      const conflicts = await PlannerService.checkConflict(
        req.userId,
        new Date(req.body.date),
        req.body.startTime,
        req.body.endTime,
        req.params.id
      );
      if (conflicts.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Lecture time conflicts with existing lectures',
          conflicts,
        });
      }
    }
    
    Object.assign(lecture, req.body);
    await lecture.save();
    res.json({ success: true, data: lecture });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteLecture = async (req, res) => {
  try {
    const lecture = await LecturePlan.findOne({ _id: req.params.id, user: req.userId });
    if (!lecture) return res.status(404).json({ success: false, message: 'Lecture not found' });
    lecture.isDeleted = true;
    await lecture.save();
    res.json({ success: true, message: 'Lecture deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== LIVE TEACHING ==========

exports.startLive = async (req, res) => {
  try {
    const lecture = await LecturePlan.findOne({ _id: req.params.id, user: req.userId });
    if (!lecture) return res.status(404).json({ success: false, message: 'Lecture not found' });
    
    // Generate meeting link if not exists
    if (!lecture.meetingLink) {
      // This would integrate with Zoom/Google Meet API
      // Placeholder: generate a fake link
      lecture.meetingLink = `https://meet.medsathu.inn/live/${lecture._id}`;
    }
    
    lecture.startLive(lecture.meetingLink);
    await lecture.save();

    // Notify all attendees
    const attendees = lecture.attendees.map(a => a.user);
    for (const attendeeId of attendees) {
      await NotificationService.createNotification({
        userId: attendeeId,
        type: 'lecture_reminder',
        title: '🔴 Live Lecture Started!',
        message: `${lecture.title} is now live! Join now.`,
        targetType: 'lecture',
        targetId: lecture._id,
        targetUrl: lecture.meetingLink,
        priority: 'urgent',
        channels: { push: true, email: true, inApp: true },
      });
    }

    res.json({ success: true, data: lecture });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.endLive = async (req, res) => {
  try {
    const lecture = await LecturePlan.findOne({ _id: req.params.id, user: req.userId });
    if (!lecture) return res.status(404).json({ success: false, message: 'Lecture not found' });
    
    lecture.endLive(req.body.recordingUrl);
    await lecture.save();
    res.json({ success: true, data: lecture });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.joinLecture = async (req, res) => {
  try {
    const lecture = await LecturePlan.findById(req.params.id);
    if (!lecture) return res.status(404).json({ success: false, message: 'Lecture not found' });
    
    lecture.addAttendee(req.userId);
    await lecture.save();
    res.json({ success: true, data: lecture });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.leaveLecture = async (req, res) => {
  try {
    const lecture = await LecturePlan.findById(req.params.id);
    if (!lecture) return res.status(404).json({ success: false, message: 'Lecture not found' });
    
    lecture.removeAttendee(req.userId);
    await lecture.save();
    res.json({ success: true, data: lecture });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== REVISION PLANNER ==========

exports.createRevisionPlan = async (req, res) => {
  try {
    const plan = new RevisionPlan({
      ...req.body,
      user: req.userId,
    });
    await plan.save();
    res.status(201).json({ success: true, data: plan });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getRevisionPlans = async (req, res) => {
  try {
    const plans = await RevisionPlan.find({ user: req.userId, isActive: true });
    res.json({ success: true, data: plans });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateRevisionPlan = async (req, res) => {
  try {
    const plan = await RevisionPlan.findOne({ _id: req.params.id, user: req.userId });
    if (!plan) return res.status(404).json({ success: false, message: 'Revision plan not found' });
    Object.assign(plan, req.body);
    await plan.save();
    res.json({ success: true, data: plan });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteRevisionPlan = async (req, res) => {
  try {
    await RevisionPlan.findOneAndDelete({ _id: req.params.id, user: req.userId });
    res.json({ success: true, message: 'Revision plan deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== SHARE LINKS ==========

exports.createShareLink = async (req, res) => {
  try {
    const { targetType, targetId, permission, password, expiresAt, maxUses, sharedVia } = req.body;
    
    // Verify ownership or access
    let target;
    const model = mongoose.model(targetType.charAt(0).toUpperCase() + targetType.slice(1));
    if (!model) return res.status(400).json({ success: false, message: 'Invalid target type' });
    
    target = await model.findById(targetId);
    if (!target) return res.status(404).json({ success: false, message: 'Target not found' });
    
    // Check ownership (some models may have 'user' field)
    if (target.user && target.user.toString() !== req.userId) {
      return res.status(403).json({ success: false, message: 'You don\'t own this item' });
    }
    
    const share = new ShareLink({
      user: req.userId,
      targetType,
      targetId,
      permission: permission || 'view',
      expiresAt,
      maxUses,
      sharedVia: { platform: sharedVia || 'link' },
      password,
    });
    await share.save();
    
    const link = `${process.env.FRONTEND_URL}/shared/${share.token}`;
    res.status(201).json({
      success: true,
      data: share,
      link,
      qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(link)}`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getShareLink = async (req, res) => {
  try {
    const { token } = req.params;
    const share = await ShareLink.findByToken(token);
    if (!share) return res.status(404).json({ success: false, message: 'Invalid or expired link' });
    
    // Track visit
    share.trackVisit(req.ip, req.headers['user-agent'], req.userId || null);
    await share.save();
    
    // Fetch the target content
    const model = mongoose.model(share.targetType.charAt(0).toUpperCase() + share.targetType.slice(1));
    const content = await model.findById(share.targetId);
    if (!content) return res.status(404).json({ success: false, message: 'Content not found' });
    
    res.json({
      success: true,
      data: {
        share: share.getStats(),
        content: share.permission === 'view' ? content : content,
        permission: share.permission,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getMyShareLinks = async (req, res) => {
  try {
    const links = await ShareLink.find({ user: req.userId, isActive: true })
      .sort({ createdAt: -1 });
    res.json({ success: true, data: links });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteShareLink = async (req, res) => {
  try {
    const share = await ShareLink.findOne({ _id: req.params.id, user: req.userId });
    if (!share) return res.status(404).json({ success: false, message: 'Share link not found' });
    share.isActive = false;
    await share.save();
    res.json({ success: true, message: 'Share link revoked' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
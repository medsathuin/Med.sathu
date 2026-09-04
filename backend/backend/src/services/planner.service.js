const Syllabus = require('../models/Syllabus');
const LecturePlan = require('../models/LecturePlan');
const RevisionPlan = require('../models/RevisionPlan');
const NotificationService = require('./notification.service');
const { OpenAI } = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

class PlannerService {
  
  // ========== GENERATE SMART SYLLABUS FROM AI ==========
  static async generateAISyllabus(userId, subject, examType = 'NEET PG', year = 1) {
    const prompt = `
      Generate a detailed syllabus for ${subject} for MBBS Year ${year} student preparing for ${examType}.
      Include at least 8 major topics, each with 3-5 subtopics.
      Also include priority (1-5) and estimated study hours for each topic.
      Return as JSON with structure:
      {
        "subjects": [
          {
            "name": "subject name",
            "topics": [
              { "name": "topic", "priority": 3, "estimatedHours": 4, "subtopics": ["sub1", "sub2"] }
            ]
          }
        ]
      }
    `;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: 'You are a medical education expert. Generate comprehensive syllabus.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const data = JSON.parse(response.choices[0].message.content);
      
      // Create syllabus from AI response
      const syllabus = new Syllabus({
        user: userId,
        name: subject,
        examType,
        subjects: data.subjects.map(sub => ({
          name: sub.name,
          topics: sub.topics.map(t => ({
            name: t.name,
            priority: t.priority || 3,
            resources: [],
            completed: false,
            difficulty: t.priority > 4 ? 'hard' : t.priority > 2 ? 'medium' : 'easy',
          })),
        })),
      });

      await syllabus.save();
      return syllabus;
    } catch (error) {
      console.error('AI Syllabus generation error:', error);
      throw new Error('Failed to generate AI syllabus');
    }
  }

  // ========== GET DAILY STUDY PLAN ==========
  static async getDailyPlan(userId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const syllabus = await Syllabus.findOne({ user: userId, isActive: true });
    const revisions = await RevisionPlan.find({ user: userId, isActive: true });
    const lectures = await LecturePlan.find({
      user: userId,
      date: { $gte: today, $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) },
      isDeleted: false,
    });

    let plan = {
      date: today,
      lectures: [],
      revisionTopics: [],
      syllabusTopics: [],
      totalTasks: 0,
      completedTasks: 0,
    };

    // Get pending syllabus topics (prioritize high priority)
    if (syllabus) {
      const pending = [];
      syllabus.subjects.forEach(sub => {
        sub.topics.forEach(topic => {
          if (!topic.completed) {
            pending.push({
              topic: topic.name,
              subject: sub.name,
              priority: topic.priority || 3,
              deadline: topic.deadline,
              id: topic._id,
            });
          }
        });
      });
      // Sort by priority (highest first)
      pending.sort((a, b) => b.priority - a.priority);
      plan.syllabusTopics = pending.slice(0, 5);
    }

    // Get today's lectures
    plan.lectures = lectures.map(l => ({
      id: l._id,
      title: l.title,
      startTime: l.startTime,
      endTime: l.endTime,
      isLive: l.isLive,
      meetingLink: l.meetingLink,
    }));

    // Get due revision topics
    const due = await RevisionPlan.getDueTopics(userId);
    plan.revisionTopics = due.slice(0, 5);

    plan.totalTasks = plan.syllabusTopics.length + plan.revisionTopics.length + plan.lectures.length;
    // Assume lectures are auto-completed if attended (logic later)
    // For now, count them as pending

    return plan;
  }

  // ========== GENERATE STUDY SCHEDULE (Weeks) ==========
  static async generateSchedule(userId, startDate, endDate, syllabusId = null) {
    const syllabus = syllabusId 
      ? await Syllabus.findById(syllabusId)
      : await Syllabus.findOne({ user: userId, isActive: true });

    if (!syllabus) throw new Error('No active syllabus found');

    const days = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24));
    if (days <= 0) throw new Error('End date must be after start date');

    // Get all pending topics
    const pendingTopics = [];
    syllabus.subjects.forEach(sub => {
      sub.topics.forEach(topic => {
        if (!topic.completed) {
          pendingTopics.push({
            name: topic.name,
            subject: sub.name,
            priority: topic.priority || 3,
            estimatedHours: 2, // default
          });
        }
      });
    });

    if (pendingTopics.length === 0) {
      return { message: 'All topics completed! 🎉' };
    }

    // Sort by priority
    pendingTopics.sort((a, b) => b.priority - a.priority);

    // Distribute across days
    const schedule = [];
    const topicsPerDay = Math.ceil(pendingTopics.length / days);
    const now = new Date(startDate);

    let topicIndex = 0;
    for (let i = 0; i < days && topicIndex < pendingTopics.length; i++) {
      const dayPlan = {
        date: new Date(now),
        topics: [],
      };
      for (let j = 0; j < topicsPerDay && topicIndex < pendingTopics.length; j++) {
        dayPlan.topics.push(pendingTopics[topicIndex]);
        topicIndex++;
      }
      schedule.push(dayPlan);
      now.setDate(now.getDate() + 1);
    }

    return schedule;
  }

  // ========== CHECK FOR CONFLICTS (Lectures) ==========
  static async checkConflict(userId, date, startTime, endTime, excludeId = null) {
    const existing = await LecturePlan.find({
      user: userId,
      date: {
        $gte: new Date(date.setHours(0, 0, 0, 0)),
        $lt: new Date(new Date(date).setHours(23, 59, 59, 999)),
      },
      isDeleted: false,
      _id: { $ne: excludeId },
    });

    const conflicts = [];
    const startMins = this.timeToMinutes(startTime);
    const endMins = this.timeToMinutes(endTime);

    existing.forEach(lecture => {
      const lStart = this.timeToMinutes(lecture.startTime);
      const lEnd = this.timeToMinutes(lecture.endTime);
      if ((startMins >= lStart && startMins < lEnd) || 
          (endMins > lStart && endMins <= lEnd) ||
          (startMins <= lStart && endMins >= lEnd)) {
        conflicts.push(lecture);
      }
    });

    return conflicts;
  }

  static timeToMinutes(time) {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }
}

module.exports = PlannerService;
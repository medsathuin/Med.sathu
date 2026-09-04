const mongoose = require('mongoose');

const LecturePlanSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true },
  description: String,
  subject: String,
  topic: String,

  // Scheduling
  date: { type: Date, required: true, index: true },
  startTime: { type: String, required: true }, // "09:00"
  endTime: { type: String, required: true },
  duration: { type: Number, default: 60 }, // in minutes

  // Teacher / Instructor
  instructor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  coInstructors: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  // Materials
  slides: [{
    url: String,
    name: String,
    version: { type: Number, default: 1 },
    uploadedAt: Date,
  }],
  attachments: [{
    url: String,
    name: String,
    type: { type: String, enum: ['pdf', 'doc', 'image', 'video', 'other'] },
  }],
  resources: [{
    title: String,
    url: String,
    type: { type: String, enum: ['link', 'video', 'pdf', 'note'] },
  }],

  // Live Teaching
  isLive: { type: Boolean, default: false },
  liveStatus: {
    type: String,
    enum: ['scheduled', 'live', 'ended', 'recorded'],
    default: 'scheduled',
  },
  meetingLink: String, // Zoom/Google Meet/Teams
  meetingId: String,
  meetingPassword: String,
  platform: { type: String, enum: ['zoom', 'google_meet', 'msteams', 'custom'] },
  recordingUrl: String,
  chatTranscript: String,

  // Participants
  attendees: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    joinedAt: Date,
    leftAt: Date,
    duration: Number,
    isActive: { type: Boolean, default: false },
  }],
  maxAttendees: { type: Number, default: 100 },
  isPublic: { type: Boolean, default: false },

  // Interactive features
  polls: [{
    question: String,
    options: [String],
    results: { type: Map, of: Number },
    createdAt: Date,
    isActive: Boolean,
  }],
  quizzes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Quiz' }],
  qaSession: {
    enabled: { type: Boolean, default: true },
    questions: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      question: String,
      upvotes: { type: Number, default: 0 },
      isAnswered: { type: Boolean, default: false },
      answeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      answer: String,
      createdAt: Date,
    }],
  },

  // Reminders
  reminders: [{
    minutesBefore: Number,
    sent: { type: Boolean, default: false },
  }],

  // Analytics
  views: { type: Number, default: 0 },
  avgRating: { type: Number, min: 0, max: 5, default: 0 },
  ratings: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rating: { type: Number, min: 1, max: 5 },
    review: String,
    createdAt: Date,
  }],

  // Status
  isDeleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Indexes
LecturePlanSchema.index({ user: 1, date: 1 });
LecturePlanSchema.index({ 'attendees.user': 1 });
LecturePlanSchema.index({ isLive: 1, liveStatus: 1 });

// ========== PRE-SAVE: Auto-calculate duration ==========
LecturePlanSchema.pre('save', function(next) {
  if (this.startTime && this.endTime) {
    const start = this.startTime.split(':').map(Number);
    const end = this.endTime.split(':').map(Number);
    if (start.length === 2 && end.length === 2) {
      const startMinutes = start[0] * 60 + start[1];
      const endMinutes = end[0] * 60 + end[1];
      this.duration = endMinutes - startMinutes;
      if (this.duration < 0) this.duration += 1440; // Across midnight
    }
  }
  this.updatedAt = new Date();
  next();
});

// ========== METHOD: Add attendee ==========
LecturePlanSchema.methods.addAttendee = function(userId) {
  if (!this.attendees.find(a => a.user.toString() === userId.toString())) {
    this.attendees.push({
      user: userId,
      joinedAt: new Date(),
      isActive: true,
    });
    return true;
  }
  return false;
};

// ========== METHOD: Remove attendee ==========
LecturePlanSchema.methods.removeAttendee = function(userId) {
  const attendee = this.attendees.find(a => a.user.toString() === userId.toString());
  if (attendee) {
    attendee.leftAt = new Date();
    attendee.duration = (attendee.leftAt - attendee.joinedAt) / 60000;
    attendee.isActive = false;
    return true;
  }
  return false;
};

// ========== METHOD: Start live ==========
LecturePlanSchema.methods.startLive = function(meetingLink) {
  this.isLive = true;
  this.liveStatus = 'live';
  if (meetingLink) this.meetingLink = meetingLink;
  return this;
};

// ========== METHOD: End live ==========
LecturePlanSchema.methods.endLive = function(recordingUrl) {
  this.isLive = false;
  this.liveStatus = 'ended';
  if (recordingUrl) this.recordingUrl = recordingUrl;
  return this;
};

// ========== METHOD: Add poll ==========
LecturePlanSchema.methods.addPoll = function(question, options) {
  this.polls.push({
    question,
    options,
    createdAt: new Date(),
    isActive: true,
    results: new Map(),
  });
  return this;
};

// ========== METHOD: Submit poll vote ==========
LecturePlanSchema.methods.votePoll = function(pollIndex, optionIndex) {
  if (this.polls[pollIndex]) {
    const poll = this.polls[pollIndex];
    if (poll.isActive && optionIndex < poll.options.length) {
      const key = poll.options[optionIndex];
      poll.results.set(key, (poll.results.get(key) || 0) + 1);
      return true;
    }
  }
  return false;
};

module.exports = mongoose.model('LecturePlan', LecturePlanSchema);
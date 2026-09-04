const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['student', 'teacher', 'admin'], default: 'student' },
  
  subscription: {
    plan: { type: String, enum: ['free', 'monthly', 'yearly', 'admin'], default: 'free' },
    startDate: Date,
    endDate: Date,
    freeLecturesUsed: { type: Number, default: 0 },
    freeLimit: { type: Number, default: 10 }
  },
  
  security: {
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: String,
    lastLogin: Date,
    loginAttempts: { type: Number, default: 0 },
    isLocked: { type: Boolean, default: false }
  },
  
  social: {
    userId: { type: String, unique: true },
    university: String,
    year: String,
    profilePicture: String,
    bio: String,
    friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  },
  
  progress: {
    qbank: {
      attempted: { type: Number, default: 0 },
      correct: { type: Number, default: 0 },
      incorrect: { type: Number, default: 0 },
      accuracy: { type: Number, default: 0 }
    }
  },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

UserSchema.pre('save', function(next) {
  if (!this.social.userId) {
    this.social.userId = 'MS' + Math.random().toString(36).substring(2, 10).toUpperCase();
  }
  this.updatedAt = Date.now();
  next();
});

UserSchema.methods.hasSubscriptionAccess = function() {
  if (this.role === 'admin' || this.subscription.plan === 'admin') return true;
  if (this.subscription.plan === 'free') {
    return this.subscription.freeLecturesUsed < this.subscription.freeLimit;
  }
  if (this.subscription.plan === 'monthly' || this.subscription.plan === 'yearly') {
    return this.subscription.endDate && new Date(this.subscription.endDate) > new Date();
  }
  return false;
};

UserSchema.methods.getRemainingFreeLectures = function() {
  if (this.subscription.plan !== 'free') return 0;
  return Math.max(0, this.subscription.freeLimit - this.subscription.freeLecturesUsed);
};

module.exports = mongoose.model('User', UserSchema);
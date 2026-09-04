const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const redisClient = require('../config/redis');

// ========== ADVANCED RATE LIMITING ==========
const advancedRateLimit = rateLimit({
  store: new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
  }),
  windowMs: 15 * 60 * 1000,
  max: 100,
  keyGenerator: (req) => {
    // Rate limit by IP + User-Agent combination
    return crypto
      .createHash('sha256')
      .update(`${req.ip}-${req.headers['user-agent']}`)
      .digest('hex');
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many requests. Please slow down.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000),
    });
  },
});

// ========== REQUEST VALIDATION ==========
const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: error.details.map(d => d.message),
      });
    }
    next();
  };
};

// ========== SQL INJECTION PREVENTION ==========
const sqlInjectionCheck = (req, res, next) => {
  const suspicious = ['select', 'union', 'drop', 'insert', 'update', 'delete'];
  const checkString = (str) => {
    if (!str) return false;
    return suspicious.some(word => str.toLowerCase().includes(word));
  };

  const checkObject = (obj) => {
    for (let key in obj) {
      if (typeof obj[key] === 'string' && checkString(obj[key])) {
        return true;
      }
      if (typeof obj[key] === 'object' && checkObject(obj[key])) {
        return true;
      }
    }
    return false;
  };

  if (checkObject(req.body) || checkObject(req.query) || checkObject(req.params)) {
    return res.status(403).json({
      success: false,
      message: 'Potential SQL injection detected',
    });
  }
  next();
};

// ========== DEVICE FINGERPRINTING ==========
const generateDeviceFingerprint = (req) => {
  const data = [
    req.headers['user-agent'],
    req.headers['accept-language'],
    req.headers['accept-encoding'],
    req.ip,
    req.headers['sec-ch-ua-platform'],
  ].join('|');
  
  return crypto
    .createHash('sha256')
    .update(data)
    .digest('hex');
};

// ========== SESSION MANAGEMENT ==========
const sessionManager = {
  sessions: new Map(),
  
  createSession(userId, deviceId) {
    const sessionId = crypto.randomBytes(32).toString('hex');
    this.sessions.set(sessionId, {
      userId,
      deviceId,
      createdAt: Date.now(),
      lastActivity: Date.now(),
    });
    return sessionId;
  },
  
  validateSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    
    // Expire after 30 days
    if (Date.now() - session.createdAt > 30 * 24 * 60 * 60 * 1000) {
      this.sessions.delete(sessionId);
      return false;
    }
    
    // Update last activity
    session.lastActivity = Date.now();
    return true;
  },
  
  invalidateSession(sessionId) {
    this.sessions.delete(sessionId);
  },
  
  invalidateAllSessions(userId) {
    for (const [sessionId, session] of this.sessions) {
      if (session.userId === userId) {
        this.sessions.delete(sessionId);
      }
    }
  },
};

module.exports = {
  advancedRateLimit,
  validateRequest,
  sqlInjectionCheck,
  generateDeviceFingerprint,
  sessionManager,
};
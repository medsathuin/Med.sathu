const rateLimit = require('express-rate-limit');
const redis = require('redis');
const { createClient } = require('redis');

let redisClient = null;

// Initialize Redis if available
const initRedis = async () => {
  if (!redisClient && process.env.REDIS_URL) {
    redisClient = createClient({ url: process.env.REDIS_URL });
    await redisClient.connect();
  }
  return redisClient;
};

// ========== SMART RATE LIMITER ==========
const createSmartRateLimiter = (options = {}) => {
  const {
    windowMs = 60 * 1000,
    max = 100,
    message = 'Too many requests, please try again later.',
    keyGenerator = (req) => req.ip,
    skip = () => false,
  } = options;

  return async (req, res, next) => {
    // Skip if specified
    if (skip(req)) return next();

    const key = keyGenerator(req);
    const client = await initRedis();

    if (client) {
      try {
        const current = await client.incr(key);
        if (current === 1) await client.expire(key, Math.ceil(windowMs / 1000));

        // Check against max
        if (current > max) {
          const ttl = await client.ttl(key);
          return res.status(429).json({
            success: false,
            message,
            retryAfter: ttl,
            limit: max,
            current,
          });
        }

        // Add rate limit info to request
        req.rateLimit = { current, limit: max, remaining: Math.max(0, max - current) };
        next();
      } catch (error) {
        // Redis failed, fallback to memory
        return memoryRateLimiter(req, res, next, key, windowMs, max, message);
      }
    } else {
      // No Redis, use memory
      return memoryRateLimiter(req, res, next, key, windowMs, max, message);
    }
  };
};

// ========== MEMORY FALLBACK ==========
const memoryStore = new Map();

const memoryRateLimiter = (req, res, next, key, windowMs, max, message) => {
  const now = Date.now();
  const record = memoryStore.get(key) || { count: 0, reset: now + windowMs };

  // Reset if window expired
  if (now > record.reset) {
    record.count = 0;
    record.reset = now + windowMs;
  }

  record.count += 1;
  memoryStore.set(key, record);

  if (record.count > max) {
    const retryAfter = Math.ceil((record.reset - now) / 1000);
    return res.status(429).json({
      success: false,
      message,
      retryAfter: Math.max(0, retryAfter),
      limit: max,
      current: record.count,
    });
  }

  req.rateLimit = {
    current: record.count,
    limit: max,
    remaining: Math.max(0, max - record.count),
  };

  next();
};

// ========== ADAPTIVE RATE LIMITER ==========
const adaptiveRateLimit = (options = {}) => {
  const baseMax = options.max || 100;
  const windowMs = options.windowMs || 60000;

  return async (req, res, next) => {
    // Adjust limit based on user role
    let max = baseMax;
    if (req.user) {
      if (req.user.role === 'admin') max = baseMax * 5;
      else if (req.user.role === 'teacher') max = baseMax * 2;
      else if (req.user.subscription?.plan === 'premium') max = baseMax * 1.5;
    }

    const limiter = createSmartRateLimiter({
      windowMs,
      max,
      message: options.message || 'Rate limit exceeded',
      keyGenerator: (req) => {
        if (req.user) return `user:${req.user._id}`;
        return `ip:${req.ip}`;
      },
    });

    await limiter(req, res, next);
  };
};

module.exports = {
  createSmartRateLimiter,
  adaptiveRateLimit,
};
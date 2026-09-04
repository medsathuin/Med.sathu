const SecurityLog = require('../models/SecurityLog');
const User = require('../models/User');

class IntrusionDetectionService {
  constructor() {
    this.failedAttempts = new Map(); // userId -> { count, firstAttempt, lastAttempt }
    this.thresholds = {
      maxFailedLogin: 5,
      maxSuspiciousActions: 10,
      timeWindow: 15 * 60 * 1000, // 15 minutes
    };
  }

  // ========== CHECK SUSPICIOUS LOGIN ==========
  async checkLoginAttempt(userId, ip, userAgent) {
    const now = Date.now();
    const key = userId || ip;

    // Check if this IP has been flagged
    const recentAttempts = await SecurityLog.find({
      'details.ip': ip,
      action: 'failed_login',
      createdAt: { $gte: new Date(now - this.thresholds.timeWindow) },
    });

    if (recentAttempts.length >= this.thresholds.maxFailedLogin) {
      // Flag as suspicious
      await this.flagSuspiciousActivity(ip, 'multiple_failed_logins', recentAttempts.length);

      // Check if user exists and lock account
      if (userId) {
        await User.findByIdAndUpdate(userId, { 'security.isLocked': true });
      }

      return {
        allowed: false,
        reason: 'Too many failed login attempts. Account locked.',
        lockDuration: 30 * 60 * 1000, // 30 minutes
      };
    }

    // Check for brute force patterns (same user, different IPs)
    if (userId) {
      const differentIPs = await SecurityLog.distinct('details.ip', {
        user: userId,
        action: 'failed_login',
        createdAt: { $gte: new Date(now - this.thresholds.timeWindow) },
      });

      if (differentIPs.length >= 3) {
        await this.flagSuspiciousActivity(userId, 'brute_force_attempt', differentIPs.length);
        return {
          allowed: false,
          reason: 'Suspicious activity detected. Account temporarily locked.',
          lockDuration: 60 * 60 * 1000, // 60 minutes
        };
      }
    }

    return { allowed: true };
  }

  // ========== FLAG SUSPICIOUS ACTIVITY ==========
  async flagSuspiciousActivity(target, type, count) {
    await SecurityLog.create({
      action: 'suspicious_activity',
      severity: 'critical',
      isSuspicious: true,
      details: {
        metadata: {
          target,
          type,
          count,
          timestamp: new Date().toISOString(),
        },
      },
    });
  }

  // ========== CHECK RATE LIMIT ==========
  async checkRateLimit(identifier, action, limit = 100, windowMs = 60000) {
    const now = Date.now();
    const recent = await SecurityLog.countDocuments({
      'details.ip': identifier,
      action: action,
      createdAt: { $gte: new Date(now - windowMs) },
    });

    if (recent >= limit) {
      await this.flagSuspiciousActivity(identifier, 'rate_limit_exceeded', recent);
      return {
        allowed: false,
        retryAfter: Math.ceil(windowMs / 1000),
      };
    }

    return { allowed: true };
  }

  // ========== ANALYZE ACCESS PATTERN ==========
  async analyzeAccessPattern(userId) {
    const logs = await SecurityLog.find({
      user: userId,
      action: { $in: ['content_view', 'content_edit', 'content_delete'] },
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    });

    if (logs.length < 10) return { risk: 'low' };

    // Analyze patterns
    const hourDistribution = {};
    const resourceTypes = {};

    logs.forEach(log => {
      const hour = new Date(log.createdAt).getHours();
      hourDistribution[hour] = (hourDistribution[hour] || 0) + 1;
      resourceTypes[log.resourceType] = (resourceTypes[log.resourceType] || 0) + 1;
    });

    // Check for unusual hours (e.g., 2 AM - 5 AM)
    const unusualHours = Object.keys(hourDistribution)
      .filter(h => h >= 2 && h <= 5)
      .reduce((sum, h) => sum + hourDistribution[h], 0);

    const total = logs.length;
    const unusualRatio = unusualHours / total;

    if (unusualRatio > 0.3) {
      return {
        risk: 'high',
        reason: 'High activity during unusual hours',
        details: { unusualRatio, unusualHours: Object.keys(hourDistribution).filter(h => h >= 2 && h <= 5) },
      };
    }

    // Check if accessing too many different resources
    const resourceTypesCount = Object.keys(resourceTypes).length;
    if (resourceTypesCount > 5 && total < 20) {
      return {
        risk: 'medium',
        reason: 'Accessing many different resource types in short period',
        details: { resourceTypesCount, resourceTypes },
      };
    }

    return { risk: 'low' };
  }
}

module.exports = new IntrusionDetectionService();
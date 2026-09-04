const { createClient } = require('redis');
const User = require('../models/User');

class AnalyticsService {
  constructor() {
    this.redis = createClient();
    this.redis.connect();
  }

  // ========== USER ENGAGEMENT ==========
  async trackEngagement(userId, action, metadata = {}) {
    const key = `engagement:${userId}`;
    const data = {
      action,
      timestamp: new Date().toISOString(),
      ...metadata,
    };
    
    await this.redis.rpush(key, JSON.stringify(data));
    await this.redis.expire(key, 86400 * 30); // 30 days
    
    // Increment counters
    await this.redis.hincrby(`counters:${userId}`, action, 1);
  }

  // ========== STUDY PATTERN ANALYSIS ==========
  async analyzeStudyPattern(userId) {
    const key = `engagement:${userId}`;
    const data = await this.redis.lrange(key, 0, -1);
    
    if (!data || data.length === 0) {
      return null;
    }
    
    const parsed = data.map(JSON.parse);
    const analytics = {
      totalSessions: 0,
      averageDuration: 0,
      mostActiveHour: 0,
      mostActiveDay: '',
      topics: {},
      performance: {
        correctRate: 0,
        avgScore: 0,
        weakTopics: [],
      },
    };
    
    // Analyze patterns
    const hours = {};
    const days = {};
    const sessions = [];
    let totalDuration = 0;
    
    parsed.forEach((entry, index) => {
      const hour = new Date(entry.timestamp).getHours();
      const day = new Date(entry.timestamp).toDateString();
      
      hours[hour] = (hours[hour] || 0) + 1;
      days[day] = (days[day] || 0) + 1;
      
      if (entry.action === 'session_start') {
        sessions.push({ start: entry.timestamp, index });
      } else if (entry.action === 'session_end') {
        const lastSession = sessions.pop();
        if (lastSession) {
          const duration = new Date(entry.timestamp) - new Date(lastSession.start);
          totalDuration += duration;
          analytics.totalSessions++;
        }
      }
      
      if (entry.topic) {
        analytics.topics[entry.topic] = (analytics.topics[entry.topic] || 0) + 1;
      }
    });
    
    // Calculate averages
    analytics.averageDuration = analytics.totalSessions > 0 
      ? totalDuration / analytics.totalSessions 
      : 0;
    
    const maxHour = Object.entries(hours).sort((a, b) => b[1] - a[1])[0];
    if (maxHour) analytics.mostActiveHour = parseInt(maxHour[0]);
    
    const maxDay = Object.entries(days).sort((a, b) => b[1] - a[1])[0];
    if (maxDay) analytics.mostActiveDay = maxDay[0];
    
    // Calculate performance
    const qbank = await User.findById(userId).select('progress.qbank');
    if (qbank && qbank.progress && qbank.progress.qbank) {
      const { attempted, correct } = qbank.progress.qbank;
      if (attempted > 0) {
        analytics.performance.avgScore = (correct / attempted) * 100;
        analytics.performance.correctRate = correct / attempted;
      }
    }
    
    return analytics;
  }

  // ========== PREDICTIVE INSIGHTS ==========
  async predictPerformance(userId) {
    const pattern = await this.analyzeStudyPattern(userId);
    if (!pattern) return null;
    
    const predictions = {
      estimatedExamScore: 0,
      recommendedDailyStudyTime: 0,
      predictedWeakTopics: [],
      studyConsistency: 0,
    };
    
    // Calculate consistency
    const consistency = await this.calculateConsistency(userId);
    predictions.studyConsistency = consistency;
    
    // Predict exam score (simplified model)
    if (pattern.performance.avgScore > 0) {
      const baseScore = pattern.performance.avgScore;
      const consistencyBoost = consistency * 0.1;
      predictions.estimatedExamScore = Math.min(100, baseScore + (baseScore * consistencyBoost));
    }
    
    // Recommended daily study time
    if (pattern.averageDuration > 0) {
      const recommended = pattern.averageDuration * 0.6;
      predictions.recommendedDailyStudyTime = Math.max(60, Math.min(360, recommended));
    }
    
    // Predict weak topics
    const topics = Object.entries(pattern.topics || {})
      .sort((a, b) => a[1] - b[1])
      .slice(0, 3)
      .map(([topic]) => topic);
    predictions.predictedWeakTopics = topics;
    
    return predictions;
  }

  // ========== CONSISTENCY SCORE ==========
  async calculateConsistency(userId) {
    const key = `engagement:${userId}`;
    const data = await this.redis.lrange(key, 0, -1);
    
    if (!data || data.length < 7) return 0;
    
    const parsed = data.map(JSON.parse);
    const lastWeek = parsed.filter(d => {
      const days = (Date.now() - new Date(d.timestamp).getTime()) / (1000 * 60 * 60 * 24);
      return days <= 7;
    });
    
    if (lastWeek.length === 0) return 0;
    
    const uniqueDays = new Set(lastWeek.map(d => 
      new Date(d.timestamp).toDateString()
    ));
    
    return (uniqueDays.size / 7) * 100;
  }

  // ========== GENERATE REPORT ==========
  async generateReport(userId, period = 'month') {
    const pattern = await this.analyzeStudyPattern(userId);
    const predictions = await this.predictPerformance(userId);
    
    if (!pattern || !predictions) return null;
    
    return {
      userId,
      period,
      generatedAt: new Date().toISOString(),
      summary: {
        totalStudyTime: pattern.averageDuration * pattern.totalSessions,
        totalSessions: pattern.totalSessions,
        mostActiveDay: pattern.mostActiveDay,
        mostActiveHour: pattern.mostActiveHour,
        consistency: predictions.studyConsistency,
      },
      performance: {
        averageScore: pattern.performance.avgScore,
        correctRate: pattern.performance.correctRate,
        estimatedExamScore: predictions.estimatedExamScore,
      },
      insights: {
        recommendedDailyStudyTime: predictions.recommendedDailyStudyTime,
        predictedWeakTopics: predictions.predictedWeakTopics,
        strengths: this.identifyStrengths(pattern),
      },
      recommendations: this.generateRecommendations(pattern, predictions),
    };
  }

  identifyStrengths(pattern) {
    const topics = Object.entries(pattern.topics || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([topic]) => topic);
    return topics;
  }

  generateRecommendations(pattern, predictions) {
    const recommendations = [];
    
    if (predictions.studyConsistency < 50) {
      recommendations.push('Focus on daily consistency - even 30 minutes daily helps');
    }
    
    if (predictions.predictedWeakTopics.length > 0) {
      recommendations.push(`Dedicate extra time to: ${predictions.predictedWeakTopics.join(', ')}`);
    }
    
    if (pattern.mostActiveHour < 6 || pattern.mostActiveHour > 22) {
      recommendations.push('Consider studying during peak alertness hours (9 AM - 6 PM)');
    }
    
    if (pattern.performance.avgScore < 60) {
      recommendations.push('Focus on QBank practice - aim for 100 questions daily');
    }
    
    return recommendations;
  }
}

module.exports = new AnalyticsService();
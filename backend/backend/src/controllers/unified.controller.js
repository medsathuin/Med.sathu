const User = require('../models/User');
const AITutor = require('../services/aiTutor.service');
const Analytics = require('../services/analytics.service');
const { sessionManager } = require('../middleware/advancedSecurity');

// ========== UNIFIED API RESPONSE ==========
class UnifiedController {
  // ========== STUDENT DASHBOARD ==========
  async getDashboard(req, res) {
    try {
      const userId = req.userId;
      const user = await User.findById(userId)
        .populate('social.friends', 'name email social.userId')
        .populate('progress.courses.courseId');

      // Get analytics
      const analytics = await Analytics.generateReport(userId);
      
      // Get AI recommendations
      const recommendations = await AITutor.getResponse(
        userId,
        'Based on my recent progress, what should I focus on next?',
        { year: user.social.year, examType: 'NEET PG' }
      );

      res.json({
        success: true,
        data: {
          user: {
            id: user._id,
            name: user.name,
            role: user.role,
            userId: user.social.userId,
            university: user.social.university,
            subscription: user.subscription.plan,
            freeRemaining: user.getRemainingFreeLectures(),
          },
          progress: {
            overall: user.progress,
            courseProgress: user.progress.courses,
            qbank: user.progress.qbank,
          },
          analytics: analytics || {},
          recommendations: {
            ai: recommendations.response,
            followUps: recommendations.followUps,
            personalized: analytics?.recommendations || [],
          },
          upcomingTasks: user.studyPlan?.dailyGoals || [],
          examCountdown: this.calculateExamCountdown(user.studyPlan?.examDate),
          recentActivity: await this.getRecentActivity(userId),
        }
      });
    } catch (error) {
      console.error('Dashboard error:', error);
      res.status(500).json({
        success: false,
        message: 'Error loading dashboard',
      });
    }
  }

  // ========== SMART SEARCH ==========
  async smartSearch(req, res) {
    try {
      const { query, type = 'all' } = req.body;
      const userId = req.userId;

      // Search across multiple collections
      const results = {
        courses: [],
        notes: [],
        qbank: [],
        flashcards: [],
        community: [],
      };

      // Perform parallel searches
      await Promise.all([
        this.searchCourses(query, userId),
        this.searchNotes(query, userId),
        this.searchQBank(query),
        this.searchFlashcards(query, userId),
        this.searchCommunity(query),
      ]).then(([courses, notes, qbank, flashcards, community]) => {
        results.courses = courses;
        results.notes = notes;
        results.qbank = qbank;
        results.flashcards = flashcards;
        results.community = community;
      });

      // Rank results
      const ranked = this.rankSearchResults(results);

      res.json({
        success: true,
        data: ranked,
        total: ranked.length,
      });
    } catch (error) {
      console.error('Search error:', error);
      res.status(500).json({
        success: false,
        message: 'Search failed',
      });
    }
  }

  // ========== SUBSCRIPTION MANAGEMENT ==========
  async manageSubscription(req, res) {
    try {
      const { plan, paymentMethod } = req.body;
      const userId = req.userId;

      const user = await User.findById(userId);
      
      // Validate plan
      const plans = {
        monthly: { price: 499, duration: 30 },
        yearly: { price: 4999, duration: 365 },
      };

      if (!plans[plan]) {
        return res.status(400).json({
          success: false,
          message: 'Invalid plan selected',
        });
      }

      // Process payment (Stripe/Razorpay)
      const payment = await this.processPayment(user, plan, paymentMethod);
      
      // Update subscription
      user.subscription.plan = plan;
      user.subscription.startDate = new Date();
      user.subscription.endDate = new Date(Date.now() + plans[plan].duration * 24 * 60 * 60 * 1000);
      user.subscription.paymentMethod = paymentMethod;
      user.subscription.stripeCustomerId = payment.customerId;
      await user.save();

      res.json({
        success: true,
        message: `Subscription upgraded to ${plan}`,
        data: {
          plan: user.subscription.plan,
          startDate: user.subscription.startDate,
          endDate: user.subscription.endDate,
          invoice: payment.invoice,
        },
      });
    } catch (error) {
      console.error('Subscription error:', error);
      res.status(500).json({
        success: false,
        message: 'Subscription upgrade failed',
      });
    }
  }

  // ========== SOCIAL FEATURES ==========
  async socialActions(req, res) {
    try {
      const { action, targetUserId, content } = req.body;
      const userId = req.userId;

      switch (action) {
        case 'addFriend':
          await this.addFriend(userId, targetUserId);
          break;
        case 'acceptFriend':
          await this.acceptFriend(userId, targetUserId);
          break;
        case 'sendMessage':
          await this.sendMessage(userId, targetUserId, content);
          break;
        case 'likePost':
          await this.likePost(userId, targetUserId);
          break;
        default:
          return res.status(400).json({
            success: false,
            message: 'Invalid social action',
          });
      }

      res.json({
        success: true,
        message: `Action ${action} completed successfully`,
      });
    } catch (error) {
      console.error('Social action error:', error);
      res.status(500).json({
        success: false,
        message: 'Social action failed',
      });
    }
  }

  // ========== HELPER METHODS ==========
  async getRecentActivity(userId) {
    const key = `engagement:${userId}`;
    const data = await this.redis?.lrange(key, 0, 10) || [];
    return data.map(JSON.parse);
  }

  calculateExamCountdown(examDate) {
    if (!examDate) return null;
    const days = Math.ceil((new Date(examDate) - new Date()) / (1000 * 60 * 60 * 24));
    return {
      days: Math.max(0, days),
      message: days > 0 ? `${days} days remaining` : 'Exam day! Good luck! 🎉',
    };
  }

  async processPayment(user, plan, paymentMethod) {
    // Integrate with Stripe/Razorpay
    return {
      customerId: 'cus_' + Math.random().toString(36).substr(2, 9),
      invoice: 'inv_' + Math.random().toString(36).substr(2, 9),
    };
  }

  async addFriend(userId, targetUserId) {
    const user = await User.findById(userId);
    const target = await User.findById(targetUserId);
    
    if (!target) throw new Error('User not found');
    
    user.social.friendRequests.push({ from: targetUserId, status: 'pending' });
    await user.save();
  }

  async acceptFriend(userId, targetUserId) {
    const user = await User.findById(userId);
    const target = await User.findById(targetUserId);
    
    if (!target) throw new Error('User not found');
    
    // Accept friend request
    const request = user.social.friendRequests.find(r => 
      r.from.toString() === targetUserId.toString()
    );
    if (request) {
      request.status = 'accepted';
      user.social.friends.push(targetUserId);
      target.social.friends.push(userId);
      await user.save();
      await target.save();
    }
  }

  async sendMessage(userId, targetUserId, content) {
    // Use chat service
    const ChatService = require('../services/chat.service');
    await ChatService.sendMessage(userId, targetUserId, content);
  }

  async likePost(userId, postId) {
    // Implement post liking
  }

  async searchCourses(query, userId) {
    // Implement search
    return [];
  }

  async searchNotes(query, userId) {
    // Implement search
    return [];
  }

  async searchQBank(query) {
    // Implement search
    return [];
  }

  async searchFlashcards(query, userId) {
    // Implement search
    return [];
  }

  async searchCommunity(query) {
    // Implement search
    return [];
  }

  rankSearchResults(results) {
    const all = [
      ...results.courses.map(r => ({ ...r, type: 'course' })),
      ...results.notes.map(r => ({ ...r, type: 'note' })),
      ...results.qbank.map(r => ({ ...r, type: 'qbank' })),
      ...results.flashcards.map(r => ({ ...r, type: 'flashcard' })),
      ...results.community.map(r => ({ ...r, type: 'community' })),
    ];
    
    // Rank by relevance score
    return all.sort((a, b) => (b.relevance || 0) - (a.relevance || 0));
  }
}

module.exports = new UnifiedController();
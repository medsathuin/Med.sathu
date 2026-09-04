const User = require('../models/User');
const Note = require('../models/Note');
const SecurityLog = require('../models/SecurityLog');
const EncryptionService = require('./encryption.service');

class DataPrivacyService {
  
  // ========== REQUEST DATA EXPORT ==========
  async requestDataExport(userId) {
    // Collect all user data
    const user = await User.findById(userId);
    const notes = await Note.find({ user: userId });
    const logs = await SecurityLog.find({ user: userId });

    const exportData = {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        subscription: user.subscription,
      },
      notes: notes.map(n => ({
        title: n.title,
        content: n.content,
        tags: n.tags,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
      })),
      logs: logs.map(l => ({
        action: l.action,
        resourceType: l.resourceType,
        createdAt: l.createdAt,
        details: l.details,
      })),
      exportDate: new Date().toISOString(),
    };

    // Encrypt the export
    const encrypted = await EncryptionService.encrypt(
      userId,
      exportData,
      'export'
    );

    // Log the export
    await SecurityLog.create({
      user: userId,
      action: 'data_export',
      resourceType: 'user',
      details: {
        metadata: {
          exportDate: new Date().toISOString(),
          format: 'encrypted_json',
        },
      },
      severity: 'info',
    });

    return encrypted;
  }

  // ========== ANONYMIZE DATA ==========
  async anonymizeUser(userId) {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    // Replace personal information
    user.name = 'Anonymized User';
    user.email = `anonymized_${userId}@medsathu.inn`;
    user.social.profilePicture = null;
    user.social.bio = null;
    user.social.university = null;
    user.social.userId = `ANON_${Math.random().toString(36).substring(2, 10)}`;
    
    // Clear sensitive data
    user.password = 'ANONYMIZED';
    user.security.twoFactorSecret = null;
    user.security.deviceFingerprints = [];
    user.security.ipHistory = [];

    await user.save();

    // Log anonymization
    await SecurityLog.create({
      user: userId,
      action: 'admin_action',
      resourceType: 'user',
      details: { metadata: { action: 'anonymize_user' } },
      severity: 'info',
    });

    return user;
  }

  // ========== RIGHT TO BE FORGOTTEN ==========
  async deleteUserData(userId) {
    // Delete all user data
    await User.findByIdAndDelete(userId);
    await Note.deleteMany({ user: userId });
    await SecurityLog.deleteMany({ user: userId });

    // Log deletion (even though user is deleted, this log remains for compliance)
    await SecurityLog.create({
      action: 'admin_action',
      resourceType: 'user',
      details: { metadata: { action: 'right_to_be_forgotten', userId } },
      severity: 'critical',
    });

    return { success: true, message: 'All user data deleted as per GDPR compliance' };
  }
}

module.exports = new DataPrivacyService();
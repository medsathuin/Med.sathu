const crypto = require('crypto');
const EncryptionKey = require('../models/EncryptionKey');
const SecurityLog = require('../models/SecurityLog');

class EncryptionService {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.saltLength = 32;
    this.ivLength = 16;
    this.tagLength = 16;
  }

  // ========== GENERATE MASTER KEY ==========
  async generateMasterKey(userId, password) {
    const salt = crypto.randomBytes(this.saltLength);
    const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');

    // Encrypt the key with the derived key
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv(this.algorithm, key, iv);
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify({ master: key.toString('hex') }), 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    const masterKey = new EncryptionKey({
      user: userId,
      masterKey: JSON.stringify({
        encrypted: encrypted.toString('base64'),
        iv: iv.toString('base64'),
        tag: tag.toString('base64'),
        salt: salt.toString('base64'),
      }),
      keyVersion: 1,
    });

    await masterKey.save();
    return masterKey;
  }

  // ========== DERIVE USER KEY ==========
  async deriveUserKey(userId, password) {
    const keyDoc = await EncryptionKey.findOne({ user: userId });
    if (!keyDoc) throw new Error('No encryption key found for user');

    const data = JSON.parse(keyDoc.masterKey);
    const salt = Buffer.from(data.salt, 'base64');
    const derivedKey = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');

    return derivedKey;
  }

  // ========== ENCRYPT DATA ==========
  async encrypt(userId, data, resourceType = 'notes') {
    try {
      const keyDoc = await EncryptionKey.findOne({ user: userId });
      if (!keyDoc) throw new Error('No encryption key found');

      // Use resource-specific key or fallback to master
      let resourceKey = keyDoc.keys[resourceType];
      if (!resourceKey) {
        // Generate resource-specific key
        resourceKey = crypto.randomBytes(32).toString('hex');
        keyDoc.keys[resourceType] = resourceKey;
        await keyDoc.save();
      }

      const key = Buffer.from(resourceKey, 'hex');
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipheriv(this.algorithm, key, iv);

      const encrypted = Buffer.concat([
        cipher.update(JSON.stringify(data), 'utf8'),
        cipher.final(),
      ]);
      const tag = cipher.getAuthTag();

      // Log encryption action
      await SecurityLog.create({
        user: userId,
        action: 'content_edit',
        resourceType: resourceType.charAt(0).toUpperCase() + resourceType.slice(1),
        details: { metadata: { encrypted: true, type: resourceType } },
        severity: 'info',
      });

      return {
        encrypted: encrypted.toString('base64'),
        iv: iv.toString('base64'),
        tag: tag.toString('base64'),
        keyVersion: keyDoc.keyVersion,
      };
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Encryption failed');
    }
  }

  // ========== DECRYPT DATA ==========
  async decrypt(userId, encryptedData, resourceType = 'notes') {
    try {
      const keyDoc = await EncryptionKey.findOne({ user: userId });
      if (!keyDoc) throw new Error('No encryption key found');

      let resourceKey = keyDoc.keys[resourceType];
      if (!resourceKey) {
        // If no key exists, this data wasn't encrypted with a resource-specific key
        // Try to derive from master (legacy support)
        resourceKey = keyDoc.masterKey; // Fallback
      }

      const key = Buffer.from(resourceKey, 'hex');
      const iv = Buffer.from(encryptedData.iv, 'base64');
      const encrypted = Buffer.from(encryptedData.encrypted, 'base64');
      const tag = Buffer.from(encryptedData.tag, 'base64');

      const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
      decipher.setAuthTag(tag);

      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]);

      return JSON.parse(decrypted.toString('utf8'));
    } catch (error) {
      console.error('Decryption error:', error);
      
      // Log suspicious decryption attempt
      await SecurityLog.create({
        user: userId,
        action: 'suspicious_activity',
        resourceType: resourceType.charAt(0).toUpperCase() + resourceType.slice(1),
        details: { metadata: { error: 'Decryption failed', type: resourceType } },
        severity: 'warning',
        isSuspicious: true,
      });

      throw new Error('Decryption failed');
    }
  }

  // ========== ROTATE KEY ==========
  async rotateKey(userId, resourceType = 'all') {
    const keyDoc = await EncryptionKey.findOne({ user: userId });
    if (!keyDoc) throw new Error('No encryption key found');

    if (resourceType === 'all') {
      // Rotate all keys
      const types = ['notes', 'lectures', 'syllabus', 'messages'];
      for (const type of types) {
        keyDoc.keys[type] = crypto.randomBytes(32).toString('hex');
      }
    } else {
      keyDoc.keys[resourceType] = crypto.randomBytes(32).toString('hex');
    }

    keyDoc.keyVersion += 1;
    keyDoc.lastRotation = new Date();
    await keyDoc.save();

    // Log key rotation
    await SecurityLog.create({
      user: userId,
      action: 'admin_action',
      resourceType: 'system',
      details: { metadata: { action: 'key_rotation', type: resourceType } },
      severity: 'info',
    });

    return keyDoc;
  }

  // ========== SECURE HASH (for passwords, tokens) ==========
  secureHash(data) {
    return crypto.createHash('sha512').update(data).digest('hex');
  }

  // ========== GENERATE SECURE TOKEN ==========
  generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  // ========== ENCRYPT FILE ==========
  async encryptFile(userId, fileBuffer, fileName) {
    const key = crypto.randomBytes(32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

    const encrypted = Buffer.concat([cipher.update(fileBuffer), cipher.final()]);
    const tag = cipher.getAuthTag();

    // Store key separately (e.g., in vault)
    return {
      encrypted: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      key: key.toString('base64'),
      fileName,
    };
  }
}

module.exports = new EncryptionService();
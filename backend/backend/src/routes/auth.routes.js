const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const User = require('../models/User');
const { body, validationResult } = require('express-validator');

// ============================================
// 📝 REGISTER
// ============================================
router.post('/register', [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { name, email, password, role = 'student', university, year } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const twoFactorSecret = speakeasy.generateSecret({
      name: process.env.TFA_APP_NAME || 'Medsathu.inn'
    });

    const user = new User({
      name,
      email,
      password: hashedPassword,
      role,
      security: {
        twoFactorSecret: twoFactorSecret.base32,
        twoFactorEnabled: false
      },
      social: { university: university || '', year: year || '' }
    });

    await user.save();

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '15m' }
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully! 🎉',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        userId: user.social.userId,
        subscription: user.subscription.plan,
        freeLecturesRemaining: user.getRemainingFreeLectures()
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ============================================
// 🔑 LOGIN
// ============================================
router.post('/login', [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, password, twoFactorCode } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (user.security.isLocked) {
      return res.status(403).json({ success: false, message: 'Account locked. Contact support.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      user.security.loginAttempts += 1;
      if (user.security.loginAttempts >= 5) {
        user.security.isLocked = true;
        await user.save();
        return res.status(403).json({ success: false, message: 'Account locked. Too many failed attempts.' });
      }
      await user.save();
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials',
        attemptsRemaining: 5 - user.security.loginAttempts
      });
    }

    if (user.security.twoFactorEnabled) {
      if (!twoFactorCode) {
        return res.status(403).json({ 
          success: false, 
          message: '2FA required',
          twoFactorRequired: true 
        });
      }

      const verified = speakeasy.totp.verify({
        secret: user.security.twoFactorSecret,
        encoding: 'ascii',
        token: twoFactorCode,
        window: 1
      });

      if (!verified) {
        return res.status(401).json({ success: false, message: 'Invalid 2FA code' });
      }
    }

    user.security.loginAttempts = 0;
    user.security.lastLogin = new Date();
    await user.save();

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '15m' }
    );

    res.json({
      success: true,
      message: 'Login successful! 🎉',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        userId: user.social.userId,
        university: user.social.university,
        subscription: user.subscription.plan,
        isSubscribed: user.subscription.plan !== 'free',
        freeLecturesRemaining: user.getRemainingFreeLectures()
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ============================================
// 👤 GET CURRENT USER
// ============================================
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password -security.twoFactorSecret');
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        userId: user.social.userId,
        university: user.social.university,
        year: user.social.year,
        bio: user.social.bio,
        profilePicture: user.social.profilePicture,
        subscription: {
          plan: user.subscription.plan,
          isSubscribed: user.subscription.plan !== 'free',
          freeLecturesUsed: user.subscription.freeLecturesUsed,
          freeLimit: user.subscription.freeLimit,
          freeRemaining: user.getRemainingFreeLectures()
        },
        twoFactorEnabled: user.security.twoFactorEnabled
      }
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
});

module.exports = router;
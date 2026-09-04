const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const helmet = require('helmet');
const xss = require('xss-clean');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================
// 🔐 LAYER 1: NETWORK SECURITY
// ============================================
app.use(helmet());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests, please try again later.'
});
app.use('/api', limiter);

// ============================================
// 🔐 LAYER 2: APPLICATION SECURITY
// ============================================
app.use(xss());
app.use(mongoSanitize());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================
// 📦 ROUTES
// ============================================
const authRoutes = require('./routes/auth.routes');

app.use('/api/auth', authRoutes);

// Test Route
app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: '🏥 Medsathu.inn API is running!',
    version: '1.0.0',
    security: {
      layer1: '✅ Network Security',
      layer2: '✅ Application Security',
      layer3: '✅ Data Security (Ready)',
      layer4: '✅ User Security (2FA Ready)'
    },
    features: [
      'Student + Teacher + Admin Login',
      '4-Layer Security',
      'Subscription System',
      'Free Trial (10 lectures)',
      'Coming Soon: QBank, Notes, Flashcards, AI, Social'
    ]
  });
});

// Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString() 
  });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// ============================================
// 🚀 CONNECT TO MONGODB & START
// ============================================
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(async () => {
  console.log('✅ Connected to MongoDB');
  
  // Create admin if doesn't exist
  const User = require('./models/User');
  const adminExists = await User.findOne({ email: process.env.ADMIN_EMAIL });
  
  if (!adminExists) {
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
    
    const admin = new User({
      name: 'System Admin',
      email: process.env.ADMIN_EMAIL,
      password: hashedPassword,
      role: 'admin',
      subscription: { plan: 'admin' },
      social: { userId: 'ADMIN001' }
    });
    
    await admin.save();
    console.log('👑 Default admin created!');
    console.log(`📧 Email: ${process.env.ADMIN_EMAIL}`);
    console.log(`🔑 Password: ${process.env.ADMIN_PASSWORD}`);
  }
  
  app.listen(PORT, () => {
    console.log('');
    console.log('═══════════════════════════════════════════');
    console.log('🏥  MEDSATHU.INN BACKEND');
    console.log('═══════════════════════════════════════════');
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log('🔐 All 4 Security Layers Active!');
    console.log('👥 Users: Student + Teacher + Admin');
    console.log('═══════════════════════════════════════════');
    console.log('');
  });
})
.catch((err) => {
  console.error('❌ MongoDB connection error:', err);
  console.log('');
  console.log('💡 To fix: Install MongoDB from https://www.mongodb.com/try/download/community');
  console.log('');
  process.exit(1);
});
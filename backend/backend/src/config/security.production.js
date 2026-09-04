module.exports = {
  // ========== CORS ==========
  cors: {
    origin: [
      'https://medsathu.inn',
      'https://www.medsathu.inn',
      'https://api.medsathu.inn',
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    maxAge: 86400, // 24 hours
  },

  // ========== RATE LIMITING ==========
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // per IP
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
  },

  // ========== HELMET (Security Headers) ==========
  helmet: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://cdn.razorpay.com',
          'https://checkout.razorpay.com',
          'https://js.stripe.com',
        ],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https://api.razorpay.com', 'https://api.stripe.com'],
        fontSrc: ["'self'", 'data:'],
        frameSrc: ['https://checkout.razorpay.com', 'https://js.stripe.com'],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    frameguard: { action: 'deny' },
    noSniff: true,
    xssFilter: true,
  },

  // ========== SESSION ==========
  session: {
    secret: process.env.JWT_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: true,
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  },

  // ========== DATABASE ==========
  database: {
    ssl: true,
    sslValidate: true,
    retryWrites: true,
    w: 'majority',
    readPreference: 'secondaryPreferred',
    poolSize: 10,
  },

  // ========== LOGGING ==========
  logging: {
    level: 'info',
    format: 'json',
    destinations: ['console', 'file', 'cloudwatch'],
    file: {
      path: '/var/log/medsathu/app.log',
      maxSize: '100m',
      maxFiles: '7d',
    },
    cloudwatch: {
      logGroupName: '/medsathu/production',
      logStreamName: 'backend',
      region: 'ap-south-1',
    },
  },

  // ========== MONITORING ==========
  monitoring: {
    enabled: true,
    interval: 60000, // 1 minute
    alerts: {
      cpu: 80, // 80% threshold
      memory: 85, // 85% threshold
      errorRate: 5, // 5% error rate
      responseTime: 1000, // 1 second
    },
  },

  // ========== ENCRYPTION ==========
  encryption: {
    algorithm: 'aes-256-gcm',
    keyLength: 32,
    saltRounds: 12,
    digest: 'sha512',
  },
};
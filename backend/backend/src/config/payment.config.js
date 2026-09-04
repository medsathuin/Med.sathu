module.exports = {
  // ========== BANK ACCOUNT (YOUR DETAILS) ==========
  bank: {
    accountHolder: 'RATHOD SATHYAPAL',
    accountNumber: '43511162951',
    ifsc: 'SBIN0011084',
    bankName: 'State Bank of India',
    accountType: 'Savings',
    upiId: '6304927871-3@axl',
  },

  // ========== BUSINESS DETAILS ==========
  business: {
    name: 'Medsathu.inn',
    email: 'rathodsathunayak@gmail.com',
    phone: '+91-6304927871', // Derived from UPI ID
    website: 'https://medsathu.inn',
  },

  // ========== SUBSCRIPTION PLANS ==========
  plans: {
    monthly: {
      id: 'monthly',
      name: 'Monthly',
      price: 499,
      currency: 'INR',
      duration: 30, // days
      features: [
        'Unlimited Lectures',
        'Full 20K+ QBank',
        'AI Tutor',
        'Flashcards (Anki-style)',
        'Offline Download',
        'Live Doubt Sessions',
      ],
    },
    yearly: {
      id: 'yearly',
      name: 'Yearly',
      price: 4999,
      currency: 'INR',
      duration: 365,
      features: [
        'Everything in Monthly',
        'Advanced Analytics',
        'Priority Support',
        'Exclusive Webinars',
        'Certificate of Completion',
        'Save ₹989/year',
      ],
    },
    premium: {
      id: 'premium',
      name: 'Premium',
      price: 12999,
      currency: 'INR',
      duration: 365,
      features: [
        'Everything in Yearly',
        '1-on-1 Mentoring',
        'Personalized Study Plan',
        'Mock Test Series',
        'Career Guidance',
        'Lifetime Access to Materials',
        'Priority Doubt Resolution',
      ],
    },
  },

  // ========== FREE TRIAL ==========
  freeTrial: {
    enabled: true,
    lectures: 10,
    duration: 7, // days
  },

  // ========== PAYMENT GATEWAYS ==========
  gateways: {
    razorpay: {
      enabled: true,
      keyId: process.env.RAZORPAY_KEY_ID,
      keySecret: process.env.RAZORPAY_KEY_SECRET,
      webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
    },
    stripe: {
      enabled: true,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
      secretKey: process.env.STRIPE_SECRET_KEY,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    },
    payu: {
      enabled: true,
      merchantKey: process.env.PAYU_MERCHANT_KEY,
      merchantSalt: process.env.PAYU_MERCHANT_SALT,
    },
    phonepay: {
      enabled: true,
      merchantId: process.env.PHONEPAY_MERCHANT_ID,
      saltKey: process.env.PHONEPAY_SALT_KEY,
      saltIndex: process.env.PHONEPAY_SALT_INDEX,
    },
  },

  // ========== PAYMENT METHODS ==========
  paymentMethods: {
    upi: {
      enabled: true,
      providers: ['gpay', 'phonepay', 'paytm', 'bhim', 'axl'],
    },
    cards: {
      enabled: true,
      types: ['visa', 'mastercard', 'rupay', 'amex'],
    },
    netbanking: {
      enabled: true,
    },
    wallets: {
      enabled: true,
      providers: ['paytm', 'amazonpay', 'phonepe'],
    },
    paypal: {
      enabled: true,
      clientId: process.env.PAYPAL_CLIENT_ID,
      secret: process.env.PAYPAL_SECRET,
    },
  },

  // ========== RECEIPT SETTINGS ==========
  receipt: {
    from: {
      name: 'Medsathu.inn',
      email: 'rathodsathunayak@gmail.com',
    },
    logo: 'https://medsathu.inn/logo.png',
    footer: 'Thank you for choosing Medsathu.inn - Your Medical Learning Partner',
  },

  // ========== WEBHOOK SETTINGS ==========
  webhook: {
    retryAttempts: 3,
    retryDelay: 5000, // 5 seconds
  },
};
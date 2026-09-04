const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

  // Plan details
  plan: {
    type: String,
    enum: ['monthly', 'yearly', 'premium'],
    required: true,
  },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'INR' },

  // Payment gateway
  gateway: {
    type: String,
    enum: ['razorpay', 'stripe', 'payu', 'phonepay', 'cashfree'],
    required: true,
  },

  // Gateway IDs
  gatewayOrderId: String,
  gatewayPaymentId: String,
  gatewaySignature: String,

  // Status
  status: {
    type: String,
    enum: ['pending', 'processing', 'success', 'failed', 'refunded', 'cancelled'],
    default: 'pending',
  },

  // Payment method used
  paymentMethod: {
    type: String,
    enum: ['upi', 'card', 'netbanking', 'wallet', 'paypal', 'other'],
  },

  // UPI details (if UPI payment)
  upi: {
    vpa: String,
    transactionId: String,
  },

  // Card details (masked)
  card: {
    last4: String,
    brand: String,
    expiryMonth: String,
    expiryYear: String,
  },

  // Bank account details (for netbanking)
  bank: {
    name: String,
    ifsc: String,
    accountNumber: String,
  },

  // Subscription details
  subscription: {
    startDate: Date,
    endDate: Date,
    isActive: { type: Boolean, default: false },
  },

  // Invoice
  invoice: {
    number: String,
    url: String,
    pdf: String,
  },

  // Receipt
  receipt: {
    sent: { type: Boolean, default: false },
    sentAt: Date,
    email: String,
  },

  // Refund
  refund: {
    status: { type: String, enum: ['none', 'requested', 'processed', 'completed'] },
    amount: Number,
    reason: String,
    processedAt: Date,
    transactionId: String,
  },

  // Webhook data (raw)
  webhookData: { type: mongoose.Schema.Types.Mixed },

  // Metadata
  metadata: { type: mongoose.Schema.Types.Mixed },

  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Indexes
TransactionSchema.index({ user: 1, createdAt: -1 });
TransactionSchema.index({ gatewayOrderId: 1 });
TransactionSchema.index({ status: 1 });
TransactionSchema.index({ 'subscription.endDate': 1 });

// ========== PRE-SAVE ==========
TransactionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  if (!this.invoice.number) {
    this.invoice.number = `INV-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  }
  next();
});

// ========== METHOD: Generate invoice PDF ==========
TransactionSchema.methods.generateInvoice = async function() {
  // In production, use PDF generation library (pdfkit, puppeteer)
  const invoiceData = {
    number: this.invoice.number,
    date: this.createdAt,
    customer: {
      name: this.user.name,
      email: this.user.email,
    },
    items: [{
      description: `${this.plan.charAt(0).toUpperCase() + this.plan.slice(1)} Subscription`,
      amount: this.amount,
    }],
    total: this.amount,
    tax: 0,
    currency: this.currency,
  };

  // Generate PDF URL (placeholder)
  this.invoice.url = `https://api.medsathu.inn/invoices/${this.invoice.number}`;
  return invoiceData;
};

// ========== STATIC: Get user transactions ==========
TransactionSchema.statics.getUserTransactions = async function(userId, limit = 50) {
  return this.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(limit);
};

// ========== STATIC: Get revenue stats ==========
TransactionSchema.statics.getRevenueStats = async function() {
  const stats = await this.aggregate([
    { $match: { status: 'success' } },
    {
      $group: {
        _id: {
          plan: '$plan',
          month: { $month: '$createdAt' },
          year: { $year: '$createdAt' },
        },
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
    { $sort: { '_id.year': -1, '_id.month': -1 } },
  ]);
  return stats;
};

module.exports = mongoose.model('Transaction', TransactionSchema);
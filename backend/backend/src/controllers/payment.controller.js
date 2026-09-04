const PaymentService = require('../services/payment.service');
const Transaction = require('../models/Transaction');
const User = require('../models/User');

// ========== GET PAYMENT CONFIG ==========
exports.getConfig = async (req, res) => {
  try {
    const config = PaymentService.getFrontendConfig();
    res.json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== CREATE ORDER ==========
exports.createOrder = async (req, res) => {
  try {
    const { plan, gateway = 'razorpay', paymentMethod = 'upi' } = req.body;
    
    if (!plan || !['monthly', 'yearly', 'premium'].includes(plan)) {
      return res.status(400).json({ success: false, message: 'Invalid plan' });
    }

    const result = await PaymentService.createOrder(req.userId, plan, gateway, paymentMethod);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== VERIFY PAYMENT ==========
exports.verifyPayment = async (req, res) => {
  try {
    const { orderId, paymentId, signature } = req.body;

    if (!orderId || !paymentId) {
      return res.status(400).json({ success: false, message: 'Missing payment details' });
    }

    const result = await PaymentService.verifyPayment(orderId, paymentId, signature);
    
    if (result.success) {
      res.json({ success: true, data: result.transaction });
    } else {
      res.status(400).json({ success: false, message: 'Payment verification failed' });
    }
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== GET TRANSACTION HISTORY ==========
exports.getTransactions = async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const transactions = await PaymentService.getTransactionHistory(req.userId, parseInt(limit));
    res.json({ success: true, data: transactions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== GET SUBSCRIPTION STATUS ==========
exports.getSubscriptionStatus = async (req, res) => {
  try {
    const status = await PaymentService.checkSubscription(req.userId);
    res.json({ success: true, data: status });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== CANCEL SUBSCRIPTION ==========
exports.cancelSubscription = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.subscription.plan = 'free';
    user.subscription.endDate = null;
    user.subscription.autoRenew = false;
    await user.save();

    res.json({ success: true, message: 'Subscription cancelled successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== PROCESS REFUND (Admin) ==========
exports.processRefund = async (req, res) => {
  try {
    const { transactionId, reason } = req.body;
    const result = await PaymentService.processRefund(transactionId, reason);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== WEBHOOK HANDLER ==========
exports.webhookHandler = async (req, res) => {
  try {
    const { gateway } = req.params;
    const payload = req.body;
    const signature = req.headers['x-razorpay-signature'] || req.headers['stripe-signature'];

    // Process webhook based on gateway
    let transaction = null;
    switch (gateway) {
      case 'razorpay':
        transaction = await handleRazorpayWebhook(payload, signature);
        break;
      case 'stripe':
        transaction = await handleStripeWebhook(payload, signature);
        break;
      default:
        return res.status(400).json({ success: false, message: 'Invalid gateway' });
    }

    if (transaction) {
      res.json({ success: true, data: transaction });
    } else {
      res.status(400).json({ success: false, message: 'Webhook processing failed' });
    }
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== RAZORPAY WEBHOOK HANDLER ==========
async function handleRazorpayWebhook(payload, signature) {
  // Verify signature
  const crypto = require('crypto');
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(JSON.stringify(payload))
    .digest('hex');

  if (signature !== expectedSignature) {
    throw new Error('Invalid webhook signature');
  }

  const { event, payload: data } = payload;
  const { order, payment } = data;

  if (event === 'payment.captured') {
    const transaction = await Transaction.findOne({ gatewayOrderId: order.id });
    if (transaction && transaction.status === 'pending') {
      await PaymentService.completePayment(transaction, payment.id);
      return transaction;
    }
  }

  return null;
}

// ========== STRIPE WEBHOOK HANDLER ==========
async function handleStripeWebhook(payload, signature) {
  // Stripe webhook verification
  const Stripe = require('stripe');
  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  
  let event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    throw new Error('Invalid webhook signature');
  }

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    const transaction = await Transaction.findOne({ gatewayOrderId: paymentIntent.id });
    if (transaction && transaction.status === 'pending') {
      await PaymentService.completePayment(transaction, paymentIntent.id);
      return transaction;
    }
  }

  return null;
}
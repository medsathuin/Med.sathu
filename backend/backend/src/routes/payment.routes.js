const express = require('express');
const router = express.Router();
const { auth, roleCheck } = require('../middleware/auth');
const paymentController = require('../controllers/payment.controller');

// ========== PUBLIC ROUTES ==========
router.get('/config', paymentController.getConfig);

// ========== PROTECTED ROUTES ==========
router.post('/create-order', auth, paymentController.createOrder);
router.post('/verify', auth, paymentController.verifyPayment);
router.get('/transactions', auth, paymentController.getTransactions);
router.get('/subscription', auth, paymentController.getSubscriptionStatus);
router.post('/cancel-subscription', auth, paymentController.cancelSubscription);

// ========== ADMIN ROUTES ==========
router.post('/refund', auth, roleCheck('admin'), paymentController.processRefund);
router.get('/admin/revenue', auth, roleCheck('admin'), async (req, res) => {
  try {
    const stats = await PaymentService.getRevenueStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========== WEBHOOK ROUTES (Public) ==========
router.post('/webhook/:gateway', paymentController.webhookHandler);

module.exports = router;
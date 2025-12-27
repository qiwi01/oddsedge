const express = require('express');
const axios = require('axios');
const VIPPayment = require('../models/VIPPayment');
const User = require('../models/User');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Initialize Paystack payment
router.post('/initialize-payment', authenticateToken, async (req, res) => {
  try {
    const { email } = req.user;
    const { plan } = req.body;

    // Set amount based on plan
    const amount = plan === 'yearly' ? 50000 : 5000; // 50k yearly, 5k monthly in Naira

    // Generate unique reference
    const reference = `VIP_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const paystackPayload = {
      email,
      amount: amount * 100, // Convert to kobo
      reference,
      callback_url: `${process.env.FRONTEND_URL || 'http://localhost:5175'}/vip/success`,
      metadata: {
        user_id: req.user.id,
        type: 'vip_subscription',
        plan: plan || 'monthly'
      }
    };

    const paystackResponse = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      paystackPayload,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // Save payment record
    const vipPayment = new VIPPayment({
      user: req.user.id,
      amount,
      reference,
      paystackReference: paystackResponse.data.data.reference
    });

    await vipPayment.save();

    res.json({
      success: true,
      data: paystackResponse.data.data
    });
  } catch (error) {
    console.error('Paystack payment initialization error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initialize payment'
    });
  }
});

// Verify payment (webhook)
router.post('/verify-payment', async (req, res) => {
  try {
    const { reference } = req.body;

    // Verify with Paystack
    const paystackResponse = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
        }
      }
    );

    const { status, metadata } = paystackResponse.data.data;

    if (status === 'success') {
      // Update payment status
      await VIPPayment.findOneAndUpdate(
        { paystackReference: reference },
        {
          status: 'completed',
          paymentDate: new Date()
        }
      );

      // TODO: Send notification to admin
      // For now, we'll mark as completed and admin can confirm later
    }

    res.json({ success: true, status });
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Verification failed'
    });
  }
});

// Get VIP status
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('isVIP vipExpiry');
    res.json({
      isVIP: user.isVIP,
      vipExpiry: user.vipExpiry
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get VIP status' });
  }
});

// Admin: Confirm VIP payment
router.put('/confirm-payment/:paymentId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const payment = await VIPPayment.findById(req.params.paymentId).populate('user');

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    if (payment.status !== 'completed') {
      return res.status(400).json({ error: 'Payment not completed' });
    }

    // Update user VIP status based on plan
    const vipExpiry = new Date();
    if (payment.paystackReference.includes('yearly') || payment.amount === 50000) {
      vipExpiry.setFullYear(vipExpiry.getFullYear() + 1); // 1 year VIP
    } else {
      vipExpiry.setMonth(vipExpiry.getMonth() + 1); // 1 month VIP
    }

    await User.findByIdAndUpdate(payment.user._id, {
      isVIP: true,
      vipExpiry
    });

    // Update payment record
    payment.confirmedBy = req.user.id;
    payment.confirmedAt = new Date();
    await payment.save();

    res.json({ success: true, message: 'VIP status confirmed' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to confirm VIP payment' });
  }
});

// Admin: Get pending VIP payments
router.get('/pending-payments', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const payments = await VIPPayment.find({ status: 'completed', confirmedBy: null })
      .populate('user', 'username email')
      .sort({ paymentDate: -1 });

    res.json(payments);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get pending payments' });
  }
});

// Admin: Toggle user VIP status
router.put('/toggle-vip/:userId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.isVIP = !user.isVIP;

    if (user.isVIP) {
      user.vipExpiry = new Date();
      user.vipExpiry.setFullYear(user.vipExpiry.getFullYear() + 1);
    } else {
      user.vipExpiry = null;
    }

    await user.save();

    res.json({
      success: true,
      isVIP: user.isVIP,
      vipExpiry: user.vipExpiry
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle VIP status' });
  }
});

module.exports = router;

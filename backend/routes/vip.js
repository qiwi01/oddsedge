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

// Bet Converter - VIP Only
router.post('/convert-booking-code', authenticateToken, async (req, res) => {
  try {
    // Check if user is VIP
    const user = await User.findById(req.user.id).select('isVIP vipExpiry');
    if (!user.isVIP || (user.vipExpiry && user.vipExpiry < new Date())) {
      return res.status(403).json({
        success: false,
        error: 'VIP access required for bet converter'
      });
    }

    const { fromBookmaker, toBookmaker, bookingCode } = req.body;

    if (!fromBookmaker || !toBookmaker || !bookingCode) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: fromBookmaker, toBookmaker, bookingCode'
      });
    }

    // Simple bet code conversion logic
    // This is a basic implementation - in production you'd want more comprehensive mapping
    const convertedCode = await convertBettingCode(fromBookmaker, toBookmaker, bookingCode);

    if (!convertedCode) {
      return res.status(400).json({
        success: false,
        error: 'Unable to convert booking code. Please check the code format.'
      });
    }

    res.json({
      success: true,
      data: {
        originalCode: bookingCode,
        fromBookmaker,
        toBookmaker,
        convertedCode,
        convertedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Bet converter error:', error);
    res.status(500).json({
      success: false,
      error: 'Bet conversion failed'
    });
  }
});

// Get available bookmakers for conversion
router.get('/bookmakers', authenticateToken, async (req, res) => {
  try {
    // Check if user is VIP
    const user = await User.findById(req.user.id).select('isVIP vipExpiry');
    if (!user.isVIP || (user.vipExpiry && user.vipExpiry < new Date())) {
      return res.status(403).json({
        success: false,
        error: 'VIP access required'
      });
    }

    const bookmakers = [
      { id: 'bet9ja', name: 'Bet9ja', country: 'Nigeria' },
      { id: 'sportybet', name: 'SportyBet', country: 'Nigeria' },
      { id: 'betking', name: 'BetKing', country: 'Nigeria' },
      { id: 'nairabet', name: 'NairaBet', country: 'Nigeria' },
      { id: 'merrybet', name: 'MerryBet', country: 'Nigeria' },
      { id: 'bet365', name: 'Bet365', country: 'International' },
      { id: '1xbet', name: '1xBet', country: 'International' },
      { id: 'betway', name: 'Betway', country: 'International' },
      { id: 'pinnacle', name: 'Pinnacle', country: 'International' }
    ];

    res.json({
      success: true,
      data: bookmakers
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get bookmakers'
    });
  }
});

module.exports = router;

// Helper function for bet code conversion
async function convertBettingCode(fromBookmaker, toBookmaker, code) {
  // This is a simplified conversion logic
  // In a real implementation, you'd have comprehensive mapping tables
  // or integrate with third-party conversion services

  const conversionMap = {
    'bet9ja': {
      'sportybet': (code) => {
        // Example conversion logic - replace specific patterns
        return code.replace(/B9J/g, 'SB').replace(/^9/, 'S');
      },
      'betking': (code) => {
        return code.replace(/B9J/g, 'BK').replace(/^9/, 'K');
      },
      'bet365': (code) => {
        // Convert to Bet365 format (typically longer alphanumeric)
        return 'B365' + code.substring(1);
      }
    },
    'sportybet': {
      'bet9ja': (code) => {
        return code.replace(/SB/g, 'B9J').replace(/^S/, '9');
      },
      'betking': (code) => {
        return code.replace(/SB/g, 'BK').replace(/^S/, 'K');
      },
      'bet365': (code) => {
        return 'B365' + code.substring(1);
      }
    },
    'betking': {
      'bet9ja': (code) => {
        return code.replace(/BK/g, 'B9J').replace(/^K/, '9');
      },
      'sportybet': (code) => {
        return code.replace(/BK/g, 'SB').replace(/^K/, 'S');
      },
      'bet365': (code) => {
        return 'B365' + code.substring(1);
      }
    },
    'bet365': {
      'bet9ja': (code) => {
        if (code.startsWith('B365')) {
          return '9' + code.substring(4);
        }
        return code;
      },
      'sportybet': (code) => {
        if (code.startsWith('B365')) {
          return 'S' + code.substring(4);
        }
        return code;
      },
      'betking': (code) => {
        if (code.startsWith('B365')) {
          return 'K' + code.substring(4);
        }
        return code;
      }
    }
  };

  // Normalize bookmaker names
  const from = fromBookmaker.toLowerCase();
  const to = toBookmaker.toLowerCase();

  if (conversionMap[from] && conversionMap[from][to]) {
    return conversionMap[from][to](code);
  }

  // If no specific conversion exists, return original code with a note
  return code + '_CONVERTED';
}

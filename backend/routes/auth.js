const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Register route
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Check if this is the first user (make them admin)
    const userCount = await User.countDocuments();
    const isFirstUser = userCount === 0;

    // Create user
    const user = new User({
      username,
      email,
      password: hashedPassword,
      favoriteTeams: [],
      bets: [],
      role: isFirstUser ? 'admin' : 'user' // First user becomes admin
    });

    await user.save();

    // Create token
    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        username,
        email,
        favoriteTeams: []
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login route
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Create token
    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email,
        favoriteTeams: user.favoriteTeams,
        role: user.role
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Profile route
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// User favorites routes
router.post('/user/favorites', authenticateToken, async (req, res) => {
  try {
    const { teamName } = req.body;
    const user = await User.findById(req.user.id);

    if (!user.favoriteTeams.includes(teamName)) {
      user.favoriteTeams.push(teamName);
      await user.save();
    }

    res.json({ favoriteTeams: user.favoriteTeams });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/user/favorites/:teamName', authenticateToken, async (req, res) => {
  try {
    const { teamName } = req.params;
    const user = await User.findById(req.user.id);

    user.favoriteTeams = user.favoriteTeams.filter(team => team !== teamName);
    await user.save();

    res.json({ favoriteTeams: user.favoriteTeams });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Import configurations and models
const connectDB = require('./config/database');

// Import routes
const authRoutes = require('./routes/auth');
const matchRoutes = require('./routes/matches');
const adminRoutes = require('./routes/admin');
const outcomeRoutes = require('./routes/outcomes');
const vipRoutes = require('./routes/vip');
const leagueRoutes = require('./routes/leagues');

const app = express();

// Connect to database
connectDB();

// Middleware
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, or curl requests)
    if (!origin) return callback(null, true);

    const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
      ? process.env.CORS_ALLOWED_ORIGINS.split(',')
      : ['https://oddsedge-nine.vercel.app', 'https://oddsedge-5ohb.onrender.com', 'http://localhost:5173', 'http://localhost:3000'];

    // Always allow localhost in development
    if (origin && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
      return callback(null, true);
    }

    // Allow common mobile browser origins and subdomains
    if (origin && (
      origin.includes('oddsedge-nine.vercel.app') ||
      origin.includes('oddsedge-5ohb.onrender.com') ||
      origin.includes('vercel.app') ||
      origin.includes('onrender.com')
    )) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      console.log(`CORS blocked origin: ${origin}`);
      console.log(`Allowed origins: ${allowedOrigins.join(', ')}`);
      // In production, allow the request but log the warning
      if (process.env.NODE_ENV === 'production') {
        console.log(`Allowing request from unknown origin in production: ${origin}`);
        return callback(null, true);
      }
      return callback(new Error(`CORS policy violation: ${origin} not allowed`));
    }
  },
  credentials: true
}));
app.use(express.json());

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/outcomes', outcomeRoutes);
app.use('/api/vip', vipRoutes);
app.use('/api/leagues', leagueRoutes);

// Legacy routes for backward compatibility
app.use('/api', authRoutes);
app.use('/api', matchRoutes);
app.use('/api', adminRoutes);
app.use('/api', outcomeRoutes);
app.use('/api', vipRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Frontend: http://localhost:3000`);
  console.log(`🔧 API: http://localhost:${PORT}/api`);
});

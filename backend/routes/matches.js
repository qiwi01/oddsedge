const express = require('express');
const axios = require('axios');
const { generatePrediction, generateMockOdds, isValueBet, calculateMatchProbabilities } = require('../utils/predictions');
const Match = require('../models/Match');
const User = require('../models/User');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Mock data for development
const mockFixtures = [
  {
    id: 1001,
    utcDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    homeTeam: { id: 33, name: "Manchester United" },
    awayTeam: { id: 34, name: "Liverpool" },
    competition: { id: 8, name: "Premier League" }
  },
  {
    id: 1002,
    utcDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    homeTeam: { id: 35, name: "Chelsea" },
    awayTeam: { id: 36, name: "Arsenal" },
    competition: { id: 8, name: "Premier League" }
  },
  {
    id: 1003,
    utcDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    homeTeam: { id: 37, name: "Manchester City" },
    awayTeam: { id: 38, name: "Tottenham" },
    competition: { id: 8, name: "Premier League" }
  },
  {
    id: 1004,
    utcDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
    homeTeam: { id: 39, name: "Newcastle" },
    awayTeam: { id: 40, name: "Brighton" },
    competition: { id: 8, name: "Premier League" }
  }
];

// Fetch admin-created matches only (filter VIP games for non-VIP users and only matches with predictions)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const isVIP = user && user.isVIP;

    // Build query - exclude VIP games for non-VIP users AND only include matches with predictions
    const query = {
      ...(!isVIP && { isVIP: { $ne: true } }),
      predictions: { $exists: true, $ne: [], $not: { $size: 0 } } // Only matches with predictions
    };

    const matches = await Match.find(query)
      .sort({ date: 1 })
      .select('homeTeam awayTeam date league predictions bookmakerOdds isVIP');

    // Transform to match the expected frontend format
    const formattedMatches = matches.map(match => ({
      id: match._id,
      utcDate: match.date.toISOString(),
      homeTeam: {
        name: match.homeTeam
      },
      awayTeam: {
        name: match.awayTeam
      },
      competition: {
        name: match.league
      },
      predictions: match.predictions || [],
      bookmakerOdds: match.bookmakerOdds,
      isVIP: match.isVIP
    }));

    res.json(formattedMatches);
  } catch (err) {
    console.error('Error fetching matches:', err);
    res.status(500).json({ error: err.message });
  }
});

// Add new match (admin only)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { homeTeam, awayTeam, league, date, time, predictions, odds } = req.body;

    // Validation
    if (!homeTeam || !awayTeam || !league || !date || !time) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!predictions || !Array.isArray(predictions) || predictions.length === 0) {
      return res.status(400).json({ error: 'At least one prediction is required' });
    }

    // Combine date and time
    const matchDate = new Date(`${date}T${time}`);
    if (isNaN(matchDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date or time format' });
    }

    // Process predictions array
    let processedPredictions = [];
    if (predictions && predictions.length > 0) {
      for (const pred of predictions) {
        // Validate prediction
        if (!pred.type || !['win', 'over15', 'over25', 'over35', 'corners', 'ggng', 'others', 'player'].includes(pred.type)) {
          return res.status(400).json({ error: `Invalid prediction type: ${pred.type}` });
        }
        if (!pred.prediction || typeof pred.prediction !== 'string') {
          return res.status(400).json({ error: 'Prediction text is required' });
        }
        if (typeof pred.confidence !== 'number' || pred.confidence < 0 || pred.confidence > 100) {
          return res.status(400).json({ error: 'Confidence must be a number between 0 and 100' });
        }

        // Generate probabilities for value bet calculation if needed
        let probabilities = null;
        if (pred.type === 'win' && !pred.probabilities) {
          const homeStrength = Math.random() * 40 + 30;
          const awayStrength = Math.random() * 40 + 30;
          probabilities = calculateMatchProbabilities(homeStrength, awayStrength);
        }

        // Determine if it's a value bet
        let valueBetFlag = pred.valueBet || false;
        if (!pred.valueBet && probabilities && pred.type === 'win') {
          const bookmakerOdds = generateMockOdds();
          valueBetFlag = isValueBet(pred.prediction, bookmakerOdds, probabilities);
        }

        processedPredictions.push({
          type: pred.type,
          prediction: pred.prediction,
          confidence: pred.confidence,
          valueBet: valueBetFlag,
          odds: pred.odds || {}
        });
      }
    }

    const bookmakerOdds = generateMockOdds();

    const newMatch = new Match({
      homeTeam,
      awayTeam,
      date: matchDate,
      league,
      odds: odds || { home: 2.0, draw: 3.0, away: 2.0 },
      bookmakerOdds,
      predictions: processedPredictions,
      homeStrength: Math.round(Math.random() * 40 + 30),
      awayStrength: Math.round(Math.random() * 40 + 30)
    });

    await newMatch.save();

    res.status(201).json({
      message: 'Match added successfully',
      match: {
        id: newMatch._id,
        homeTeam: newMatch.homeTeam,
        awayTeam: newMatch.awayTeam,
        date: newMatch.date,
        league: newMatch.league,
        predictions: newMatch.predictions,
        bookmakerOdds: newMatch.bookmakerOdds
      }
    });
  } catch (err) {
    console.error('Error adding match:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get admin-created matches (for recent games display)
router.get('/admin', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const matches = await Match.find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .select('homeTeam awayTeam date league predictions bookmakerOdds isVIP homeGoals awayGoals outcomes');

    res.json(matches.map(match => ({
      id: match._id,
      homeTeam: { name: match.homeTeam },
      awayTeam: { name: match.awayTeam },
      utcDate: match.date.toISOString(),
      competition: { name: match.league },
      predictions: match.predictions || [],
      bookmakerOdds: match.bookmakerOdds,
      isVIP: match.isVIP,
      homeGoals: match.homeGoals,
      awayGoals: match.awayGoals,
      outcomes: match.outcomes || []
    })));
  } catch (err) {
    console.error('Error fetching admin matches:', err);
    res.status(500).json({ error: err.message });
  }
});

// Edit match (admin only)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { homeTeam, awayTeam, league, date, time, predictions, odds, isVIP } = req.body;

    // Validation
    if (!homeTeam || !awayTeam || !league || !date || !time) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Combine date and time
    const matchDate = new Date(`${date}T${time}`);
    if (isNaN(matchDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date or time format' });
    }

    const updateData = {
      homeTeam,
      awayTeam,
      league,
      date: matchDate,
      isVIP: isVIP || false
    };

    // Update predictions if provided
    if (predictions && Array.isArray(predictions)) {
      updateData.predictions = predictions;
    }

    // Update odds if provided
    if (odds) {
      updateData.odds = odds;
      updateData.bookmakerOdds = generateMockOdds();
    }

    const match = await Match.findByIdAndUpdate(req.params.id, updateData, { new: true });

    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    res.json({
      message: 'Match updated successfully',
      match: {
        id: match._id,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        date: match.date,
        league: match.league,
        predictions: match.predictions,
        bookmakerOdds: match.bookmakerOdds,
        isVIP: match.isVIP
      }
    });
  } catch (err) {
    console.error('Error updating match:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete match (admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const match = await Match.findByIdAndDelete(req.params.id);

    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    res.json({
      message: 'Match deleted successfully',
      match: {
        id: match._id,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam
      }
    });
  } catch (err) {
    console.error('Error deleting match:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

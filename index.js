/**
 * FMFO Sports — Backend Server
 * Commentator Analytics Control Room
 * By FMFO Technologies Inc. (For My Fans Only)
 *
 * Tier-based routing:
 *   Free       → Haiku, 5/month, pre-game only
 *   Creator    → Sonnet, 50/month, full modes
 *   Pro        → Sonnet, unlimited, all features
 *   Enterprise → Opus, unlimited, API + white-label
 */

try { require('dotenv').config(); } catch (e) {}
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { initDB, db } = require('./db');
const { streamAnalysis, generateContent, playerAnalysis, h2hAnalysis, generatePrep } = require('./ai');
const { fetchScores, fetchStandings } = require('./sports');
const { TIERS, getTier, checkUsage, hasFeature, hasMode, estimateCost } = require('./tiers');

const app = express();
const PORT = process.env.PORT || 3000;

// --------------- MIDDLEWARE ---------------
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(__dirname));

// Global rate limiter
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
}));

// Tier middleware — attaches tier info to every request
app.use((req, res, next) => {
  const userId = req.headers['x-user-id'] || req.query.userId || 'default';
  req.userId = userId;
  req.tier = getTier(userId);
  next();
});

// --------------- TIER INFO ---------------

/** GET /api/tier — returns the user's current tier and feature access */
app.get('/api/tier', (req, res) => {
  const usage = checkUsage(db(), req.userId, req.tier);
  res.json({
    tier: req.tier.name,
    label: req.tier.label,
    badge: req.tier.badge,
    color: req.tier.color,
    price: req.tier.price || 'Free',
    model: req.tier.model,
    features: req.tier.features,
    usage,
    costPerAnalysis: estimateCost(req.tier),
  });
});

/** GET /api/tiers — returns all available tiers for pricing page */
app.get('/api/tiers', (req, res) => {
  const tiers = Object.entries(TIERS).map(([key, t]) => ({
    id: key,
    name: t.name,
    price: t.price || 'Free',
    label: t.label,
    badge: t.badge,
    color: t.color,
    monthlyLimit: t.monthlyLimit,
    model: t.model,
    features: t.features,
    costPerAnalysis: estimateCost(t),
  }));
  res.json(tiers);
});

// --------------- FEATURE GATE MIDDLEWARE ---------------
function requireFeature(feature) {
  return (req, res, next) => {
    if (!hasFeature(req.tier, feature)) {
      return res.status(403).json({
        error: 'upgrade_required',
        message: `${feature} requires a ${getMinTierForFeature(feature)} plan or higher.`,
        currentTier: req.tier.name,
        requiredFeature: feature,
        upgradePath: getUpgradePath(req.tier.name),
      });
    }
    next();
  };
}

function requireUsage() {
  return (req, res, next) => {
    const usage = checkUsage(db(), req.userId, req.tier);
    if (!usage.allowed) {
      return res.status(429).json({
        error: 'limit_reached',
        message: `You've used all ${usage.limit} analyses this month. Upgrade for more.`,
        currentTier: req.tier.name,
        used: usage.used,
        limit: usage.limit,
        upgradePath: getUpgradePath(req.tier.name),
      });
    }
    req.usage = usage;
    next();
  };
}

function getMinTierForFeature(feature) {
  for (const [, t] of Object.entries(TIERS)) {
    if (hasFeature(t, feature)) return t.name;
  }
  return 'Enterprise';
}

function getUpgradePath(current) {
  const order = ['free', 'creator', 'pro', 'enterprise'];
  const idx = order.indexOf(current.toLowerCase());
  if (idx < order.length - 1) {
    const next = TIERS[order[idx + 1]];
    return { tier: next.name, price: next.price, badge: next.badge };
  }
  return null;
}

// --------------- AI ANALYSIS ---------------

app.post('/api/analyze', requireUsage(), async (req, res) => {
  const { query, sport, mode, team } = req.body;
  if (!query || !sport || !mode) {
    return res.status(400).json({ error: 'query, sport, and mode are required' });
  }

  // Check mode access
  if (!hasMode(req.tier, mode)) {
    return res.status(403).json({
      error: 'mode_locked',
      message: `${mode} mode requires a Creator plan or higher.`,
      availableModes: req.tier.features.modes,
      upgradePath: getUpgradePath(req.tier.name),
    });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Send tier info first
  res.write(`data: ${JSON.stringify({ tier: req.tier.name, model: req.tier.model, badge: req.tier.badge })}\n\n`);

  try {
    await streamAnalysis({ query, sport, mode, team }, (chunk) => {
      res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
    }, req.tier);
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('Analysis error:', err.message);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

// --------------- FEATURE-GATED ROUTES ---------------

app.post('/api/content', requireFeature('content'), async (req, res) => {
  const { analysis, query } = req.body;
  if (!analysis) return res.status(400).json({ error: 'analysis required' });
  try {
    const content = await generateContent(analysis, query, req.tier);
    res.json({ content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/player', requireFeature('player'), requireUsage(), async (req, res) => {
  const { name, type, sport } = req.body;
  if (!name || !sport) return res.status(400).json({ error: 'name and sport required' });
  try {
    const result = await playerAnalysis(name, type || 'full', sport, req.tier);
    res.json({ result, model: req.tier.model });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/h2h', requireFeature('h2h'), requireUsage(), async (req, res) => {
  const { teamA, teamB, type, sport } = req.body;
  if (!teamA || !teamB || !sport) return res.status(400).json({ error: 'teamA, teamB, sport required' });
  try {
    const result = await h2hAnalysis(teamA, teamB, type || 'full', sport, req.tier);
    res.json({ result, model: req.tier.model });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/prep', requireFeature('prep'), requireUsage(), async (req, res) => {
  const { matchup, sport } = req.body;
  if (!matchup || !sport) return res.status(400).json({ error: 'matchup and sport required' });
  try {
    const result = await generatePrep(matchup, sport, req.tier);
    res.json({ result, model: req.tier.model });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --------------- SCORES ---------------

app.get('/api/scores/:league', async (req, res) => {
  const { league } = req.params;
  const valid = ['nfl', 'nba', 'mlb', 'nhl', 'epl'];
  if (!valid.includes(league)) return res.status(400).json({ error: 'Invalid league' });
  try {
    const cached = db().prepare(
      'SELECT data, updated_at FROM scores WHERE league = ? AND updated_at > datetime("now", "-5 minutes")'
    ).get(league);
    if (cached) return res.json(JSON.parse(cached.data));
    const scores = await fetchScores(league);
    db().prepare('INSERT OR REPLACE INTO scores (league, data, updated_at) VALUES (?, ?, datetime("now"))').run(league, JSON.stringify(scores));
    res.json(scores);
  } catch (err) {
    const stale = db().prepare('SELECT data FROM scores WHERE league = ?').get(league);
    if (stale) return res.json({ ...JSON.parse(stale.data), stale: true });
    res.status(500).json({ error: 'Failed to fetch scores' });
  }
});

app.get('/api/standings/:league', async (req, res) => {
  const { league } = req.params;
  try {
    const cached = db().prepare(
      'SELECT data FROM standings WHERE league = ? AND updated_at > datetime("now", "-1 hour")'
    ).get(league);
    if (cached) return res.json(JSON.parse(cached.data));
    const standings = await fetchStandings(league);
    db().prepare('INSERT OR REPLACE INTO standings (league, data, updated_at) VALUES (?, ?, datetime("now"))').run(league, JSON.stringify(standings));
    res.json(standings);
  } catch (err) {
    const stale = db().prepare('SELECT data FROM standings WHERE league = ?').get(league);
    if (stale) return res.json(JSON.parse(stale.data));
    res.status(500).json({ error: 'Failed' });
  }
});

// --------------- PREDICTIONS ---------------

app.post('/api/predictions', requireFeature('predictions'), (req, res) => {
  const { pick, sport, team } = req.body;
  if (!pick || !sport) return res.status(400).json({ error: 'pick and sport required' });
  const result = db().prepare(
    'INSERT INTO predictions (user_id, pick, sport, team, result, created_at) VALUES (?, ?, ?, ?, "pending", datetime("now"))'
  ).run(req.userId, pick, sport, team || null);
  res.json({ id: result.lastInsertRowid });
});

app.patch('/api/predictions/:id', requireFeature('predictions'), (req, res) => {
  const { result } = req.body;
  if (!['win', 'loss'].includes(result)) return res.status(400).json({ error: 'result must be win or loss' });
  db().prepare('UPDATE predictions SET result = ? WHERE id = ? AND user_id = ?').run(result, req.params.id, req.userId);
  res.json({ ok: true });
});

app.get('/api/predictions', (req, res) => {
  const rows = db().prepare('SELECT * FROM predictions WHERE user_id = ? ORDER BY created_at DESC LIMIT 200').all(req.userId);
  res.json(rows);
});

app.delete('/api/predictions/:id', (req, res) => {
  db().prepare('DELETE FROM predictions WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  res.json({ ok: true });
});

// --------------- ANALYSES ---------------

app.post('/api/analyses', (req, res) => {
  const { query, sport, team, tab, output } = req.body;
  const result = db().prepare(
    'INSERT INTO analyses (user_id, query, sport, team, tab, output, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime("now"))'
  ).run(req.userId, query, sport, team || null, tab || '', output || '');
  res.json({ id: result.lastInsertRowid });
});

app.get('/api/analyses', (req, res) => {
  const rows = db().prepare('SELECT * FROM analyses WHERE user_id = ? ORDER BY created_at DESC LIMIT 100').all(req.userId);
  res.json(rows);
});

app.delete('/api/analyses/:id', (req, res) => {
  db().prepare('DELETE FROM analyses WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  res.json({ ok: true });
});

// --------------- LEADERBOARD ---------------

app.get('/api/leaderboard', (req, res) => {
  const rows = db().prepare(`
    SELECT user_id,
      SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) as wins,
      SUM(CASE WHEN result = 'loss' THEN 1 ELSE 0 END) as losses,
      COUNT(*) as total,
      ROUND(CAST(SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) AS FLOAT) /
        NULLIF(SUM(CASE WHEN result IN ('win','loss') THEN 1 ELSE 0 END), 0) * 100) as pct
    FROM predictions GROUP BY user_id HAVING (wins + losses) > 0
    ORDER BY pct DESC LIMIT 50
  `).all();
  res.json(rows);
});

// --------------- HEALTH ---------------

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok', version: '2.0.0',
    ai: !!process.env.ANTHROPIC_API_KEY,
    tiers: Object.keys(TIERS),
    uptime: process.uptime(),
  });
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// --------------- START ---------------
initDB();

if (process.env.NODE_ENV !== 'production' || require.main === module) {
  app.listen(PORT, () => {
    console.log(`FMFO Sports server running on port ${PORT}`);
  });
}

module.exports = app;

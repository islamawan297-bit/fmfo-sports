/**
 * FMFO Sports — Subscription Tier System
 * Routes users to different AI models and rate limits based on their plan.
 *
 * Free     → Haiku (cheapest)    — limited features, 5 analyses/month
 * Creator  → Sonnet (balanced)   — full features, 50 analyses/month
 * Pro      → Sonnet (balanced)   — unlimited + premium features
 * Enterprise → Opus (best)       — everything + API access
 */

const TIERS = {
  free: {
    name: 'Free',
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 1024,
    monthlyLimit: 5,
    features: {
      analyze: true,
      modes: ['pre'],               // Pre-game only
      predictions: false,
      parlay: false,
      h2h: false,
      player: false,
      trending: false,
      prep: false,
      content: false,
      leaderboard: true,            // Can view, not compete
      watchlist: 1,                  // 1 team max
      scores: true,
    },
    label: 'Free',
    color: '#9999b0',
    badge: '🆓',
  },

  creator: {
    name: 'Creator',
    price: '$9.99/mo',
    model: 'claude-sonnet-4-6',
    maxTokens: 2048,
    monthlyLimit: 50,
    features: {
      analyze: true,
      modes: ['pre', 'live', 'post', 'pred'],  // All modes
      predictions: true,
      parlay: false,
      h2h: true,
      player: true,
      trending: true,
      prep: false,
      content: true,
      leaderboard: true,
      watchlist: 5,
      scores: true,
    },
    label: 'Creator',
    color: '#00e87b',
    badge: '⚡',
  },

  pro: {
    name: 'Pro',
    price: '$24.99/mo',
    model: 'claude-sonnet-4-6',
    maxTokens: 3000,
    monthlyLimit: -1,              // Unlimited
    features: {
      analyze: true,
      modes: ['pre', 'live', 'post', 'pred'],
      predictions: true,
      parlay: true,
      h2h: true,
      player: true,
      trending: true,
      prep: true,
      content: true,
      leaderboard: true,
      watchlist: 20,
      scores: true,
    },
    label: 'Pro',
    color: '#a855f7',
    badge: '🔮',
  },

  enterprise: {
    name: 'Enterprise',
    price: '$99.99/mo',
    model: 'claude-opus-4-6',     // Best model
    maxTokens: 4096,
    monthlyLimit: -1,
    features: {
      analyze: true,
      modes: ['pre', 'live', 'post', 'pred'],
      predictions: true,
      parlay: true,
      h2h: true,
      player: true,
      trending: true,
      prep: true,
      content: true,
      leaderboard: true,
      watchlist: -1,               // Unlimited
      scores: true,
      apiAccess: true,             // Direct API access
      whiteLabel: true,            // Remove FMFO branding
      teamDashboard: true,         // Multi-user team view
    },
    label: 'Enterprise',
    color: '#c5a028',
    badge: '👑',
  },
};

/**
 * Get tier config for a user
 * In production, look up the user's subscription in your payment system
 */
function getTier(userId) {
  // TODO: Replace with real lookup from your payment/subscription system
  // Example: query your database or Stripe for the user's active subscription
  //
  // const subscription = db.prepare('SELECT tier FROM users WHERE id = ?').get(userId);
  // return TIERS[subscription?.tier] || TIERS.free;

  return TIERS[process.env.DEFAULT_TIER || 'pro'];
}

/**
 * Check if user has remaining analyses this month
 */
function checkUsage(db, userId, tier) {
  if (tier.monthlyLimit === -1) return { allowed: true, remaining: -1, used: 0 };

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const row = db.prepare(`
    SELECT COUNT(*) as count FROM analyses
    WHERE user_id = ? AND created_at >= ?
  `).get(userId, startOfMonth.toISOString());

  const used = row?.count || 0;
  const remaining = tier.monthlyLimit - used;

  return {
    allowed: remaining > 0,
    remaining,
    used,
    limit: tier.monthlyLimit,
  };
}

/**
 * Check if a specific feature is available for this tier
 */
function hasFeature(tier, feature) {
  return tier.features[feature] === true || tier.features[feature] > 0 || tier.features[feature] === -1;
}

/**
 * Check if an analysis mode is available
 */
function hasMode(tier, mode) {
  const modeMap = {
    'Pre-Game Intel': 'pre',
    'Live Analysis': 'live',
    'Post-Game Review': 'post',
    'Predictions': 'pred',
  };
  const modeKey = modeMap[mode] || mode;
  return tier.features.modes.includes(modeKey);
}

/**
 * Estimate the cost of a single analysis for this tier
 */
function estimateCost(tier) {
  const costs = {
    'claude-haiku-4-5-20251001': { input: 1.00, output: 5.00 },
    'claude-sonnet-4-6': { input: 3.00, output: 15.00 },
    'claude-opus-4-6': { input: 5.00, output: 25.00 },
  };
  const rate = costs[tier.model] || costs['claude-sonnet-4-6'];
  // Average analysis: ~2000 input tokens, ~1500 output tokens
  const inputCost = (2000 / 1_000_000) * rate.input;
  const outputCost = (1500 / 1_000_000) * rate.output;
  return +(inputCost + outputCost).toFixed(4);
}

module.exports = { TIERS, getTier, checkUsage, hasFeature, hasMode, estimateCost };

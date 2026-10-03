/**
 * FMFO Sports — AI Engine
 * Anthropic Claude API with tier-based model routing
 *
 * Free     → Haiku   ($0.01/analysis)
 * Creator  → Sonnet  ($0.03/analysis)
 * Pro      → Sonnet  ($0.03/analysis, higher token limit)
 * Enterprise → Opus  ($0.05/analysis, best quality)
 */

const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SPORTS_MAP = {
  nfl: 'NFL Football', nba: 'NBA Basketball', mlb: 'MLB Baseball',
  nhl: 'NHL Hockey', soccer: 'Soccer / Football',
  mma: 'MMA / Combat Sports', boxing: 'Boxing',
};

const MODE_FOCUS = {
  'Pre-Game Intel': 'Focus: matchups, trends, storylines, key stats for on-air reference.',
  'Live Analysis': 'Focus: real-time momentum, in-game adjustments, what to watch next.',
  'Post-Game Review': 'Focus: narrative recap — what happened, why, and what it means.',
  'Predictions': `Focus: PREDICTIONS — bold, data-backed predictions.
- Each prediction: pick, confidence %, 2-3 data points, one risk factor.
- Be decisive. Include a LOCK OF THE DAY and a SLEEPER PICK.
- Label as entertainment, not gambling advice.`,
};

function buildPrompt({ query, sport, mode, team }) {
  const sportName = SPORTS_MAP[sport] || sport;
  const focus = MODE_FOCUS[mode] || '';
  const ending = mode === 'Predictions'
    ? '🔮 PREDICTION CONFIDENCE SUMMARY: picks with %.\n📌 COMMENTATOR TALKING POINT'
    : '📌 COMMENTATOR TALKING POINT: one punchy angle for on-air use.';

  return `You are the FMFO Sports AI Analyst — the intelligence engine powering the FMFO Sports Commentator Analytics Control Room by FMFO Technologies Inc. (For My Fans Only).

Sport: ${sportName} | Mode: ${mode}${team ? ` | Team: ${team}` : ''} | Date: ${new Date().toLocaleDateString()}

Guidelines:
- Lead with the most impactful insight
- Use specific data, stats, and historical context
- Provide narrative angles for broadcast
- ${focus}

End with: ${ending}

Analyze: ${query}`;
}

/**
 * Stream analysis with tier-based model selection
 * @param {object} params - { query, sport, mode, team }
 * @param {function} onChunk - callback for each text chunk
 * @param {object} tier - tier config from tiers.js
 */
async function streamAnalysis(params, onChunk, tier = null) {
  const model = tier?.model || 'claude-sonnet-4-6';
  const maxTokens = tier?.maxTokens || 2048;
  const prompt = buildPrompt(params);

  const stream = client.messages.stream({
    model,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta?.text) {
      onChunk(event.delta.text);
    }
  }

  return { model, maxTokens };
}

/**
 * Generate fan-facing content
 */
async function generateContent(analysis, query, tier = null) {
  const model = tier?.model || 'claude-sonnet-4-6';
  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `You are the FMFO Sports content writer for formyfansonly.com. Convert this analysis into an engaging fan post. Include key stats, end with "What Are You A Fan Of?" and formyfansonly.com. Under 280 words.\n\n${analysis.substring(0, 3000)}`
    }],
  });
  return response.content[0]?.text || '';
}

/**
 * Player spotlight analysis
 */
async function playerAnalysis(name, type, sport, tier = null) {
  const model = tier?.model || 'claude-sonnet-4-6';
  const maxTokens = tier?.maxTokens || 2048;
  const sportName = SPORTS_MAP[sport] || sport;

  const prompts = {
    full: `Complete player spotlight on ${name} (${sportName}). Current form, key stats, strengths, weaknesses, and broadcast angle.`,
    scouting: `Professional scouting report on ${name} (${sportName}). Physical tools, technique, tendencies, grade.`,
    stats: `Statistical breakdown for ${name} (${sportName}). Key numbers, peer rankings, trends.`,
    narrative: `Story arc for ${name}'s season (${sportName}). Key moments, what's at stake, the storyline.`,
    compare: `Historical comparison for ${name} (${sportName}). Closest past comparison and trajectory.`,
    mvp: `Award case for ${name} (${sportName}). Stats, impact, narrative, vs competitors.`,
  };

  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    messages: [{
      role: 'user',
      content: `FMFO Sports AI Analyst.\n\n${prompts[type] || prompts.full}\n\nEnd with: 📌 COMMENTATOR TALKING POINT`
    }],
  });
  return response.content[0]?.text || '';
}

/**
 * Head-to-head comparison
 */
async function h2hAnalysis(teamA, teamB, type, sport, tier = null) {
  const model = tier?.model || 'claude-sonnet-4-6';
  const sportName = SPORTS_MAP[sport] || sport;

  const prompts = {
    full: `Complete head-to-head: ${teamA} vs ${teamB} (${sportName}). Recent form, matchups, statistical edges, history, verdict.`,
    stats: `Statistical comparison: ${teamA} vs ${teamB} (${sportName}). Key metrics side-by-side.`,
    history: `Historical rivalry: ${teamA} vs ${teamB} (${sportName}). H2H record, memorable matchups, trajectory.`,
    predict: `Predict: ${teamA} vs ${teamB} (${sportName}). Pick with confidence %, predicted score, three reasons, key factor.`,
  };

  const response = await client.messages.create({
    model,
    max_tokens: tier?.maxTokens || 2048,
    messages: [{
      role: 'user',
      content: `FMFO Sports AI Analyst.\n\n${prompts[type] || prompts.full}\n\n📌 COMMENTATOR TALKING POINT`
    }],
  });
  return response.content[0]?.text || '';
}

/**
 * Prep sheet generation (Pro/Enterprise only)
 */
async function generatePrep(matchup, sport, tier = null) {
  const model = tier?.model || 'claude-sonnet-4-6';
  const sportName = SPORTS_MAP[sport] || sport;

  const response = await client.messages.create({
    model,
    max_tokens: tier?.maxTokens || 3000,
    messages: [{
      role: 'user',
      content: `FMFO Sports — Commentator Prep Sheet for: ${matchup} (${sportName})

Sections:
📊 KEY STATS (5-7 stats for the booth)
📖 STORYLINES (3-4 narrative angles)
🔑 MATCHUPS TO WATCH (2-3 deciding matchups)
🎤 TALKING POINTS (5 ready-to-say sentences)
⚠️ WATCH FOR (2-3 in-game situations)
🔮 BOLD PREDICTION (one specific prediction)

Format for print. This goes to the broadcast booth.`
    }],
  });
  return response.content[0]?.text || '';
}

module.exports = { streamAnalysis, generateContent, playerAnalysis, h2hAnalysis, generatePrep };

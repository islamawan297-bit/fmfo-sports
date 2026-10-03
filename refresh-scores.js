#!/usr/bin/env node
/**
 * FMFO Sports — Score Refresh Script
 * Run manually: npm run scores:refresh
 * Or on a cron: */5 * * * * cd /path/to/fmfo-sports && node scripts/refresh-scores.js
 *
 * Fetches latest scores for all leagues and caches in the database.
 */

require('dotenv').config();
const { initDB, db } = require('../server/db');
const { fetchScores, fetchStandings } = require('../server/sports');

const LEAGUES = ['nfl', 'nba', 'mlb', 'nhl', 'epl'];

async function refresh() {
  initDB();
  console.log('🔄 Refreshing scores...\n');

  for (const league of LEAGUES) {
    try {
      const scores = await fetchScores(league);
      db().prepare(
        'INSERT OR REPLACE INTO scores (league, data, updated_at) VALUES (?, ?, datetime("now"))'
      ).run(league, JSON.stringify(scores));
      console.log(`  ✓ ${league.toUpperCase()}: ${scores.games?.length || 0} games`);
    } catch (err) {
      console.log(`  ✗ ${league.toUpperCase()}: ${err.message}`);
    }

    try {
      const standings = await fetchStandings(league);
      db().prepare(
        'INSERT OR REPLACE INTO standings (league, data, updated_at) VALUES (?, ?, datetime("now"))'
      ).run(league, JSON.stringify(standings));
      console.log(`  ✓ ${league.toUpperCase()} standings: ${standings.standings?.length || 0} teams`);
    } catch (err) {
      // Standings not always available
    }
  }

  console.log('\n✅ Done — ' + new Date().toLocaleString());
}

refresh().catch(err => {
  console.error('Refresh failed:', err);
  process.exit(1);
});

/**
 * FMFO Sports — Live Sports Data
 * Fetches scores and standings from ESPN's public API
 * No API key required for basic scores
 *
 * For production, upgrade to:
 * - SportsData.io (paid, comprehensive)
 * - The Odds API (free tier, includes betting lines)
 * - SportRadar (enterprise)
 */

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports';

const LEAGUE_MAP = {
  nfl: { sport: 'football', league: 'nfl' },
  nba: { sport: 'basketball', league: 'nba' },
  mlb: { sport: 'baseball', league: 'mlb' },
  nhl: { sport: 'hockey', league: 'nhl' },
  epl: { sport: 'soccer', league: 'eng.1' },
};

async function fetchScores(league) {
  const config = LEAGUE_MAP[league];
  if (!config) throw new Error(`Unknown league: ${league}`);

  const url = `${ESPN_BASE}/${config.sport}/${config.league}/scoreboard`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`ESPN API returned ${res.status}`);
    const data = await res.json();

    const games = (data.events || []).map(event => {
      const comp = event.competitions?.[0];
      if (!comp) return null;

      const teams = comp.competitors || [];
      const home = teams.find(t => t.homeAway === 'home');
      const away = teams.find(t => t.homeAway === 'away');

      return {
        home: home?.team?.abbreviation || '???',
        away: away?.team?.abbreviation || '???',
        homeName: home?.team?.displayName || '',
        awayName: away?.team?.displayName || '',
        hs: parseInt(home?.score || 0),
        as: parseInt(away?.score || 0),
        status: mapStatus(comp.status?.type?.name),
        statusDetail: comp.status?.type?.shortDetail || '',
        time: event.date,
        note: comp.notes?.[0]?.headline || '',
      };
    }).filter(Boolean);

    return {
      league: league.toUpperCase(),
      games,
      updatedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error(`Failed to fetch ${league} scores:`, err.message);
    throw err;
  }
}

async function fetchStandings(league) {
  const config = LEAGUE_MAP[league];
  if (!config) throw new Error(`Unknown league: ${league}`);

  // ESPN standings endpoint
  const url = `${ESPN_BASE}/${config.sport}/${config.league}/standings`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`ESPN standings returned ${res.status}`);
    const data = await res.json();

    const standings = [];

    for (const group of (data.children || [])) {
      const divName = group.name || '';
      for (const subgroup of (group.children || [group])) {
        const division = subgroup.name || divName;
        for (const entry of (subgroup.standings?.entries || [])) {
          const team = entry.team?.abbreviation || '';
          const stats = {};
          for (const stat of (entry.stats || [])) {
            stats[stat.name] = stat.value;
          }
          standings.push({
            t: team,
            d: division,
            w: stats.wins || 0,
            l: stats.losses || 0,
          });
        }
      }
    }

    return {
      league: league.toUpperCase(),
      standings,
      updatedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error(`Failed to fetch ${league} standings:`, err.message);
    throw err;
  }
}

function mapStatus(espnStatus) {
  const map = {
    STATUS_FINAL: 'final',
    STATUS_IN_PROGRESS: 'live',
    STATUS_SCHEDULED: 'upcoming',
    STATUS_POSTPONED: 'postponed',
  };
  return map[espnStatus] || 'unknown';
}

module.exports = { fetchScores, fetchStandings };

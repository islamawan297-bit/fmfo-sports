# FMFO Sports — Commentator Analytics Control Room

**By FMFO Technologies Inc. (For My Fans Only)**
*"The Intelligence Behind the Commentary"*

AI-powered sports analysis platform for commentators, analysts, and fans.
Part of the FMFO ecosystem at [formyfansonly.com](https://www.formyfansonly.com)

---

## Publish in 5 Minutes

### Option A: Railway (Recommended — Free Tier Available)

1. Push this folder to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Select your repo
4. Add environment variable: `ANTHROPIC_API_KEY` = your key from [console.anthropic.com](https://console.anthropic.com)
5. Railway gives you a live URL — done

### Option B: Render

1. Push to GitHub
2. Go to [render.com](https://render.com) → New Web Service → Connect repo
3. Build command: `npm install`
4. Start command: `node server/index.js`
5. Add env var: `ANTHROPIC_API_KEY`
6. Deploy — live URL in 2 minutes

### Option C: Run Locally

```bash
npm install
cp .env.example .env        # Then add your ANTHROPIC_API_KEY
npm start                    # Opens at http://localhost:3000
```

### Option D: Docker

```bash
docker build -t fmfo-sports .
docker run -d -p 3000:3000 -e ANTHROPIC_API_KEY=sk-ant-xxx fmfo-sports
```

---

## What's Inside — 14 Features

| Feature | What It Does |
|---------|-------------|
| 🏠 Dashboard | Personal home — stats, alerts, watchlist, live ticker, recent activity |
| 📡 Live Scores | Real-time scoreboards for NFL, NBA, MLB, NHL, EPL with auto-refresh |
| ⚡ Analyze | AI analysis engine — 4 modes (Pre-Game, Live, Post-Game, Predictions) × 7 sports |
| 🏟️ Team Hub | Dedicated team dashboards with analysis history, predictions, and watchlist |
| 🔮 Predictions | Log picks, mark W/L, track accuracy %, broken down by sport |
| 🏆 Leaderboard | Prediction accuracy rankings — compete with other analysts |
| 👁️ Watchlist | Track teams, get alerts, generate morning briefings |
| ⚔️ Head-to-Head | Compare any two teams — full breakdown, stats, history, or predict winner |
| 🎯 Player Spotlight | Deep-dive on any athlete — scouting, stats, story arc, comp search, MVP case |
| 🎰 Parlay Builder | Build multi-sport parlays with AI risk analysis and alternative suggestions |
| 🔥 Trending | Today's top 10 storylines + hot take generator with commentator angles |
| 📋 Prep Sheet | Print-ready broadcast prep — stats, storylines, talking points, predictions |
| 📝 Content Creator | Turn any analysis into fan-facing FMFO posts with branding |
| 📚 Library | All saved analyses and session history |

### Sports Covered

🏈 NFL · 🏀 NBA · ⚾ MLB · 🏒 NHL · ⚽ Soccer · 🥊 MMA · 🥋 Boxing

---

## Project Structure

```
fmfo-sports/
├── public/
│   ├── index.html           # Complete frontend app (all 14 features)
│   └── app.js               # API client — connects frontend to backend
├── server/
│   ├── index.js             # Express server — all API routes
│   ├── ai.js                # Anthropic Claude API — streaming analysis
│   ├── db.js                # SQLite database
│   └── sports.js            # ESPN API — live scores
├── scripts/
│   └── refresh-scores.js    # Auto-refresh scores (cron-ready)
├── .env.example             # Config template — copy to .env
├── .gitignore
├── Dockerfile               # One-command containerization
├── package.json
└── README.md
```

---

## How It Works

```
Browser (public/index.html)
    ↓ HTTP requests
Express Server (server/index.js)
    ├── POST /api/analyze     → Anthropic Claude API (streaming)
    ├── POST /api/content     → Anthropic Claude API (content gen)
    ├── GET  /api/scores/:lg  → ESPN free API → SQLite cache
    ├── CRUD /api/predictions → SQLite
    ├── CRUD /api/analyses    → SQLite
    └── GET  /api/leaderboard → SQLite aggregation
```

---

## API Reference

### AI Analysis
| Endpoint | Method | Body | Returns |
|----------|--------|------|---------|
| `/api/analyze` | POST | `{query, sport, mode, team?}` | SSE stream |
| `/api/content` | POST | `{analysis}` | `{content}` |

### Live Data
| Endpoint | Method | Returns |
|----------|--------|---------|
| `/api/scores/:league` | GET | Scores (nfl/nba/mlb/nhl/epl) |
| `/api/standings/:league` | GET | Standings |

### User Data
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/predictions` | GET/POST | List / save predictions |
| `/api/predictions/:id` | PATCH/DELETE | Mark result / delete |
| `/api/analyses` | GET/POST | List / save analyses |
| `/api/analyses/:id` | DELETE | Delete |
| `/api/leaderboard` | GET | Rankings by accuracy |
| `/api/health` | GET | Server status |

---

## Auto-Refresh Scores

Scores cache for 5 minutes automatically. For background refresh:

```bash
# Manual
npm run scores:refresh

# Cron (every 5 min)
crontab -e
*/5 * * * * cd /path/to/fmfo-sports && node scripts/refresh-scores.js
```

---

## Custom Domain

Point `sports.formyfansonly.com` to your server:

**Caddy (easiest):**
```
sports.formyfansonly.com {
    reverse_proxy localhost:3000
}
```

**Nginx:**
```nginx
server {
    server_name sports.formyfansonly.com;
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }
}
```

---

## FMFO Platform Integration

When formyfansonly.com has user accounts:

1. **Auth** — Add JWT middleware, replace `userId` with real tokens
2. **Tiers** — Rate-limit by subscription level:
   - Free: 5 analyses/month, pre-game only
   - Creator ($9.99): 50/month, all modes
   - Pro ($24.99): Unlimited + predictions + parlay + prep sheets
   - Enterprise: API access, white-label
3. **Content Pipeline** — Wire `/api/content` to FMFO Creator Hub
4. **Embed** — `<iframe src="https://sports.formyfansonly.com" style="width:100%;height:100vh;border:none"></iframe>`

---

## Cost at Scale

| Component | Cost |
|-----------|------|
| Anthropic API (10K analyses/month) | ~$300/month |
| ESPN scores | Free |
| Hosting (Railway/Render) | $5–20/month |
| Domain | $12/year |
| **Total** | **~$325/month** |

---

## Tech Stack

- **Frontend:** Vanilla HTML/CSS/JS (zero dependencies, instant load)
- **Backend:** Node.js + Express
- **AI:** Anthropic Claude API (claude-sonnet-4-6)
- **Database:** SQLite (swap for PostgreSQL at scale)
- **Scores:** ESPN public API
- **Deployment:** Railway, Render, Docker, or any Node.js host

---

**FMFO Technologies Inc.**
*"What Are You A Fan Of?"*
[formyfansonly.com](https://www.formyfansonly.com)

/**
 * FMFO Sports — API Client
 * Replaces Claude artifact runtime with HTTP calls to backend
 */
const API = '/api';

const FMFO = {
  /** Stream AI analysis via SSE — returns full text */
  async streamAnalysis({ query, sport, mode, team }, onChunk) {
    const res = await fetch(`${API}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, sport, mode, team }),
    });
    if (res.status === 403 || res.status === 429) {
      const err = await res.json();
      throw err;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const line of decoder.decode(value, { stream: true }).split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const d = line.slice(6);
        if (d === '[DONE]') return fullText;
        try {
          const p = JSON.parse(d);
          if (p.error) throw { message: p.error };
          if (p.text) { fullText += p.text; onChunk(fullText); }
        } catch (e) { if (e.message) throw e; }
      }
    }
    return fullText;
  },

  async post(endpoint, body) {
    const res = await fetch(`${API}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw err; }
    return res.json();
  },

  async get(endpoint) {
    const res = await fetch(`${API}${endpoint}`);
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw err; }
    return res.json();
  },

  async del(endpoint) {
    await fetch(`${API}${endpoint}`, { method: 'DELETE' });
  },

  async patch(endpoint, body) {
    await fetch(`${API}${endpoint}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  },

  // Convenience wrappers
  getScores: (lg) => FMFO.get(`/scores/${lg}`),
  getStandings: (lg) => FMFO.get(`/standings/${lg}`),
  getTier: () => FMFO.get('/tier'),
  getTiers: () => FMFO.get('/tiers'),
  getLeaderboard: () => FMFO.get('/leaderboard'),
  getPredictions: () => FMFO.get('/predictions'),
  savePrediction: (d) => FMFO.post('/predictions', d),
  markPrediction: (id, result) => FMFO.patch(`/predictions/${id}`, { result }),
  deletePrediction: (id) => FMFO.del(`/predictions/${id}`),
  getAnalyses: () => FMFO.get('/analyses'),
  saveAnalysis: (d) => FMFO.post('/analyses', d),
  deleteAnalysis: (id) => FMFO.del(`/analyses/${id}`),
  generateContent: (analysis) => FMFO.post('/content', { analysis }),
  health: () => FMFO.get('/health'),
};

window.FMFO = FMFO;

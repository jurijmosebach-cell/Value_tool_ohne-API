// ---------- Imports & Setup ----------
import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

app.use(express.static(__dirname));

const PORT = process.env.PORT || 10000;
const SOCCERDATA_KEY = process.env.SOCCERDATA_KEY || "";
const FOOTBALL_DATA_KEY = process.env.FOOTBALL_DATA_API_KEY || "";

let cache = { timestamp: 0, data: [] };
const CACHE_DURATION = 15 * 60 * 1000; // 15 Minuten

// ---------- Mathematische Hilfsfunktionen ----------
function factorial(n) {
  if (n <= 1) return 1;
  let f = 1;
  for (let i = 2; i <= n; i++) f *= i;
  return f;
}

function poisson(k, lambda) {
  return Math.pow(lambda, k) * Math.exp(-lambda) / factorial(k);
}

function computeMatchOutcomeProbs(homeLambda, awayLambda, maxGoals = 7) {
  let homeProb = 0, drawProb = 0, awayProb = 0;
  for (let i = 0; i <= maxGoals; i++) {
    const pHome = poisson(i, homeLambda);
    for (let j = 0; j <= maxGoals; j++) {
      const pAway = poisson(j, awayLambda);
      const p = pHome * pAway;
      if (i > j) homeProb += p;
      else if (i === j) drawProb += p;
      else awayProb += p;
    }
  }
  const total = homeProb + drawProb + awayProb;
  return {
    home: +(homeProb / total).toFixed(4),
    draw: +(drawProb / total).toFixed(4),
    away: +(awayProb / total).toFixed(4)
  };
}

function computeOver25Prob(homeLambda, awayLambda, maxGoals = 7) {
  let pLe2 = 0;
  for (let i = 0; i <= 2; i++) {
    const ph = poisson(i, homeLambda);
    for (let j = 0; j <= 2; j++) {
      if (i + j <= 2) pLe2 += ph * poisson(j, awayLambda);
    }
  }
  return +(1 - pLe2).toFixed(4);
}

// ---------- Helper: Trend-Berechnung ----------
function computeTrend(prob, value) {
  const mainVal = Math.max(value.home, value.draw, value.away);
  if (mainVal > 0.12 && prob.home > prob.away && prob.home > prob.draw) return "home";
  if (mainVal > 0.12 && prob.away > prob.home && prob.away > prob.draw) return "away";
  if (Math.abs(prob.home - prob.away) < 0.08 && prob.draw >= Math.max(prob.home, prob.away)) return "draw";
  return "neutral";
}

// ---------- API 1: SoccerData ----------
async function fetchGamesFromSoccerData() {
  if (!SOCCERDATA_KEY) return [];

  try {
    const url = `https://soccerdataapi.com/api/v1/fixtures?api_token=${SOCCERDATA_KEY}&status=SCHEDULED`;
    const res = await fetch(url);
    const data = await res.json();

    const matches = data.data || data.response || data.fixtures || [];
    if (!Array.isArray(matches) || matches.length === 0) return [];

    return matches.map(m => {
      const homeXG = +(0.8 + Math.random() * 1.6).toFixed(2);
      const awayXG = +(0.6 + Math.random() * 1.6).toFixed(2);

      const outcome = computeMatchOutcomeProbs(homeXG, awayXG);
      const over25Prob = computeOver25Prob(homeXG, awayXG);
      const pHomeAtLeast1 = 1 - poisson(0, homeXG);
      const pAwayAtLeast1 = 1 - poisson(0, awayXG);
      const btts = +(pHomeAtLeast1 * pAwayAtLeast1).toFixed(4);

      const odds = {
        home: +(1.6 + Math.random() * 1.6).toFixed(2),
        draw: +(2.0 + Math.random() * 1.5).toFixed(2),
        away: +(1.7 + Math.random() * 1.6).toFixed(2),
        over25: +(1.7 + Math.random() * 0.7).toFixed(2),
        under25: +(1.8 + Math.random() * 0.7).toFixed(2)
      };

      const prob = {
        home: outcome.home,
        draw: outcome.draw,
        away: outcome.away,
        over25: over25Prob,
        under25: +(1 - over25Prob).toFixed(4)
      };

      const value = {
        home: +((prob.home * odds.home) - 1).toFixed(4),
        draw: +((prob.draw * odds.draw) - 1).toFixed(4),
        away: +((prob.away * odds.away) - 1).toFixed(4),
        over25: +((prob.over25 * odds.over25) - 1).toFixed(4),
        under25: +((prob.under25 * odds.under25) - 1).toFixed(4)
      };

      return {
        id: m.id,
        date: m.date || m.fixture_date || m.match_date || "",
        league: m.league_name || m.league?.name || "Unbekannt",
        home: m.home_team_name || m.home?.name || "Home",
        away: m.away_team_name || m.away?.name || "Away",
        homeXG, awayXG, odds, prob, value, btts,
        trend: computeTrend(prob, value)
      };
    });
  } catch (err) {
    console.error("❌ Fehler SoccerData:", err.message);
    return [];
  }
}

// ---------- API 2: Football-Data (Fallback) ----------
const LEAGUE_IDS = {
  "Premier League": "PL",
  "Bundesliga": "BL1",
  "La Liga": "PD",
  "Serie A": "SA",
  "Ligue 1": "FL1"
};

async function fetchGamesFromFootballData() {
  if (!FOOTBALL_DATA_KEY) return [];
  const headers = { "X-Auth-Token": FOOTBALL_DATA_KEY };
  const allGames = [];

  for (const [leagueName, id] of Object.entries(LEAGUE_IDS)) {
    try {
      const url = `https://api.football-data.org/v4/competitions/${id}/matches?status=SCHEDULED`;
      const res = await fetch(url, { headers });
      if (!res.ok) continue;
      const data = await res.json();
      if (!data.matches) continue;

      data.matches.forEach(m => {
        const homeXG = +(0.8 + Math.random() * 1.6).toFixed(2);
        const awayXG = +(0.6 + Math.random() * 1.6).toFixed(2);

        const outcome = computeMatchOutcomeProbs(homeXG, awayXG);
        const over25Prob = computeOver25Prob(homeXG, awayXG);
        const pHomeAtLeast1 = 1 - poisson(0, homeXG);
        const pAwayAtLeast1 = 1 - poisson(0, awayXG);
        const btts = +(pHomeAtLeast1 * pAwayAtLeast1).toFixed(4);

        const odds = {
          home: +(1.6 + Math.random() * 1.6).toFixed(2),
          draw: +(2.0 + Math.random() * 1.5).toFixed(2),
          away: +(1.7 + Math.random() * 1.6).toFixed(2),
          over25: +(1.7 + Math.random() * 0.7).toFixed(2),
          under25: +(1.8 + Math.random() * 0.7).toFixed(2)
        };

        const prob = {
          home: outcome.home,
          draw: outcome.draw,
          away: outcome.away,
          over25: over25Prob,
          under25: +(1 - over25Prob).toFixed(4)
        };

        const value = {
          home: +((prob.home * odds.home) - 1).toFixed(4),
          draw: +((prob.draw * odds.draw) - 1).toFixed(4),
          away: +((prob.away * odds.away) - 1).toFixed(4),
          over25: +((prob.over25 * odds.over25) - 1).toFixed(4),
          under25: +((prob.under25 * odds.under25) - 1).toFixed(4)
        };

        allGames.push({
          id: m.id,
          date: m.utcDate,
          league: leagueName,
          home: m.homeTeam?.name || "Home",
          away: m.awayTeam?.name || "Away",
          homeXG, awayXG, odds, prob, value, btts,
          trend: computeTrend(prob, value)
        });
      });
    } catch (err) {
      console.error(`⚠️ Fehler ${leagueName}:`, err.message);
    }
  }

  return allGames;
}

// ---------- API Endpoint ----------
app.get("/api/games", async (req, res) => {
  try {
    const now = Date.now();
    if (!cache.data.length || now - cache.timestamp > CACHE_DURATION) {
      console.log("♻️ Lade Spiele von SoccerData...");
      let games = await fetchGamesFromSoccerData();

      if (!games.length) {
        console.log("⚠️ SoccerData leer, nutze Football-Data Fallback...");
        games = await fetchGamesFromFootballData();
      }

      cache = { timestamp: now, data: games };
    }

    let filtered = cache.data.slice();
    if (req.query.date) filtered = filtered.filter(g => g.date.startsWith(req.query.date));

    const top7Value = filtered.slice().sort((a, b) =>
      Math.max(b.value.home, b.value.draw, b.value.away) -
      Math.max(a.value.home, a.value.draw, a.value.away)
    ).slice(0, 7);

    const top5Over25 = filtered.slice().sort((a, b) => b.value.over25 - a.value.over25).slice(0, 5);

    res.json({ response: filtered, top7Value, top5Over25 });
  } catch (err) {
    console.error("❌ Fehler /api/games:", err.message);
    res.status(500).json({ response: [], error: err.message });
  }
});

// ---------- Frontend ----------
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

app.listen(PORT, () => console.log(`✅ Server läuft auf Port ${PORT}`));

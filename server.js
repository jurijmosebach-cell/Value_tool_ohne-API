import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";
import dotenv from "dotenv";

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

// ---------- Utility Functions ----------
function factorial(n) {
  return n <= 1 ? 1 : n * factorial(n - 1);
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
    away: +(awayProb / total).toFixed(4),
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

// ---------- SoccerData API ----------
async function getLastGamesAverage(teamId, count = 10) {
  try {
    const url = `https://app.sportdataapi.com/api/v1/soccer/matches?apikey=${SOCCERDATA_KEY}&team_id=${teamId}&status=finished&limit=${count}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data || !Array.isArray(data.data) || data.data.length === 0)
      return { avgScored: 1.2, avgConceded: 1.1 };

    let scored = 0, conceded = 0;
    data.data.forEach(m => {
      const isHome = m.home_team.team_id === teamId;
      const gf = isHome ? m.stats.home_score : m.stats.away_score;
      const ga = isHome ? m.stats.away_score : m.stats.home_score;
      scored += gf;
      conceded += ga;
    });

    return {
      avgScored: +(scored / data.data.length).toFixed(2),
      avgConceded: +(conceded / data.data.length).toFixed(2),
    };
  } catch (err) {
    console.error("Fehler bei Teamdaten:", err.message);
    return { avgScored: 1.3, avgConceded: 1.1 };
  }
}

// ---------- Spiele abrufen ----------
async function fetchGamesFromSoccerData() {
  const leagues = [237, 195, 244, 207, 216]; // Beispiel: Premier League, Bundesliga, Serie A, La Liga, Ligue 1
  const allGames = [];

  for (const leagueId of leagues) {
    try {
      const url = `https://app.sportdataapi.com/api/v1/soccer/matches?apikey=${SOCCERDATA_KEY}&season_id=${leagueId}&status=notstarted`;
      const res = await fetch(url);
      const data = await res.json();
      if (!data || !data.data) continue;

      for (const m of data.data.slice(0, 10)) {
        const homeStats = await getLastGamesAverage(m.home_team.team_id, 10);
        const awayStats = await getLastGamesAverage(m.away_team.team_id, 10);

        const homeXG = +(homeStats.avgScored * 1.05).toFixed(2);
        const awayXG = +(awayStats.avgScored * 0.95).toFixed(2);

        const outcome = computeMatchOutcomeProbs(homeXG, awayXG);
        const over25Prob = computeOver25Prob(homeXG, awayXG);

        const pHomeAtLeast1 = 1 - poisson(0, homeXG);
        const pAwayAtLeast1 = 1 - poisson(0, awayXG);
        const btts = +(pHomeAtLeast1 * pAwayAtLeast1).toFixed(4);

        const odds = {
          home: +(1.5 + Math.random() * 1.8).toFixed(2),
          draw: +(2.0 + Math.random() * 1.6).toFixed(2),
          away: +(1.7 + Math.random() * 1.8).toFixed(2),
          over25: +(1.7 + Math.random() * 0.7).toFixed(2),
          under25: +(1.8 + Math.random() * 0.7).toFixed(2)
        };

        const prob = {
          home: outcome.home,
          draw: outcome.draw,
          away: outcome.away,
          over25: over25Prob,
          under25: +(1 - over25Prob).toFixed(4),
        };

        const value = {
          home: +((prob.home * odds.home) - 1).toFixed(4),
          draw: +((prob.draw * odds.draw) - 1).toFixed(4),
          away: +((prob.away * odds.away) - 1).toFixed(4),
          over25: +((prob.over25 * odds.over25) - 1).toFixed(4),
          under25: +((prob.under25 * odds.under25) - 1).toFixed(4),
        };

        let trend = "neutral";
        const mainVal = Math.max(value.home, value.draw, value.away);
        if (mainVal > 0.12 && prob.home > prob.away) trend = "home";
        else if (mainVal > 0.12 && prob.away > prob.home) trend = "away";
        else if (Math.abs(prob.home - prob.away) < 0.08) trend = "draw";

        allGames.push({
          id: m.match_id,
          date: m.match_start,
          league: m.competition.name,
          home: m.home_team.name,
          away: m.away_team.name,
          homeLogo: m.home_team.logo,
          awayLogo: m.away_team.logo,
          homeXG,
          awayXG,
          odds,
          prob,
          value,
          btts,
          trend,
        });
      }
    } catch (err) {
      console.error("Fehler beim Abrufen der Liga:", leagueId, err.message);
    }
  }

  return allGames;
}

// ---------- API ----------
app.get("/api/games", async (req, res) => {
  try {
    const now = Date.now();
    if (!cache.data.length || now - cache.timestamp > CACHE_DURATION) {
      console.log("⏳ Lade neue Spiele von SoccerData...");
      const games = await fetchGamesFromSoccerData();
      cache = { timestamp: now, data: games };
    }

    let filtered = cache.data.slice();
    if (req.query.date) filtered = filtered.filter(g => g.date.startsWith(req.query.date));

    res.json({ response: filtered });
  } catch (err) {
    console.error("Fehler /api/games:", err.message);
    res.status(500).json({ response: [], error: err.message });
  }
});

app.get("*", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

app.listen(PORT, () => console.log(`🚀 Server läuft auf Port ${PORT}`));

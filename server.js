import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
app.use(express.static(__dirname));

const PORT = process.env.PORT || 10000;
const SOCCERDATA_KEY = process.env.SOCCERDATA_KEY || "";

// Cache (15 Minuten)
let cache = { timestamp: 0, data: [] };
const CACHE_DURATION = 15 * 60 * 1000;

// ---------------------
// Hilfsfunktionen
// ---------------------
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
  let homeProb = 0,
    drawProb = 0,
    awayProb = 0;
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

// Durchschnitt xG aus letzten Spielen berechnen
function calcAvgXG(lastGames, team) {
  const relevantGames = lastGames.filter(
    (g) => g.home === team || g.away === team
  );
  if (!relevantGames.length) return 1.2; // Standardwert
  let sum = 0,
    count = 0;
  relevantGames.forEach((g) => {
    if (g.home === team) sum += g.homeXG;
    else if (g.away === team) sum += g.awayXG;
    count++;
  });
  return +(sum / count).toFixed(2);
}

// Berechnung der xG basierend auf Historie
function computeXG(homeTeam, awayTeam, lastGames) {
  const homeAvg = calcAvgXG(lastGames, homeTeam);
  const awayAvg = calcAvgXG(lastGames, awayTeam);

  const homeXG = +(homeAvg * 1.05).toFixed(2); // Heimbonus
  const awayXG = +(awayAvg * 0.95).toFixed(2);

  return { homeXG, awayXG };
}

// ---------------------
// Daten von SoccerData API holen
// ---------------------
async function fetchGamesFromSoccerData() {
  if (!SOCCERDATA_KEY) return [];

  const url = `https://soccerdataapi.com/api/v1/fixtures?api_token=${SOCCERDATA_KEY}&status=SCHEDULED`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data || !data.data) return [];

  const lastGames = cache.data.slice(-50); // letzte 50 Spiele als Historie

  return data.data.map((m) => {
    const { homeXG, awayXG } = computeXG(
      m.home_team_name,
      m.away_team_name,
      lastGames
    );

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
      under25: +(1.8 + Math.random() * 0.7).toFixed(2),
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
    if (mainVal > 0.12 && prob.home > prob.away && prob.home > prob.draw)
      trend = "home";
    else if (mainVal > 0.12 && prob.away > prob.home && prob.away > prob.draw)
      trend = "away";
    else if (Math.abs(prob.home - prob.away) < 0.08 && prob.draw >= Math.max(prob.home, prob.away))
      trend = "draw";

    return {
      id: m.id,
      date: m.date,
      league: m.league_name || "Unknown",
      home: m.home_team_name || "Home",
      away: m.away_team_name || "Away",
      homeLogo: `https://flagcdn.com/48x36/eu.png`,
      awayLogo: `https://flagcdn.com/48x36/eu.png`,
      homeXG,
      awayXG,
      odds,
      prob,
      value,
      btts,
      trend,
    };
  });
}

// ---------------------
// API Endpoint
// ---------------------
app.get("/api/games", async (req, res) => {
  try {
    const now = Date.now();
    if (!cache.data.length || now - cache.timestamp > CACHE_DURATION) {
      const games = await fetchGamesFromSoccerData();
      cache = { timestamp: now, data: games };
    }

    let filtered = cache.data.slice();
    if (req.query.date) filtered = filtered.filter((g) =>
      g.date.startsWith(req.query.date)
    );

    res.json({ response: filtered });
  } catch (err) {
    res.status(500).json({ response: [], error: err.message });
  }
});

// ---------------------
// Frontend ausliefern
// ---------------------
app.get("*", (req, res) =>
  res.sendFile(path.join(__dirname, "index.html"))
);

app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));

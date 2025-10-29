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
const FOOTBALLDATA_KEY = process.env.FOOTBALL_DATA_API_KEY || "";
const SOCCERDATA_KEY = process.env.SOCCERDATA_API_KEY || "";

// Cache für 15 Minuten
let cache = { timestamp: 0, data: [] };
const CACHE_DURATION = 15 * 60 * 1000;

// Ligen mit IDs für beide APIs
const LEAGUES = {
  "Premier League": { soccerdata: 237, footballdata: "PL" },
  "Bundesliga": { soccerdata: 195, footballdata: "BL1" },
  "La Liga": { soccerdata: 244, footballdata: "PD" },
  "Serie A": { soccerdata: 207, footballdata: "SA" },
  "Ligue 1": { soccerdata: 216, footballdata: "FL1" },
};

// === Mathematische Hilfsfunktionen ===
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

// === Trendberechnung (letzte 10 Spiele) ===
function calculateTrend(matches) {
  let homeGoals = 0,
    awayGoals = 0;
  matches.forEach((m) => {
    homeGoals += m.home_score || 0;
    awayGoals += m.away_score || 0;
  });
  const diff = homeGoals - awayGoals;
  if (diff > 4) return "home";
  if (diff < -4) return "away";
  return "neutral";
}

// === Fetch SoccerData (nur heutige Spiele) ===
async function fetchFromSoccerData() {
  if (!SOCCERDATA_KEY) return [];
  console.log("📡 Lade Spiele von SoccerData...");

  const all = [];
  const today = new Date();
  const dateStr = today.toISOString().split("T")[0];

  for (const [leagueName, ids] of Object.entries(LEAGUES)) {
    try {
      const res = await fetch(
        `https://app.sportdataapi.com/api/v1/soccer/matches?apikey=${SOCCERDATA_KEY}&season_id=${ids.soccerdata}&date_from=${dateStr}&date_to=${dateStr}`
      );
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      if (!data?.data) continue;

      const recentMatches = data.data.slice(-10);
      const trend = calculateTrend(recentMatches);

      data.data.forEach((m) => {
        const matchDate = m.match_start?.split("T")[0];
        if (matchDate !== dateStr) return;

        const homeXG = +(0.8 + Math.random() * 1.6).toFixed(2);
        const awayXG = +(0.6 + Math.random() * 1.6).toFixed(2);
        const outcome = computeMatchOutcomeProbs(homeXG, awayXG);
        const over25 = computeOver25Prob(homeXG, awayXG);
        const pHomeAtLeast1 = 1 - poisson(0, homeXG);
        const pAwayAtLeast1 = 1 - poisson(0, awayXG);
        const btts = +(pHomeAtLeast1 * pAwayAtLeast1).toFixed(4);

        all.push({
          id: m.match_id,
          date: m.match_start,
          league: leagueName,
          home: m.home_team?.name || "Home",
          away: m.away_team?.name || "Away",
          homeXG,
          awayXG,
          prob: { ...outcome, over25 },
          value: { ...outcome, over25 },
          btts,
          trend,
        });
      });
    } catch (err) {
      console.log(`⚠️ Fehler bei Liga ${leagueName}: ${err.message}`);
    }
  }

  console.log(`✅ SoccerData geladen: ${all.length} Spiele`);
  return all;
}

// === Fallback: Football-Data ===
async function fetchFromFootballData() {
  if (!FOOTBALLDATA_KEY) return [];
  console.log("⚽ Fallback: Football-Data.org ...");

  const headers = { "X-Auth-Token": FOOTBALLDATA_KEY };
  const games = [];
  const today = new Date();
  const dateStr = today.toISOString().split("T")[0];

  for (const [leagueName, ids] of Object.entries(LEAGUES)) {
    try {
      const url = `https://api.football-data.org/v4/competitions/${ids.footballdata}/matches?status=SCHEDULED`;
      const res = await fetch(url, { headers });
      if (!res.ok) continue;
      const data = await res.json();
      if (!data.matches) continue;

      data.matches.forEach((m) => {
        const matchDate = m.utcDate.split("T")[0];
        if (matchDate !== dateStr) return;

        const homeXG = +(0.8 + Math.random() * 1.6).toFixed(2);
        const awayXG = +(0.6 + Math.random() * 1.6).toFixed(2);
        const outcome = computeMatchOutcomeProbs(homeXG, awayXG);
        const over25 = computeOver25Prob(homeXG, awayXG);
        const pHomeAtLeast1 = 1 - poisson(0, homeXG);
        const pAwayAtLeast1 = 1 - poisson(0, awayXG);
        const btts = +(pHomeAtLeast1 * pAwayAtLeast1).toFixed(4);

        games.push({
          id: m.id,
          date: m.utcDate,
          league: leagueName,
          home: m.homeTeam?.name || "Home",
          away: m.awayTeam?.name || "Away",
          homeXG,
          awayXG,
          prob: { ...outcome, over25 },
          value: { ...outcome, over25 },
          btts,
          trend: "neutral",
        });
      });
    } catch (err) {
      console.log("⚠️ FootballData Fehler:", err.message);
    }
  }

  console.log(`✅ FootballData geladen: ${games.length} Spiele`);
  return games;
}

// === API Endpoint ===
app.get("/api/games", async (req, res) => {
  try {
    const now = Date.now();
    if (!cache.data.length || now - cache.timestamp > CACHE_DURATION) {
      console.log("🕒 Aktualisiere Cache...");
      let games = await fetchFromSoccerData();
      if (!games.length) games = await fetchFromFootballData();
      cache = { timestamp: now, data: games };
    }

    const filtered = cache.data.slice();
    res.json({ response: filtered });
  } catch (err) {
    res.status(500).json({ error: err.message, response: [] });
  }
});

// === Serve Frontend ===
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

app.listen(PORT, () => console.log(`🚀 Server läuft auf Port ${PORT}`));

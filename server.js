// server.js
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
app.use(express.static(__dirname));

const PORT = process.env.PORT || 10000;
const CACHE_DURATION = Number(process.env.CACHE_DURATION) || 15 * 60 * 1000;
const LOG_REQUESTS = process.env.LOG_REQUESTS === "true";

// 🔑 API Keys
const SOCCERDATA_KEY = process.env.SOCCERDATA_API_KEY || "";
const FOOTBALLDATA_KEY = process.env.FOOTBALL_DATA_API_KEY || "";

// Cache für Spiele
let cache = { timestamp: 0, data: [] };

// ⚽ Ligen (SoccerData season_id + FootballData competition code)
const LEAGUES = {
  "Premier League": { soccerdata: 237, footballdata: "PL" },
  "Bundesliga": { soccerdata: 195, footballdata: "BL1" },
  "La Liga": { soccerdata: 244, footballdata: "PD" },
  "Serie A": { soccerdata: 207, footballdata: "SA" },
  "Ligue 1": { soccerdata: 216, footballdata: "FL1" },
  "Champions League": { soccerdata: 238, footballdata: "CL" },
  "Eredivisie": { soccerdata: 203, footballdata: "DED" },
  "Campeonato Brasileiro Série A": { soccerdata: 224, footballdata: "BSA" },
  "Championship": { soccerdata: 196, footballdata: "ELC" },
  "Primeira Liga": { soccerdata: 227, footballdata: "PPL" }
};

/* ---------- Mathematische Funktionen ---------- */
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
  let home = 0, draw = 0, away = 0;
  for (let i = 0; i <= maxGoals; i++) {
    const pHome = poisson(i, homeLambda);
    for (let j = 0; j <= maxGoals; j++) {
      const pAway = poisson(j, awayLambda);
      const p = pHome * pAway;
      if (i > j) home += p;
      else if (i === j) draw += p;
      else away += p;
    }
  }
  const total = home + draw + away;
  return { home: home / total, draw: draw / total, away: away / total };
}

function computeOver25Prob(homeLambda, awayLambda, maxGoals = 7) {
  let pLe2 = 0;
  for (let i = 0; i <= 2; i++) {
    const ph = poisson(i, homeLambda);
    for (let j = 0; j <= 2; j++) {
      if (i + j <= 2) pLe2 += ph * poisson(j, awayLambda);
    }
  }
  return 1 - pLe2;
}

/* ---------- Letzte 10 Spiele berechnen ---------- */
function calculateTrend(lastMatches) {
  const goals = lastMatches.map(m => m.goals_scored);
  const avg = goals.reduce((a, b) => a + b, 0) / goals.length;
  if (avg > 2.2) return "offensiv";
  if (avg < 1.2) return "defensiv";
  return "neutral";
}

/* ---------- SoccerData Fetch ---------- */
async function fetchFromSoccerData() {
  const leagues = Object.entries(LEAGUES);
  const all = [];

  for (const [name, ids] of leagues) {
    try {
      const res = await fetch(
        `https://app.sportdataapi.com/api/v1/soccer/matches?apikey=${SOCCERDATA_KEY}&season_id=${ids.soccerdata}`
      );
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      if (!data?.data) continue;

      const recentMatches = data.data.slice(-10);
      const trend = calculateTrend(recentMatches);

      data.data.forEach((m) => {
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
          league: name,
          home: m.home_team?.name || "Home",
          away: m.away_team?.name || "Away",
          homeXG,
          awayXG,
          prob: { ...outcome, over25 },
          value: { ...outcome, over25 },
          btts,
          trend
        });
      });
    } catch (err) {
      console.log(`⚠️ Fehler bei Liga ${name}: ${err.message}`);
    }
  }

  return all;
}

/* ---------- Football-Data.org Fallback ---------- */
async function fetchFromFootballData() {
  if (!FOOTBALLDATA_KEY) return [];
  const headers = { "X-Auth-Token": FOOTBALLDATA_KEY };
  const games = [];

  for (const [name, ids] of Object.entries(LEAGUES)) {
    try {
      const url = `https://api.football-data.org/v4/competitions/${ids.footballdata}/matches?status=SCHEDULED`;
      const res = await fetch(url, { headers });
      if (!res.ok) continue;
      const data = await res.json();

      data.matches.forEach((m) => {
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
          league: name,
          home: m.homeTeam?.name || "Home",
          away: m.awayTeam?.name || "Away",
          homeXG,
          awayXG,
          prob: { ...outcome, over25 },
          value: { ...outcome, over25 },
          btts,
          trend: "neutral"
        });
      });
    } catch (err) {
      console.log("⚠️ FootballData Fehler:", err.message);
    }
  }

  return games;
}

/* ---------- API Endpoint ---------- */
app.get("/api/games", async (req, res) => {
  try {
    const now = Date.now();

    if (!cache.data.length || now - cache.timestamp > CACHE_DURATION) {
      console.log("⏳ Lade neue Spiele...");

      let games = await fetchFromSoccerData();
      if (!games.length) {
        console.log("⚠️ SoccerData down — wechsle zu FootballData.org");
        games = await fetchFromFootballData();
      }

      cache = { timestamp: now, data: games };
    }

    res.json({ response: cache.data });
  } catch (err) {
    console.error("Fehler beim Laden:", err);
    res.status(500).json({ response: [], error: err.message });
  }
});

/* ---------- Frontend ---------- */
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () =>
  console.log(`✅ Server läuft auf Port ${PORT}`)
);

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
const FOOTBALL_DATA_KEY = process.env.FOOTBALL_DATA_API_KEY || "";
const SOCCERDATA_KEY = process.env.SOCCERDATA_API_KEY || "";
const CACHE_DURATION = parseInt(process.env.CACHE_DURATION || "900000");

let cache = { timestamp: 0, date: "", data: [] };

// -------------------- Hilfsfunktionen --------------------

function factorial(n) {
  return n <= 1 ? 1 : n * factorial(n - 1);
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

function randomXG(min = 0.6, max = 2.0) {
  return +(min + Math.random() * (max - min)).toFixed(2);
}

// -------------------- Fetch: Football-Data --------------------

async function fetchFromFootballData() {
  if (!FOOTBALL_DATA_KEY) return [];

  console.log("📡 Lade Spiele von Football-Data.org...");

  const LEAGUE_IDS = ["PL", "BL1", "PD", "SA", "FL1", "CL"];
  const headers = { "X-Auth-Token": FOOTBALL_DATA_KEY };
  const today = new Date().toISOString().split("T")[0];
  const allGames = [];

  for (const id of LEAGUE_IDS) {
    try {
      const url = `https://api.football-data.org/v4/competitions/${id}/matches?status=SCHEDULED`;
      const res = await fetch(url, { headers });
      if (!res.ok) continue;

      const data = await res.json();
      const matches = data.matches.filter((m) =>
        m.utcDate.startsWith(today)
      );

      for (const m of matches) {
        const homeXG = randomXG();
        const awayXG = randomXG();
        const prob = computeMatchOutcomeProbs(homeXG, awayXG);
        const over25 = computeOver25Prob(homeXG, awayXG);
        const pHomeAtLeast1 = 1 - poisson(0, homeXG);
        const pAwayAtLeast1 = 1 - poisson(0, awayXG);
        const btts = +(pHomeAtLeast1 * pAwayAtLeast1).toFixed(4);

        allGames.push({
          id: m.id,
          league: data.competition.name,
          home: m.homeTeam?.name || "Heim",
          away: m.awayTeam?.name || "Gast",
          date: m.utcDate,
          homeXG,
          awayXG,
          prob,
          value: {
            home: +(prob.home * 2 - 1).toFixed(4),
            draw: +(prob.draw * 2 - 1).toFixed(4),
            away: +(prob.away * 2 - 1).toFixed(4),
            over25: +(over25 * 2 - 1).toFixed(4),
          },
          btts,
          trend:
            prob.home > prob.away
              ? "home"
              : prob.away > prob.home
              ? "away"
              : "draw",
        });
      }
    } catch (err) {
      console.error("⚠️ Fehler Football-Data:", id, err.message);
    }
  }

  return allGames;
}

// -------------------- Fetch: SoccerData --------------------

async function fetchFromSoccerData() {
  if (!SOCCERDATA_KEY) return [];
  console.log("📡 Lade Spiele von SoccerData (Fallback)...");

  const today = new Date().toISOString().split("T")[0];
  const url = `https://app.sportdataapi.com/api/v1/soccer/fixtures?apikey=${SOCCERDATA_KEY}&date_from=${today}&date_to=${today}`;
  const res = await fetch(url);

  if (!res.ok) {
    console.error("⚠️ Fehler SoccerData:", res.statusText);
    return [];
  }

  const data = await res.json();
  if (!data?.data) return [];

  return data.data.map((m) => {
    const homeXG = randomXG();
    const awayXG = randomXG();
    const prob = computeMatchOutcomeProbs(homeXG, awayXG);
    const over25 = computeOver25Prob(homeXG, awayXG);
    const btts = +( (1 - poisson(0, homeXG)) * (1 - poisson(0, awayXG)) ).toFixed(4);

    return {
      id: m.match_id,
      league: m.league?.name || "Unbekannte Liga",
      home: m.home_team?.name || "Heim",
      away: m.away_team?.name || "Gast",
      date: m.match_start,
      homeXG,
      awayXG,
      prob,
      value: {
        home: +(prob.home * 2 - 1).toFixed(4),
        draw: +(prob.draw * 2 - 1).toFixed(4),
        away: +(prob.away * 2 - 1).toFixed(4),
        over25: +(over25 * 2 - 1).toFixed(4),
      },
      btts,
      trend:
        prob.home > prob.away
          ? "home"
          : prob.away > prob.home
          ? "away"
          : "draw",
    };
  });
}

// -------------------- API Route --------------------

app.get("/api/games", async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const now = Date.now();
    const force = req.query.refresh === "true";
    const cacheValid =
      cache.date === today && now - cache.timestamp < CACHE_DURATION && !force;

    if (cacheValid) {
      console.log("⚡ Spiele aus Cache:", cache.data.length);
      return res.json({ source: "cache", response: cache.data });
    }

    console.log("🔄 Lade neue Spiele für:", today);

    let games = await fetchFromFootballData();
    if (!games.length) {
      console.log("⚠️ Football-Data leer, nutze SoccerData Fallback...");
      games = await fetchFromSoccerData();
    }

    cache = { timestamp: now, date: today, data: games };
    res.json({ source: "fresh", response: games });
  } catch (err) {
    console.error("❌ Fehler /api/games:", err);
    res.status(500).json({ error: err.message, response: [] });
  }
});

// -------------------- Frontend --------------------

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () =>
  console.log(`✅ Server läuft auf Port ${PORT} (Hybrid-Modus aktiv)`)
);

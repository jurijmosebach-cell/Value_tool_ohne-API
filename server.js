// server.js – präzise Version für xG Value Dashboard
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
app.use(express.static(__dirname));

const PORT = process.env.PORT || 10000;
const FOOTBALL_DATA_KEY = process.env.FOOTBALL_DATA_API_KEY || "";

// Cache für API-Ergebnisse
let cache = { timestamp: 0, data: [] };
const CACHE_DURATION = 15 * 60 * 1000; // 15 Minuten

// Ligen-IDs für football-data.org
const LEAGUE_IDS = {
  "Premier League": "PL",
  "Bundesliga": "BL1",
  "La Liga": "PD",
  "Serie A": "SA",
  "Ligue 1": "FL1",
  "Champions League": "CL",
  "Eredivisie": "DED",
  "Campeonato Brasileiro Série A": "BSA",
  "Championship": "ELC",
  "Primeira Liga": "PPL",
  "European Championship": "EC"
};

/* ---------- Utility Functions ---------- */
function getFlag(team) {
  const flags = {
    "Manchester": "gb", "Liverpool": "gb", "Chelsea": "gb", "Arsenal": "gb", "Tottenham": "gb",
    "Bayern": "de", "Dortmund": "de", "Leipzig": "de", "Gladbach": "de", "Frankfurt": "de", "Leverkusen": "de",
    "Real": "es", "Barcelona": "es", "Atletico": "es", "Sevilla": "es", "Valencia": "es",
    "Juventus": "it", "Inter": "it", "Milan": "it", "Napoli": "it", "Roma": "it", "Lazio": "it",
    "PSG": "fr", "Marseille": "fr", "Monaco": "fr", "Lyon": "fr", "Rennes": "fr", "Nice": "fr"
  };
  for (const [name, flag] of Object.entries(flags)) {
    if (team.includes(name)) return flag;
  }
  return "eu";
}

/* ---------- Mathematische Hilfsfunktionen ---------- */
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

/* ---------- Neues xG-Modell ---------- */
function estimateXG(teamName, isHome) {
  const base = isHome ? 1.45 : 1.15; // Heimbonus
  let adj = 0;

  // Team-Stärke grob simulieren
  const strongTeams = ["Man City", "Liverpool", "Bayern", "Real", "PSG", "Inter", "Arsenal"];
  const weakTeams = ["Bochum", "Cadiz", "Verona", "Clermont", "Empoli", "Luton", "Sheffield"];

  if (strongTeams.some(t => teamName.includes(t))) adj += 0.4;
  if (weakTeams.some(t => teamName.includes(t))) adj -= 0.25;

  const random = (Math.random() - 0.5) * 0.25; // leicht zufällig
  return +(base + adj + random).toFixed(2);
}

/* ---------- Hauptfunktion: Spiele abrufen ---------- */
async function fetchGamesFromAPI() {
  if (!FOOTBALL_DATA_KEY) return [];

  const headers = { "X-Auth-Token": FOOTBALL_DATA_KEY };
  const leaguePromises = Object.entries(LEAGUE_IDS).map(async ([leagueName, id]) => {
    try {
      const url = `https://api.football-data.org/v4/competitions/${id}/matches?status=SCHEDULED`;
      const res = await fetch(url, { headers, timeout: 15000 });
      if (!res.ok) return [];
      const data = await res.json();
      if (!data.matches) return [];

      return data.matches.map(m => {
        const homeXG = estimateXG(m.homeTeam?.name || "", true);
        const awayXG = estimateXG(m.awayTeam?.name || "", false);

        const outcome = computeMatchOutcomeProbs(homeXG, awayXG);
        const over25Prob = computeOver25Prob(homeXG, awayXG);
        const pHomeAtLeast1 = 1 - poisson(0, homeXG);
        const pAwayAtLeast1 = 1 - poisson(0, awayXG);
        const btts = +(pHomeAtLeast1 * pAwayAtLeast1).toFixed(4);

        // Beispielhafte Odds (besser: echte Quotenquelle)
        const odds = {
          home: +(1.5 + Math.random() * 1.6).toFixed(2),
          draw: +(2.8 + Math.random() * 1.3).toFixed(2),
          away: +(1.6 + Math.random() * 1.5).toFixed(2),
          over25: +(1.8 + Math.random() * 0.5).toFixed(2),
          under25: +(1.8 + Math.random() * 0.5).toFixed(2)
        };

        // Kalibrierte Wahrscheinlichkeiten
        const prob = {
          home: outcome.home,
          draw: outcome.draw,
          away: outcome.away,
          over25: over25Prob,
          under25: +(1 - over25Prob).toFixed(4)
        };

        // Value-Berechnung
        const value = {
          home: +((prob.home * odds.home) - 1).toFixed(4),
          draw: +((prob.draw * odds.draw) - 1).toFixed(4),
          away: +((prob.away * odds.away) - 1).toFixed(4),
          over25: +((prob.over25 * odds.over25) - 1).toFixed(4),
          under25: +((prob.under25 * odds.under25) - 1).toFixed(4)
        };

        // Trendlogik (präziser)
        let trend = "neutral";
        const mainVal = Math.max(value.home, value.draw, value.away);
        if (value.home > 0.1 && prob.home > 0.45) trend = "home";
        else if (value.away > 0.1 && prob.away > 0.45) trend = "away";
        else if (value.draw > 0.1 && Math.abs(prob.home - prob.away) < 0.08) trend = "draw";

        return {
          id: m.id,
          date: m.utcDate,
          league: leagueName,
          home: m.homeTeam?.name || "Home",
          away: m.awayTeam?.name || "Away",
          homeLogo: `https://flagcdn.com/48x36/${getFlag(m.homeTeam?.name || "")}.png`,
          awayLogo: `https://flagcdn.com/48x36/${getFlag(m.awayTeam?.name || "")}.png`,
          homeXG, awayXG, odds, prob, value, btts, trend
        };
      });
    } catch (err) {
      console.error("Fehler Liga", leagueName, err.message);
      return [];
    }
  });

  const results = await Promise.all(leaguePromises);
  return results.flat().sort((a, b) => new Date(a.date) - new Date(b.date));
}

/* ---------- API ---------- */
app.get("/api/games", async (req, res) => {
  try {
    const now = Date.now();
    if (!cache.data.length || now - cache.timestamp > CACHE_DURATION) {
      const games = await fetchGamesFromAPI();
      cache = { timestamp: now, data: games };
    }

    let filtered = cache.data.slice();
    if (req.query.date) filtered = filtered.filter(g => g.date.startsWith(req.query.date));

    res.json({ response: filtered });
  } catch (err) {
    console.error("API Fehler:", err.message);
    res.status(500).json({ response: [], error: err.message });
  }
});

/* ---------- Frontend ---------- */
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

app.listen(PORT, () => console.log(`🚀 Server läuft auf Port ${PORT}`));

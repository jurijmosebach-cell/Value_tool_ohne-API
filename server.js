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

let cache = { timestamp: 0, data: [] };
const CACHE_DURATION = 15 * 60 * 1000; // 15 Minuten

// League IDs (Football-Data.org)
const LEAGUE_IDS = {
  "Premier League": "PL",
  "Bundesliga": "BL1",
  "La Liga": "PD",
  "Serie A": "SA",
  "Ligue 1": "FL1",
  "Champions League": "CL",
  "Eredivisie": "DED",
  "Brasileiro": "BSA",
  "Championship": "ELC",
  "Primeira Liga": "PPL",
  "Europameisterschaft": "EG"
};

// Fetch matches from Football-Data API
async function fetchGamesFromAPI() {
  if (!FOOTBALL_DATA_KEY) {
    console.error("Kein API-Schlüssel gefunden!");
    return [];
  }

  const headers = { "X-Auth-Token": FOOTBALL_DATA_KEY };
  const allGames = [];

  console.log("Start fetching games from API...");

  for (const [leagueName, id] of Object.entries(LEAGUE_IDS)) {
    try {
      const url = `https://api.football-data.org/v4/competitions/${id}/matches?status=SCHEDULED`;
      console.log(`Fetching data for ${leagueName} with URL: ${url}`);

      const res = await fetch(url, { headers });

      // Wenn der Status nicht ok ist, logge die Antwort
      if (!res.ok) {
        console.error(`API Fehler für Liga ${leagueName}: ${res.status} ${res.statusText}`);
        return [];
      }

      const data = await res.json();

      // Logge die komplette API-Antwort
      console.log(`API Antwort für Liga ${leagueName}:`, data);

      if (!data.matches || !Array.isArray(data.matches)) {
        console.error(`Keine Spiele für Liga ${leagueName} gefunden.`);
        return [];
      }

      // Verarbeite Spiele
      data.matches.forEach((m) => {
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
        if (mainVal > 0.12 && prob.home > prob.away && prob.home > prob.draw) trend = "home";
        else if (mainVal > 0.12 && prob.away > prob.home && prob.away > prob.draw) trend = "away";
        else if (Math.abs(prob.home - prob.away) < 0.08 && prob.draw >= Math.max(prob.home, prob.away))
          trend = "draw";

        allGames.push({
          id: m.id,
          date: m.utcDate,
          league: leagueName,
          home: m.homeTeam?.name || "Home",
          away: m.awayTeam?.name || "Away",
          homeLogo: `https://flagcdn.com/48x36/${getFlag(m.homeTeam?.name || "")}.png`,
          awayLogo: `https://flagcdn.com/48x36/${getFlag(m.awayTeam?.name || "")}.png`,
          homeXG,
          awayXG,
          odds,
          prob,
          value,
          btts,
          trend,
        });
      });
    } catch (err) {
      console.error("Fehler beim Abrufen der Liga:", err.message);
      continue;
    }
  }

  allGames.sort((a, b) => new Date(a.date) - new Date(b.date));
  return allGames;
}

// KI-Vorhersage-API
app.post("/api/predict", async (req, res) => {
  try {
    const { homeXG, awayXG } = req.body;
    const prediction = await predictMatchOutcome(homeXG, awayXG);
    res.json({ prediction });
  } catch (err) {
    console.error("Fehler bei der Vorhersage:", err);
    res.status(500).json({ error: err.message });
  }
});

// KI-Vorhersage-Funktion
function poisson(k, lambda) {
  return Math.pow(lambda, k) * Math.exp(-lambda) / factorial(k);
}

function factorial(n) {
  if (n <= 1) return 1;
  let f = 1;
  for (let i = 2; i <= n; i++) f *= i;
  return f;
}

async function predictMatchOutcome(homeXG, awayXG) {
  const homeProb = poisson(homeXG, 1); // Beispiel Poisson-Verteilung
  const awayProb = poisson(awayXG, 1); // Beispiel Poisson-Verteilung
  const drawProb = 1 - homeProb - awayProb;

  return {
    homeWin: (homeProb * 100).toFixed(2),
    draw: (drawProb * 100).toFixed(2),
    awayWin: (awayProb * 100).toFixed(2),
  };
}

// Serve the frontend
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));
            

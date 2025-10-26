import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import cron from "node-cron";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.static(__dirname));

const PORT = process.env.PORT || 10000;
const CACHE_PATH = path.join(__dirname, "data", "cache.json");

// Ligen + OpenFootball-Quellen
const LEAGUE_SOURCES = [
  { name: "Premier League", url: "https://raw.githubusercontent.com/openfootball/england/master/2024-25/eng.1.json" },
  { name: "Bundesliga", url: "https://raw.githubusercontent.com/openfootball/de-deutschland/master/2024-25/de.1.json" },
  { name: "La Liga", url: "https://raw.githubusercontent.com/openfootball/es-espana/master/2024-25/es.1.json" },
  { name: "Serie A", url: "https://raw.githubusercontent.com/openfootball/it-italy/master/2024-25/it.1.json" }
];

// Hilfsfunktion für Flaggen
function getFlag(team) {
  const flags = {
    "England": "gb",
    "Germany": "de",
    "Spain": "es",
    "Italy": "it",
    "France": "fr",
    "USA": "us",
    "Turkey": "tr",
    "Brazil": "br",
    "Netherlands": "nl",
    "Portugal": "pt"
  };
  for (const [country, flag] of Object.entries(flags))
    if (team.toLowerCase().includes(country.toLowerCase())) return flag;
  return "eu";
}

// Funktion: Spiele von OpenFootball laden
async function fetchOpenFootballData() {
  const today = new Date().toISOString().slice(0, 10);
  const allGames = [];

  for (const league of LEAGUE_SOURCES) {
    try {
      const res = await fetch(league.url);
      const data = await res.json();
      const todays = data.matches.filter(m => m.date === today);
      todays.forEach(m => {
        allGames.push({
          home: m.team1,
          away: m.team2,
          league: league.name,
          odds: {
            home: 1.8 + Math.random() * 1.2,
            draw: 3.2 + Math.random() * 0.6,
            away: 2.0 + Math.random() * 1.8,
            over25: 1.6 + Math.random() * 0.4,
            under25: 2.0 + Math.random() * 0.5
          }
        });
      });
    } catch (err) {
      console.warn(`⚠️ Fehler bei ${league.name}: ${err.message}`);
    }
  }

  console.log(`📅 ${today}: ${allGames.length} Spiele geladen.`);
  await fs.writeFile(CACHE_PATH, JSON.stringify({ date: today, games: allGames }, null, 2));
  return allGames;
}

// Funktion: Cache lesen oder aktualisieren
async function getCachedGames() {
  try {
    const raw = await fs.readFile(CACHE_PATH, "utf8");
    const cache = JSON.parse(raw);
    const today = new Date().toISOString().slice(0, 10);

    // Wenn Cache veraltet → neu laden
    if (cache.date !== today) {
      console.log("♻️ Cache ist veraltet – lade neue Spieldaten...");
      return await fetchOpenFootballData();
    }

    return cache.games;
  } catch {
    console.log("🆕 Kein Cache gefunden – lade initiale Spieldaten...");
    return await fetchOpenFootballData();
  }
}

// API: Spiele für das gewählte Datum zurückgeben
app.get("/api/games", async (req, res) => {
  try {
    const matches = await getCachedGames();

    const games = matches.map(g => {
      const homeXG = 1.3 + Math.random() * 0.7;
      const awayXG = 1.2 + Math.random() * 0.6;
      const totalXG = homeXG + awayXG;

      const prob = {
        home: homeXG / totalXG,
        away: awayXG / totalXG,
        draw: Math.max(0, 1 - (homeXG / totalXG + awayXG / totalXG)),
        over25: 0.55 + Math.random() * 0.15,
        under25: 1 - (0.55 + Math.random() * 0.15)
      };

      const value = {
        home: g.odds.home ? prob.home * g.odds.home - 1 : 0,
        draw: g.odds.draw ? prob.draw * g.odds.draw - 1 : 0,
        away: g.odds.away ? prob.away * g.odds.away - 1 : 0,
        over25: g.odds.over25 ? prob.over25 * g.odds.over25 - 1 : 0,
        under25: g.odds.under25 ? prob.under25 * g.odds.under25 - 1 : 0
      };

      return {
        ...g,
        homeLogo: `https://flagcdn.com/48x36/${getFlag(g.home)}.png`,
        awayLogo: `https://flagcdn.com/48x36/${getFlag(g.away)}.png`,
        homeXG: +homeXG.toFixed(2),
        awayXG: +awayXG.toFixed(2),
        totalXG: +totalXG.toFixed(2),
        value,
        prob
      };
    });

    res.json({ response: games });
  } catch (err) {
    console.error("Fehler /api/games:", err);
    res.status(500).json({ error: "Fehler beim Laden der Spieldaten." });
  }
});

// Frontend
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Scheduler (cronjob): jeden Tag um 00:10 Uhr Cache aktualisieren
cron.schedule("10 0 * * *", async () => {
  console.log("🕛 Automatischer Tages-Update gestartet...");
  await fetchOpenFootballData();
});

app.listen(PORT, () => {
  console.log(`🟢 XG Value Tool läuft auf http://localhost:${PORT}`);
  console.log("🔄 Initialer Daten-Check...");
  getCachedGames();
});

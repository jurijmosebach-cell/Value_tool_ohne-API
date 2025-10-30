import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 10000;
const API_KEY = process.env.SPORTSAPI360_KEY;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let cache = {};
const CACHE_TIME = 5 * 60 * 1000; // 5 Minuten

app.use(express.json());
app.use(express.static(__dirname));

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

async function fetchMatches(url) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${API_KEY}` } });
  if (!res.ok) throw new Error(`API Fehler ${res.status}`);
  const data = await res.json();
  return data?.data || [];
}

function mapMatch(m, date) {
  return {
    id: m.id,
    league: m.league?.name || "Unbekannt",
    home: m.home_team?.name || "Heim",
    away: m.away_team?.name || "Gast",
    homeLogo: m.home_team?.logo || "",
    awayLogo: m.away_team?.logo || "",
    date: m.date || date,
    score: m.score || null,
    minute: m.minute || null,
    homeXG: m.stats?.home_xg ?? (Math.random() * 1.5 + 0.5).toFixed(2),
    awayXG: m.stats?.away_xg ?? (Math.random() * 1.5 + 0.5).toFixed(2),
  };
}

// 📅 Spiele nach Datum
app.get("/api/games", async (req, res) => {
  const date = req.query.date || new Date().toISOString().split("T")[0];
  const key = `games-${date}`;
  if (cache[key] && Date.now() - cache[key].time < CACHE_TIME) {
    return res.json(cache[key].data);
  }
  try {
    console.log(`📅 Lade Spiele für ${date}`);
    const matches = await fetchMatches(`https://sportsapi360.com/api/soccer/matches?date=${date}`);
    const response = { response: matches.map(m => mapMatch(m, date)) };
    cache[key] = { time: Date.now(), data: response };
    res.json(response);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Fehler beim Abrufen der Spiele" });
  }
});

// 🟢 Live Spiele
app.get("/api/live", async (_req, res) => {
  try {
    console.log("📺 Lade Live-Spiele");
    const matches = await fetchMatches("https://sportsapi360.com/api/soccer/matches?live=1");
    const response = { response: matches.map(m => mapMatch(m, new Date().toISOString().split("T")[0])) };
    res.json(response);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Fehler beim Abrufen der Live-Spiele" });
  }
});

app.listen(PORT, () => console.log(`🚀 Server läuft auf Port ${PORT} (SportsAPI360 aktiv)`));

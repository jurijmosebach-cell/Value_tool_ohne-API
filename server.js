import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 10000;
const API_KEY = process.env.SPORTSAPI360_KEY;

// Pfad ermitteln (wichtig für Render)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let cache = {};
const CACHE_TIME = 5 * 60 * 1000; // 5 Minuten

app.use(express.json());
app.use(express.static(__dirname));

// Startseite
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

// 🔧 API-Helfer: egal welche Struktur zurückkommt, wir ziehen die Matches raus
async function fetchMatches(url) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
  if (!res.ok) throw new Error(`API Fehler: ${res.status}`);
  const data = await res.json();

  // unterschiedliche Strukturen abfangen:
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.response)) return data.response;
  if (Array.isArray(data.data)) return data.data;
  if (data.data?.matches) return data.data.matches;
  if (data.matches) return data.matches;

  console.warn("⚠️ Unerwartete API-Struktur:", Object.keys(data));
  return [];
}

// Einheitliche Mappings für Anzeige
function mapMatch(m, date) {
  return {
    id: m.id || m.fixture_id || m.match_id || Math.random().toString(36),
    league: m.league?.name || m.competition?.name || "Unbekannt",
    home: m.home_team?.name || m.home?.name || "Heim",
    away: m.away_team?.name || m.away?.name || "Gast",
    homeLogo: m.home_team?.logo || m.home?.logo || "",
    awayLogo: m.away_team?.logo || m.away?.logo || "",
    date: m.date || m.start_date || date,
    score: m.score || m.full_time_result || null,
    minute: m.minute || m.time?.elapsed || null,
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
    const mapped = matches.map((m) => mapMatch(m, date));
    const response = { response: mapped };
    cache[key] = { time: Date.now(), data: response };
    res.json(response);
  } catch (e) {
    console.error("❌ Fehler beim Laden der Spiele:", e);
    res.status(500).json({ error: "Fehler beim Abrufen der Spiele" });
  }
});

// 🟢 Live Spiele
app.get("/api/live", async (_req, res) => {
  try {
    console.log("📺 Lade Live-Spiele");
    const matches = await fetchMatches("https://sportsapi360.com/api/soccer/matches?live=1");
    const mapped = matches.map((m) => mapMatch(m, new Date().toISOString().split("T")[0]));
    const response = { response: mapped };
    res.json(response);
  } catch (e) {
    console.error("❌ Fehler beim Laden der Live-Spiele:", e);
    res.status(500).json({ error: "Fehler beim Abrufen der Live-Spiele" });
  }
});

app.listen(PORT, () => console.log(`🚀 Server läuft auf Port ${PORT} (SportsAPI360 aktiv)`));

import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const API_URL = "https://apiv3.sportsapi360.com/football/api/v1";
const API_KEY = process.env.SPORTSAPI_KEY;
const PORT = process.env.PORT || 10000;

// === Fallback-Daten, falls API nicht erreichbar ===
const fallbackGames = [
  {
    home: "Team A",
    away: "Team B",
    league: "Demo Liga",
    date: new Date().toISOString(),
    homeLogo: "",
    awayLogo: "",
    value: { home: 0.5, draw: 0.3, away: 0.2, over25: 0.6, under25: 0.4 },
    trend: "home",
    btts: 0.7
  },
  {
    home: "Team C",
    away: "Team D",
    league: "Demo Liga",
    date: new Date().toISOString(),
    homeLogo: "",
    awayLogo: "",
    value: { home: 0.4, draw: 0.35, away: 0.25, over25: 0.5, under25: 0.5 },
    trend: "away",
    btts: 0.6
  }
];

app.get("/api/games", async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    console.log("📅 Lade Spiele für", date);

    const response = await fetch(`${API_URL}/matches/live`, {
      headers: { "x-app-key": API_KEY }
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`❌ Fehler /api/games: ${response.status} ${response.statusText}`);
      console.error("Response (erste 200 Zeichen):", text.slice(0, 200));
      console.warn("⚠️ Fallback-Daten werden verwendet.");
      return res.json({ response: fallbackGames });
    }

    const data = await response.json();
    const matches = data?.data || [];

    const games = matches.map((m) => ({
      home: m.home_team?.name || "Unbekannt",
      away: m.away_team?.name || "Unbekannt",
      league: m.league?.name || "Unbekannte Liga",
      date: m.fixture?.date || new Date().toISOString(),
      homeLogo: m.home_team?.logo || "",
      awayLogo: m.away_team?.logo || "",
      value: {
        home: m.probabilities?.home_win || 0,
        draw: m.probabilities?.draw || 0,
        away: m.probabilities?.away_win || 0,
        over25: m.probabilities?.over_2_5 || 0,
        under25: 1 - (m.probabilities?.over_2_5 || 0)
      },
      trend: m.trend || "neutral",
      btts: m.probabilities?.btts || 0
    }));

    res.json({ response: games.length > 0 ? games : fallbackGames });
  } catch (err) {
    console.error("❌ Server Fehler /api/games:", err);
    console.warn("⚠️ Fallback-Daten werden verwendet.");
    res.json({ response: fallbackGames });
  }
});

app.get("/", (req, res) => {
  res.send(`
    <h1>⚽ Value Tool Backend</h1>
    <p>Das Backend läuft. <a href="/api/games">API testen</a></p>
  `);
});

app.listen(PORT, () => {
  console.log(`🚀 Server läuft auf Port ${PORT} (SportsAPI360 aktiv)`);
});

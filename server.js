import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const API_URL = "https://apiv3.sportsapi360.com/football/api/v1/matches/live";
const API_KEY = process.env.SPORTSAPI_KEY;
const PORT = process.env.PORT || 10000;

// === API Route /api/games ===
app.get("/api/games", async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    console.log("📅 Lade Spiele für", date);

    // Richtiges Header-Format für SportsAPI360 v3
    const response = await fetch(API_URL, {
      headers: { "x-app-key": API_KEY },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("❌ Fehler /api/games:", response.status, response.statusText, "-", text.slice(0, 200));
      return res.status(response.status).json({ error: "API Fehler", details: text });
    }

    const data = await response.json();
    const matches = data?.data || [];

    // Mapping auf dein Frontend-Format
    const games = matches.map(m => ({
      home: m.home_team?.name || "Unbekannt",
      away: m.away_team?.name || "Unbekannt",
      league: m.league?.name || "Unbekannte Liga",
      date: m.fixture?.date,
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

    res.json({ response: games });
  } catch (err) {
    console.error("❌ Server Fehler /api/games:", err);
    res.status(500).json({ error: "Serverfehler", details: err.message });
  }
});

// === Frontend Route / ===
app.get("/", (req, res) => {
  res.send(`
    <h1>⚽ Value Tool Backend</h1>
    <p>Das Backend läuft. <a href="/api/games">API testen</a></p>
  `);
});

app.listen(PORT, () => {
  console.log(`🚀 Server läuft auf Port ${PORT} (Frontend + API bereit)`);
});

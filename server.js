import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;
const API_KEY = process.env.SPORTSAPI_KEY;
const BASE_URL = "https://apiv3.sportsapi360.com/football/api/v1/matches";

// Helfer: Spiele von SportsAPI360 abrufen
async function fetchGames(date) {
  const url = date ? `${BASE_URL}?date=${date}` : `${BASE_URL}?status=live`;
  console.log("📅 Lade Spiele von SportsAPI360:", url);

  const response = await fetch(url, {
    headers: { "x-app-key": API_KEY },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API Fehler ${response.status}: ${text.slice(0, 200)}`);
  }

  const data = await response.json();
  return data?.data || [];
}

// Endpoint für Spiele
app.get("/api/games", async (req, res) => {
  try {
    const date = req.query.date; // optionales Datum
    const matches = await fetchGames(date);

    if (!matches.length) {
      return res.json({ response: [] });
    }

    const games = matches.map((m) => ({
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
        under25: 1 - (m.probabilities?.over_2_5 || 0),
      },
      trend: m.trend || "neutral",
      btts: m.probabilities?.btts || 0,
    }));

    res.json({ response: games });
  } catch (err) {
    console.error("❌ Fehler beim Laden der Spiele:", err.message);
    res.status(500).json({ error: "Serverfehler", details: err.message });
  }
});

// Root-Endpoint
app.get("/", (req, res) => {
  res.send(`
    <h1>⚽ Value Tool Backend</h1>
    <p>Das Backend läuft. <a href="/api/games">API testen</a></p>
  `);
});

app.listen(PORT, () => {
  console.log(`🚀 Server läuft auf Port ${PORT} (echte SportsAPI360 Daten)`);
});

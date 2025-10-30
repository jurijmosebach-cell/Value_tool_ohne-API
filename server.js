import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.static("public"));

const API_KEY = process.env.SPORTSAPI360_KEY;
const BASE_URL = "https://api.sportsapi360.com/soccer";

// Hilfsfunktion: API-Request
async function getFromAPI(endpoint, params = {}) {
  const url = new URL(`${BASE_URL}/${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));

  const res = await fetch(url, {
    headers: {
      "x-api-key": API_KEY,
      accept: "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("❌ API-Fehler:", text.slice(0, 200));
    throw new Error(`API-Fehler: ${res.status}`);
  }

  const data = await res.json();
  return data;
}

// 🔢 xG-basierte Value-Berechnung
function calculateValue(homeXG, awayXG) {
  const totalXG = homeXG + awayXG;
  const homeProb = homeXG / totalXG;
  const awayProb = awayXG / totalXG;
  const drawProb = 1 - (homeProb + awayProb) / 2;

  return {
    home: homeProb,
    draw: drawProb,
    away: awayProb,
    over25: totalXG / 3,
    under25: 1 - totalXG / 3,
  };
}

// 📅 Route: Spiele eines Datums abrufen
app.get("/api/games", async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split("T")[0];
    console.log(`📅 Lade Spiele für ${date}`);

    const apiData = await getFromAPI("fixtures", { date });

    if (!apiData?.response || !Array.isArray(apiData.response))
      return res.json({ response: [] });

    const games = apiData.response.map((m) => {
      const homeXG = m.stats?.home?.xG ?? Math.random() * 1.8 + 0.2;
      const awayXG = m.stats?.away?.xG ?? Math.random() * 1.8 + 0.2;
      const value = calculateValue(homeXG, awayXG);

      return {
        league: m.league?.name || "Unbekannt",
        home: m.teams?.home?.name || "Heimteam",
        away: m.teams?.away?.name || "Auswärtsteam",
        date: m.fixture?.date || date,
        homeLogo: m.teams?.home?.logo || "",
        awayLogo: m.teams?.away?.logo || "",
        homeXG,
        awayXG,
        trend:
          homeXG > awayXG ? "home" : awayXG > homeXG ? "away" : "neutral",
        prob: {
          home: value.home,
          draw: value.draw,
          away: value.away,
          over25: value.over25,
        },
        value,
        btts: Math.min(1, (homeXG * awayXG) / 2),
      };
    });

    res.json({ response: games });
  } catch (err) {
    console.error("❌ Fehler beim Laden:", err.message);
    res.status(500).json({ error: "Fehler beim Laden der Spiele" });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () =>
  console.log(`🚀 Server läuft auf Port ${PORT} (SportsAPI360 aktiv)`)
);

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
const API_KEY = process.env.SPORTSAPI360_KEY;

app.use(express.static("public"));

// 📊 API-Route für Spiele (SportsAPI360)
app.get("/api/games", async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split("T")[0];
    console.log(`📅 Lade Spiele für ${date}...`);

    const url = `https://sportsapi360.com/soccer/matches?date=${date}`;
    const response = await fetch(url, {
      headers: { "x-api-key": API_KEY },
    });

    if (!response.ok) {
      throw new Error(`Fehler ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data || !data.data) {
      return res.status(500).json({ error: "Ungültige API-Antwort", data });
    }

    // Vereinfache Struktur
    const games = data.data.map((g) => ({
      id: g.id,
      league: g.league?.name,
      home: g.home_team?.name,
      away: g.away_team?.name,
      date: g.match_start,
      homeLogo: g.home_team?.logo,
      awayLogo: g.away_team?.logo,
      status: g.status,
      value: {
        home: Math.random() * 0.4,
        draw: Math.random() * 0.3,
        away: Math.random() * 0.4,
        over25: Math.random(),
        under25: Math.random(),
      },
      trend: ["home", "draw", "away"][Math.floor(Math.random() * 3)],
    }));

    res.json({ response: games });
  } catch (err) {
    console.error("❌ Fehler bei API:", err);
    res.status(500).json({ error: "Fehler beim Abrufen der Spiele" });
  }
});

// 📁 Fallback auf index.html
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () =>
  console.log(`🚀 Server läuft auf Port ${PORT} (SportsAPI360 aktiv)`)
);

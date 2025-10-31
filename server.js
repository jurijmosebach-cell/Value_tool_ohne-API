import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Statische Dateien bereitstellen (index.html, app.js, style.css)
app.use(express.static(path.join(__dirname)));

// Environment Variables
const API_KEY = process.env.SPORTSAPI_KEY; // Setze deinen API Key in Render
const API_URL = "https://apiv3.sportsapi360.com/football/api/v1";
const PORT = process.env.PORT || 10000;

// API-Endpunkt: Spiele laden
app.get("/api/games", async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    console.log("📅 Lade Spiele für", date);

    // Echte API abfragen
    const response = await fetch(`${API_URL}/matches?date=${date}`, {
      headers: { "x-app-key": API_KEY },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("❌ Fehler /api/games:", response.status, response.statusText, "-", text.slice(0, 200));
      return res.status(response.status).json({ error: "API Fehler", details: text });
    }

    const data = await response.json();
    const matches = data?.response || [];

    // Relevante Felder extrahieren
    const games = matches.map(m => ({
      home: m.home_team?.name || "Unbekannt",
      away: m.away_team?.name || "Unbekannt",
      league: m.league?.name || "Unbekannte Liga",
      date: m.fixture?.date || new Date(),
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
    console.error("❌ Server Fehler /api/games:", err);
    res.status(500).json({ error: "Serverfehler", details: err.message });
  }
});

// Index-Seite ausliefern
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Server starten
app.listen(PORT, () => {
  console.log(`🚀 Server läuft auf Port ${PORT} (Frontend + API bereit)`);
});

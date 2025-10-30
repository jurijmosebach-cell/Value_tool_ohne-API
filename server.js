// server.js
import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// === Middleware ===
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // Serviert index.html, app.js, etc. aus Root

// === API Config ===
const API_KEY = process.env.SPORTSAPI_KEY;
const PORT = process.env.PORT || 10000;

// Basis-URL für Live Matches
const LIVE_URL = "https://apiv3.sportsapi360.com/football/api/v1/matches/live";

// === API Endpoint: /api/games ===
app.get("/api/games", async (req, res) => {
  try {
    const date = req.query.date;
    console.log("Lade Spiele für:", date ? date : "LIVE");

    // Bestimme URL: Datum oder Live
    let url = LIVE_URL;
    if (date) {
      // Falls Datum angegeben → versuche Datum-Endpoint
      url = `https://apiv3.sportsapi360.com/football/api/v1/matches?date=${date}`;
    }

    console.log("API Request →", url);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Accept": "application/json",
        "Content-Type": "application/json"
      },
    });

    console.log("API Status:", response.status);

    if (!response.ok) {
      const text = await response.text();
      console.error("API Fehler:", response.status, text.slice(0, 300));
      return res.status(response.status).json({
        error: "API nicht erreichbar",
        details: text.slice(0, 200),
      });
    }

    const data = await response.json();
    console.log("API Erfolg – Matches:", data.response?.length || 0);

    // Datenstruktur aus Docs: data.response = Array von Matches
    const matches = data.response || [];

    // Transformiere in Frontend-Format
    const games = matches.map((m) => ({
      home: m.home?.name || m.participant?.home?.name || "Unbekannt",
      away: m.away?.name || m.participant?.away?.name || "Unbekannt",
      league: m.tournament?.name || m.competition?.name || "Unbekannte Liga",
      date: m.start_time || m.fixture?.date || new Date().toISOString(),
      homeLogo: m.home?.logo || m.participant?.home?.logo,
      awayLogo: m.away?.logo || m.participant?.away?.logo,
      score: {
        home: m.score?.home || 0,
        away: m.score?.away || 0,
      },
      status: m.status || "LIVE",
      last_event: m.last_event || "",

      // Value & Predictions (temporär – später echte Daten)
      value: {
        home: Math.random(),
        draw: Math.random(),
        away: Math.random(),
        over25: Math.random(),
        under25: Math.random(),
      },
      trend: ["home", "away", "neutral"][Math.floor(Math.random() * 3)],
      btts: Math.random(),
    }));

    res.json({ response: games });
  } catch (err) {
    console.error("Serverfehler:", err);
    res.status(500).json({
      error: "Interner Serverfehler",
      details: err.message,
    });
  }
});

// === Root: index.html servieren ===
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// === 404 Fallback ===
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, "index.html"));
});

// === Server starten ===
app.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
  console.log(`Live: http://localhost:${PORT}`);
});

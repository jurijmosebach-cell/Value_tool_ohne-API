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

// FIX: Richtige URL aus offiziellen Docs (kein /v3, kein /live)
const API_BASE = "https://api.sportsapi360.com/v1/football/matches";

// === API Endpoint: /api/games ===
app.get("/api/games", async (req, res) => {
  try {
    const date = req.query.date;
    console.log("Lade Spiele für:", date ? date : "alle Matches");

    // URL bauen: Basis + Datum-Param (falls vorhanden)
    let url = API_BASE;
    if (date) {
      url += `?date=${date}`;  // Oder ?from=...&to=... – passe an Docs an
    }

    console.log("API Request →", url);
    console.log("🔑 API-Key vorhanden:", !!API_KEY ? "Ja" : "NEIN!");  // Debug

    if (!API_KEY) {
      return res.status(500).json({ error: "API-Key fehlt in Environment" });
    }

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
        error: "API nicht erreichbar (502 = Server-Fehler bei SportsAPI360)",
        details: text.slice(0, 200),
        tip: "Prüfe Token/Docs oder teste mit aktuellem Datum (nicht 2025!)"
      });
    }

    const data = await response.json();
    console.log("API Erfolg – Matches:", data.response?.length || 0);

    // Datenstruktur: data.response = Array von Matches (aus Docs)
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
      status: m.status || "UPCOMING",
      last_event: m.last_event || "",

      // Value & Predictions (temporär – später echte aus API)
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

    // Fallback: Wenn keine Matches (z. B. zukünftiges Datum), generiere Test-Daten
    if (games.length === 0) {
      console.log("Keine Matches – generiere Test-Daten");
      games.push({
        home: "Bayern München",
        away: "Borussia Dortmund",
        league: "Bundesliga",
        date: new Date().toISOString(),
        score: { home: 2, away: 1 },
        status: "LIVE",
        value: { home: 0.6, draw: 0.2, away: 0.2, over25: 0.7, under25: 0.3 },
        trend: "home",
        btts: 0.8,
        homeLogo: "https://example.com/bayern.png",
        awayLogo: "https://example.com/dortmund.png"
      });
    }

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

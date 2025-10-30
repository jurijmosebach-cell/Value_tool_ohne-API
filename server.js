import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 10000;
const API_KEY = process.env.SPORTSAPI360_KEY;

app.use(express.static("public"));

// 🔹 API-Route für Spiele
app.get("/api/games", async (req, res) => {
  try {
    const dateParam = req.query.date || new Date().toISOString().split("T")[0];
    console.log(`📅 Lade Spiele für Datum: ${dateParam}`);

    const url = `https://sportsapi360.com/api/football/matches?date=${dateParam}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });

    if (!response.ok) {
      console.error(`❌ Fehler: ${response.status}`);
      return res.status(500).json({ error: "Fehler beim Abrufen der Spiele" });
    }

    const data = await response.json();

    // Wenn die API leeres oder unerwartetes Format liefert
    if (!data || !Array.isArray(data.matches)) {
      console.warn("⚠️ Keine oder ungültige Daten erhalten");
      return res.json({ response: [] });
    }

    // 🔹 Spiele normalisieren
    const formatted = data.matches.map(m => ({
      date: m.utc_date,
      league: m.league?.name || "Unbekannt",
      home: m.home_team?.name,
      away: m.away_team?.name,
      homeLogo: m.home_team?.logo,
      awayLogo: m.away_team?.logo,
      value: {
        home: m.probabilities?.home_win ?? 0,
        draw: m.probabilities?.draw ?? 0,
        away: m.probabilities?.away_win ?? 0,
        over25: m.probabilities?.over_25 ?? 0,
        under25: m.probabilities?.under_25 ?? 0
      },
      trend: m.stats?.momentum ?? "neutral",
      homeXG: m.stats?.home_xg ?? 0,
      awayXG: m.stats?.away_xg ?? 0,
      btts: m.probabilities?.btts ?? 0
    }));

    res.json({ response: formatted });
  } catch (err) {
    console.error("💥 Fehler:", err.message);
    res.status(500).json({ error: "Interner Serverfehler" });
  }
});

// 🔹 Fallback für Frontend
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`🚀 Server läuft auf Port ${PORT} (SportsAPI360 aktiv)`);
});

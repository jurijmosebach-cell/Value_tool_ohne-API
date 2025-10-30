import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;
const API_KEY = process.env.SPORTSAPI360_KEY;

// Test-Log beim Start
console.log(`🚀 Server läuft auf Port ${PORT} (SportsAPI360 aktiv)`);

// 🧠 Hilfsfunktion: Spiele für bestimmtes Datum abrufen
async function ladeSpiele(datum = null) {
  try {
    const today = datum || new Date().toISOString().split("T")[0];

    console.log(`⏳ Lade Spiele von SportsAPI360 für Datum: ${today}`);

    const leagues = [
      195, // Premier League
      207, // Bundesliga
      216, // Serie A
      237, // La Liga
      244, // Ligue 1
    ];

    const spiele = [];

    for (const liga of leagues) {
      const url = `https://sportsapi360.com/api/v1/football/fixtures?league_id=${liga}&date=${today}`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          Accept: "application/json",
        },
      });

      if (!res.ok) {
        console.error(`❌ Fehler bei Liga ${liga}: ${res.status}`);
        continue;
      }

      const json = await res.json();
      if (!json || !json.data) {
        console.error(`❌ Keine gültigen Daten für Liga ${liga}`);
        continue;
      }

      for (const m of json.data) {
        spiele.push({
          id: m.id,
          league: m.league?.name || "Unbekannt",
          date: m.date,
          home: m.home_team?.name || "Heim",
          away: m.away_team?.name || "Auswärts",
          homeLogo: m.home_team?.logo || "",
          awayLogo: m.away_team?.logo || "",
          value: {
            home: Math.random().toFixed(2),
            draw: Math.random().toFixed(2),
            away: Math.random().toFixed(2),
            over25: Math.random().toFixed(2),
            under25: Math.random().toFixed(2),
          },
          trend: ["home", "draw", "away"][Math.floor(Math.random() * 3)],
          btts: Math.random().toFixed(2),
          homeXG: (Math.random() * 2).toFixed(2),
          awayXG: (Math.random() * 2).toFixed(2),
        });
      }
    }

    return spiele;
  } catch (err) {
    console.error("❌ Fehler beim Laden der Spiele:", err);
    return [];
  }
}

// 🧩 API-Endpoint
app.get("/api/games", async (req, res) => {
  const datum = req.query.date || null;
  const spiele = await ladeSpiele(datum);
  res.json({ response: spiele });
});

// 🧩 Root-Route (statt public/index.html)
app.get("/", (req, res) => {
  res.send("🚀 SportsAPI360-Backend aktiv! Verwende /api/games für aktuelle Spiele.");
});

// 🧩 Serverstart
app.listen(PORT, () => {
  console.log(`✅ Backend läuft unter Port ${PORT}`);
});

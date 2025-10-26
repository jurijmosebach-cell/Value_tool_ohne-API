import express from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.static(__dirname));

const PORT = process.env.PORT || 10000;

// Funktion, um die Spiele-Daten von einer öffentlichen API zu laden
async function fetchMatchData(date) {
  try {
    // Hier kannst du die URL der öffentlichen API einfügen
    const url = `https://api.football-data.org/v2/matches?date=${date}`; // Beispiel-URL für eine API
    const { data } = await axios.get(url, { headers: { 'X-Auth-Token': 'DEIN_API_SCHLÜSSEL' } }); // API-Schlüssel falls benötigt
    
    // Falls du die Antwort mit Fehlern prüfst
    console.log("Antwort von API:", data);

    const games = data.matches.map(match => ({
      home: match.homeTeam.name,
      away: match.awayTeam.name,
      odds: {
        home: 1.5, // Beispielwerte, falls du echte Odds verwenden willst, pass sie hier an
        draw: 3.2,
        away: 2.8
      },
      homeXG: Math.random() * 2, // Beispiel für xG-Werte
      awayXG: Math.random() * 2
    }));

    return games;
  } catch (error) {
    console.error("Fehler beim Abrufen der Daten:", error);
    throw error;
  }
}

// API-Endpunkt für Spiele
app.get('/api/games', async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const games = await fetchMatchData(date);

    res.json({ response: games });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Abrufen der Spiele' });
  }
});

// Den Rest der Webseite bereitstellen
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`XG Value Tool läuft auf http://localhost:${PORT}`);
});

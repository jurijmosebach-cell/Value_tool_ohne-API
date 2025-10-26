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

// Beispiel für eine öffentliche API, die keine Authentifizierung erfordert
async function fetchMatchData(date) {
  try {
    // Verwende eine öffentliche API oder einen Web-Scraping-Service
    const url = `https://example.com/api/matches?date=${date}`; // Beispiel-URL für öffentliche API
    const { data } = await axios.get(url);

    // Extrahiere nur die relevanten Informationen
    const games = data.matches.map(match => ({
      home: match.homeTeam,
      away: match.awayTeam,
      odds: match.odds,
      homeXG: match.homeXG,
      awayXG: match.awayXG
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

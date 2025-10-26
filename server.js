// server.js
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
app.use(express.static(__dirname));

const PORT = process.env.PORT || 10000;
const API_KEY = process.env.FOOTBALL_DATA_API_KEY;
if (!API_KEY) {
  console.warn("⚠️  WARNING: FOOTBALL_DATA_API_KEY is not set. API requests will fail.");
}

// league -> competition code for football-data.org v4
const LEAGUES = {
  "Premier League": "PL",
  "Bundesliga": "BL1",
  "La Liga": "PD",
  "Serie A": "SA",
  "Ligue 1": "FL1"
};

// Cache
let cache = { timestamp: 0, data: [] };
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

function getFlag(team) {
  const flags = {
    "Manchester": "gb","Liverpool":"gb","Chelsea":"gb","Arsenal":"gb","Man United":"gb","Tottenham":"gb","Newcastle":"gb",
    "Bayern":"de","Dortmund":"de","Leipzig":"de","Gladbach":"de","Frankfurt":"de","Leverkusen":"de",
    "Real":"es","Barcelona":"es","Atletico":"es","Sevilla":"es","Valencia":"es","Villarreal":"es",
    "Juventus":"it","Inter":"it","Milan":"it","Napoli":"it","Roma":"it","Lazio":"it",
    "PSG":"fr","Marseille":"fr","Monaco":"fr","Lyon":"fr","Rennes":"fr","Nice":"fr"
  };
  const countries = {
    "England":"gb","Germany":"de","Spain":"es","Italy":"it","France":"fr","USA":"us","Turkey":"tr",
    "Australia":"au","Belgium":"be","Brazil":"br","China":"cn","Denmark":"dk","Japan":"jp",
    "Netherlands":"nl","Norway":"no","Sweden":"se"
  };

  for (const [name, flag] of Object.entries(flags)) if (team.includes(name)) return flag;
  for (const [country, flag] of Object.entries(countries)) if (team.includes(country)) return flag;
  return "eu";
}

// Helper: fetch matches for a league in a date window (uses football-data.org v4)
async function fetchMatchesForLeague(compCode, dateFrom, dateTo) {
  if (!API_KEY) return []; // avoid throwing — return empty so cache still works
  const url = `https://api.football-data.org/v4/matches?competitions=${compCode}&dateFrom=${dateFrom}&dateTo=${dateTo}`;
  const res = await fetch(url, { headers: { "X-Auth-Token": API_KEY }});
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API Error ${res.status}: ${text}`);
  }
  const data = await res.json();
  // data.matches is an array
  return data.matches || [];
}

function formatDateISO(d) {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function refreshCache() {
  const now = Date.now();
  console.log("🔁 Aktualisiere Spiele (football-data.org)...");
  const games = [];

  // fetch matches for next 3 days (today..+2) to cover upcoming fixtures
  const from = new Date();
  const to = new Date();
  to.setDate(to.getDate() + 2);

  const dateFrom = formatDateISO(from);
  const dateTo = formatDateISO(to);

  for (const [leagueName, compCode] of Object.entries(LEAGUES)) {
    try {
      const matches = await fetchMatchesForLeague(compCode, dateFrom, dateTo);
      matches.forEach(m => {
        const home = m.homeTeam?.name || "Home";
        const away = m.awayTeam?.name || "Away";

        // basic xG simulation (since football-data.org may not provide xG)
        const homeXG = +(0.6 + Math.random() * 1.6).toFixed(2);
        const awayXG = +(0.6 + Math.random() * 1.6).toFixed(2);
        const totalXG = +(homeXG + awayXG).toFixed(2);

        const prob = {
          home: +(homeXG / totalXG).toFixed(2),
          away: +(awayXG / totalXG).toFixed(2),
          draw: +((1 - (homeXG / totalXG + awayXG / totalXG)) > 0 ? (1 - (homeXG / totalXG + awayXG / totalXG)).toFixed(2) : 0).toFixed(2),
          over25: +(0.55 + Math.random() * 0.15).toFixed(2),
          under25: +(1 - (0.55 + Math.random() * 0.15)).toFixed(2)
        };

        const odds = {
          home: +(1.6 + Math.random() * 1.2).toFixed(2),
          draw: +(2 + Math.random() * 1.2).toFixed(2),
          away: +(1.7 + Math.random() * 1.3).toFixed(2),
          over25: +(1.8 + Math.random() * 0.5).toFixed(2),
          under25: +(1.9 + Math.random() * 0.5).toFixed(2)
        };

        const value = {
          home: +(prob.home * odds.home - 1).toFixed(2),
          draw: +(prob.draw * odds.draw - 1).toFixed(2),
          away: +(prob.away * odds.away - 1).toFixed(2),
          over25: +(prob.over25 * odds.over25 - 1).toFixed(2),
          under25: +(prob.under25 * odds.under25 - 1).toFixed(2)
        };

        games.push({
          id: m.id || `${leagueName}-${home}-${away}-${m.utcDate}`,
          home,
          away,
          league: leagueName,
          utcDate: m.utcDate,
          homeLogo: `https://flagcdn.com/48x36/${getFlag(home)}.png`,
          awayLogo: `https://flagcdn.com/48x36/${getFlag(away)}.png`,
          odds,
          value,
          totalXG,
          homeXG,
          awayXG,
          prob
        });
      });
    } catch (err) {
      console.error(`Fehler beim Laden von ${leagueName}:`, err.message);
    }
  }

  cache = { timestamp: now, data: games };
  console.log(`✅ Cache aktualisiert (${games.length} Spiele).`);
}

// Initial cache fill & schedule updates
(async () => {
  try {
    await refreshCache();
  } catch (e) {
    console.error("Initiales Cache-Update fehlgeschlagen:", e.message);
  }
  setInterval(refreshCache, CACHE_DURATION);
})();

// API Endpoint
app.get("/api/games", (req, res) => {
  res.json({ response: cache.data });
});

// Serve SPA
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => console.log(`🚀 Server läuft auf Port ${PORT}`));

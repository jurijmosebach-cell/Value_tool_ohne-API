import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
app.use(express.static(__dirname));

const PORT = process.env.PORT || 10000;
const API_KEY = process.env.SOCCER_API_KEY || "";

let cache = { timestamp: 0, date: null, data: [] };
const CACHE_DURATION = 15 * 60 * 1000;

// Beispielhafte Ligen (IDs je nach API ggf. anpassen)
const LEAGUES = [195, 237, 244, 207, 216];

// --- Utility Funktionen ---
function factorial(n){ return n <= 1 ? 1 : n * factorial(n - 1); }
function poisson(k, lambda){ return Math.pow(lambda, k) * Math.exp(-lambda) / factorial(k); }

function computeMatchOutcomeProbs(homeLambda, awayLambda){
  let homeProb = 0, drawProb = 0, awayProb = 0;
  for(let i=0;i<=7;i++){
    const pHome = poisson(i, homeLambda);
    for(let j=0;j<=7;j++){
      const pAway = poisson(j, awayLambda);
      const p = pHome * pAway;
      if(i>j) homeProb += p;
      else if(i===j) drawProb += p;
      else awayProb += p;
    }
  }
  const total = homeProb + drawProb + awayProb;
  return { home: +(homeProb/total).toFixed(4), draw: +(drawProb/total).toFixed(4), away: +(awayProb/total).toFixed(4) };
}

function computeOver25Prob(homeLambda, awayLambda){
  let pLe2 = 0;
  for(let i=0;i<=2;i++){
    const ph = poisson(i, homeLambda);
    for(let j=0;j<=2;j++){
      if(i+j<=2) pLe2 += ph * poisson(j, awayLambda);
    }
  }
  return +(1 - pLe2).toFixed(4);
}

// --- Spiele abrufen ---
async function fetchGamesFromSoccerAPI(date){
  const allGames = [];

  for(const leagueId of LEAGUES){
    try {
      const url = `https://app.sportdataapi.com/api/v1/soccer/matches?apikey=${API_KEY}&season_id=${leagueId}&date=${date}`;
      const res = await fetch(url);
      const data = await res.json();

      if(!data || !data.data) continue;

      data.data.forEach(m => {
        const home = m.home_team?.name || "Home";
        const away = m.away_team?.name || "Away";
        const homeXG = +(0.8 + Math.random()*1.6).toFixed(2);
        const awayXG = +(0.6 + Math.random()*1.6).toFixed(2);
        const probs = computeMatchOutcomeProbs(homeXG, awayXG);
        const over25 = computeOver25Prob(homeXG, awayXG);

        const odds = {
          home: +(1.6 + Math.random()*1.6).toFixed(2),
          draw: +(2.0 + Math.random()*1.5).toFixed(2),
          away: +(1.7 + Math.random()*1.6).toFixed(2),
          over25: +(1.7 + Math.random()*0.7).toFixed(2),
          under25: +(1.8 + Math.random()*0.7).toFixed(2)
        };

        const value = {
          home: +((probs.home*odds.home)-1).toFixed(4),
          draw: +((probs.draw*odds.draw)-1).toFixed(4),
          away: +((probs.away*odds.away)-1).toFixed(4),
          over25: +((over25*odds.over25)-1).toFixed(4),
          under25: +(((1-over25)*odds.under25)-1).toFixed(4)
        };

        let trend = "neutral";
        const mainVal = Math.max(value.home,value.draw,value.away);
        if(mainVal>0.12 && probs.home>probs.away && probs.home>probs.draw) trend="home";
        else if(mainVal>0.12 && probs.away>probs.home && probs.away>probs.draw) trend="away";
        else if(Math.abs(probs.home-probs.away)<0.08 && probs.draw>=Math.max(probs.home,probs.away)) trend="draw";

        allGames.push({
          id: m.match_id,
          date: m.match_start,
          league: m.league?.name || "Unbekannt",
          home, away,
          homeXG, awayXG,
          prob: probs, value, trend
        });
      });
    } catch (err) {
      console.error(`❌ Fehler beim Abrufen der Liga ${leagueId}:`, err.message);
    }
  }

  allGames.sort((a,b) => new Date(a.date) - new Date(b.date));
  return allGames;
}

// --- API Route ---
app.get("/api/games", async (req, res) => {
  try {
    const queryDate = req.query.date || new Date().toISOString().split("T")[0];
    const force = req.query.refresh === "true";
    const now = Date.now();

    const cacheValid = cache.date === queryDate && (now - cache.timestamp < CACHE_DURATION) && !force;
    if(cacheValid) {
      return res.json({ response: cache.data });
    }

    console.log("⏳ Lade neue Spiele für Datum:", queryDate);
    const games = await fetchGamesFromSoccerAPI(queryDate);
    cache = { timestamp: now, date: queryDate, data: games };

    res.json({ response: games });
  } catch (err) {
    console.error("API Fehler:", err);
    res.status(500).json({ response: [], error: err.message });
  }
});

// --- Serve Frontend ---
app.get("*", (req,res)=>res.sendFile(path.join(__dirname,"index.html")));

app.listen(PORT, ()=>console.log(`🚀 Server läuft auf Port ${PORT}`));

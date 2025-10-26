import express from "express";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
app.use(express.static(__dirname));

const PORT = process.env.PORT || 10000;
const API_KEY = process.env.FOOTBALL_DATA_API_KEY;

if(!API_KEY){
  console.warn("⚠️ FOOTBALL_DATA_API_KEY ist nicht gesetzt. API-Requests werden fehlschlagen.");
}

// Cache
let cache = { timestamp: 0, data: [] };
const CACHE_DURATION = 15*60*1000; // 15 Min

// Ligen + football-data.org competition codes
const LEAGUES = {
  "Premier League":"PL",
  "Bundesliga":"BL1",
  "2. Bundesliga":"BL2",
  "La Liga":"PD",
  "Serie A":"SA",
  "Ligue 1":"FL1",
  "Eredivisie":"DED",
  "Süper Lig":"TUR",
  "Allsvenskan":"SWE",
  "Eliteserien":"NOR",
  "Brasileirão":"BSA"
};

// Hilfsfunktionen
function getFlag(team){
  const flags = {
    "Manchester":"gb","Liverpool":"gb","Chelsea":"gb","Arsenal":"gb","Man United":"gb","Tottenham":"gb",
    "Bayern":"de","Dortmund":"de","Leipzig":"de","Gladbach":"de","Frankfurt":"de","Leverkusen":"de",
    "Real":"es","Barcelona":"es","Atletico":"es","Sevilla":"es","Valencia":"es","Villarreal":"es",
    "Juventus":"it","Inter":"it","Milan":"it","Napoli":"it","Roma":"it","Lazio":"it",
    "PSG":"fr","Marseille":"fr","Monaco":"fr","Lyon":"fr","Rennes":"fr","Nice":"fr"}
  const countries = {
    "England":"gb","Germany":"de","Spain":"es","Italy":"it","France":"fr","USA":"us","Turkey":"tr",
    "Australia":"au","Belgium":"be","Brazil":"br","China":"cn","Denmark":"dk","Japan":"jp",
    "Netherlands":"nl","Norway":"no","Sweden":"se"
  };
  for(const [name, flag] of Object.entries(flags)) if(team.includes(name)) return flag;
  for(const [country, flag] of Object.entries(countries)) if(team.includes(country)) return flag;
  return "eu"; // default
}

// API Route
app.get("/api/games", async (req,res)=>{
  const now = Date.now();
  if(now - cache.timestamp < CACHE_DURATION && cache.data.length>0){
    return res.json({response: cache.data});
  }

  try{
    const games = [];
    const today = new Date();
    const from = today.toISOString().split("T")[0]; // yyyy-mm-dd
    const toDate = new Date(today.getTime() + 3*24*60*60*1000);
    const to = toDate.toISOString().split("T")[0];

    for(const [leagueName, code] of Object.entries(LEAGUES)){
      const url = `https://api.football-data.org/v4/competitions/${code}/matches?dateFrom=${from}&dateTo=${to}`;
      const resp = await fetch(url,{headers:{"X-Auth-Token":API_KEY}});
      if(!resp.ok) continue;
      const data = await resp.json();

      for(const m of data.matches){
        // Nur Spiele, die nicht beendet sind
        if(m.status === "FINISHED") continue;

        const homeXG = +(Math.random()*2).toFixed(2);
        const awayXG = +(Math.random()*2).toFixed(2);
        const totalXG = homeXG + awayXG;

        const prob = {
          home: +(homeXG/totalXG).toFixed(2),
          away: +(awayXG/totalXG).toFixed(2),
          draw: +(1-(homeXG/totalXG + awayXG/totalXG)).toFixed(2),
          over25: +(0.55 + Math.random()*0.15).toFixed(2),
          under25: +(1-(0.55 + Math.random()*0.15)).toFixed(2),
          BTTS: +(0.5 + Math.random()*0.4).toFixed(2)
        };

        const odds = {
          home: +(1.8 + Math.random()*1).toFixed(2),
          draw: +(2 + Math.random()*1).toFixed(2),
          away: +(1.9 + Math.random()*1).toFixed(2),
          over25: +(1.8 + Math.random()*0.5).toFixed(2),
          under25: +(1.9 + Math.random()*0.5).toFixed(2),
          BTTS: +(1.9 + Math.random()*0.5).toFixed(2)
        };

        const value = {
          home: +(prob.home*odds.home-1).toFixed(2),
          draw: +(prob.draw*odds.draw-1).toFixed(2),
          away: +(prob.away*odds.away-1).toFixed(2),
          over25: +(prob.over25*odds.over25-1).toFixed(2),
          under25: +(prob.under25*odds.under25-1).toFixed(2),
          BTTS: +(prob.BTTS*odds.BTTS-1).toFixed(2)
        };

        // Trend: Home/Away/Draw
        let trend="neutral";
        if(value.home > value.away && value.home > value.draw) trend="home";
        else if(value.away > value.home && value.away > value.draw) trend="away";
        else if(value.draw > value.home && value.draw > value.away) trend="draw";

        games.push({
          home: m.homeTeam.name,
          away: m.awayTeam.name,
          league: leagueName,
          utcDate: m.utcDate,
          homeLogo:`https://flagcdn.com/48x36/${getFlag(m.homeTeam.name)}.png`,
          awayLogo:`https://flagcdn.com/48x36/${getFlag(m.awayTeam.name)}.png`,
          homeXG, awayXG, totalXG,
          prob, odds, value, trend
        });
      }
    }

    // sortiere nach Datum & Trend Top Spiele zuerst
    games.sort((a,b)=>{
      const dateDiff = new Date(a.utcDate) - new Date(b.utcDate);
      if(dateDiff!==0) return dateDiff;
      const trendOrder = {"home":1,"away":2,"draw":3,"neutral":4};
      return trendOrder[a.trend]-trendOrder[b.trend];
    });

    cache = { timestamp: now, data: games };
    res.json({response: games});

  }catch(err){
    console.error("API Fehler:",err);
    res.status(500).json({response:[],error:err.message});
  }
});

app.get("*",(req,res)=>{
  res.sendFile(path.join(__dirname,"index.html"));
});

app.listen(PORT,()=>console.log(`Server läuft auf Port ${PORT}`));

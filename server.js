import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
app.use(express.static(__dirname));

const PORT = process.env.PORT || 10000;
const FOOTBALL_DATA_KEY = process.env.FOOTBALL_DATA_API_KEY;

let cache = { timestamp: 0, data: [] };
const CACHE_DURATION = 15*60*1000; // 15 Minuten

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
  return "eu";
}

// Example leagues
const LEAGUE_IDS = {
  "PL": 2021,
  "BL": 2002,
  "LL": 2014,
  "SA": 2019,
  "L1": 2015
};

async function fetchGames() {
  if(!FOOTBALL_DATA_KEY) return [];

  const headers = { "X-Auth-Token": FOOTBALL_DATA_KEY };
  let games = [];
  for(const [leagueName, id] of Object.entries(LEAGUE_IDS)){
    const res = await fetch(`https://api.football-data.org/v4/competitions/${id}/matches?status=SCHEDULED`,{ headers });
    const data = await res.json();
    data.matches.forEach(m=>{
      const homeXG = +(1 + Math.random()*1).toFixed(2);
      const awayXG = +(1 + Math.random()*1).toFixed(2);
      const totalXG = homeXG + awayXG;

      const prob = {
        home: homeXG/totalXG,
        away: awayXG/totalXG,
        draw: 1 - (homeXG/totalXG + awayXG/totalXG),
        over25: 0.55 + Math.random()*0.15,
        under25: 1-(0.55 + Math.random()*0.15)
      };

      const odds = {
        home: +(1.8 + Math.random()*1).toFixed(2),
        draw: +(2 + Math.random()*1).toFixed(2),
        away: +(1.9 + Math.random()*1).toFixed(2),
        over25: +(1.8 + Math.random()*0.5).toFixed(2),
        under25: +(1.9 + Math.random()*0.5).toFixed(2)
      };

      const value = {
        home: +(prob.home*odds.home-1).toFixed(2),
        draw: +(prob.draw*odds.draw-1).toFixed(2),
        away: +(prob.away*odds.away-1).toFixed(2),
        over25: +(prob.over25*odds.over25-1).toFixed(2),
        under25: +(prob.under25*odds.under25-1).toFixed(2)
      };

      const homeProbGoal = 1 - Math.exp(-homeXG);
      const awayProbGoal = 1 - Math.exp(-awayXG);
      const bttsProb = +(homeProbGoal * awayProbGoal).toFixed(2);

      games.push({
        id: m.id,
        home: m.homeTeam.name,
        away: m.awayTeam.name,
        league: leagueName,
        homeLogo:`https://flagcdn.com/48x36/${getFlag(m.homeTeam.name)}.png`,
        awayLogo:`https://flagcdn.com/48x36/${getFlag(m.awayTeam.name)}.png`,
        odds,value,totalXG:+totalXG.toFixed(2),
        homeXG:+homeXG.toFixed(2),
        awayXG:+awayXG.toFixed(2),
        prob,
        btts:bttsProb,
        trend:"neutral"
      });
    });
  }
  return games;
}

// Cache + API
app.get("/api/games", async (req,res)=>{
  const now = Date.now();
  if(now - cache.timestamp < CACHE_DURATION && cache.data.length>0){
    return res.json({ response: cache.data });
  }
  try {
    const games = await fetchGames();

    // Top Listen
    const top7Value = [...games].sort((a,b)=>Math.max(b.value.home,b.value.draw,b.value.away)-Math.max(a.value.home,a.value.draw,a.value.away)).slice(0,7);
    const top5Over25 = [...games].sort((a,b)=>b.value.over25 - a.value.over25).slice(0,5);

    cache = { timestamp: now, data: games };
    res.json({ response: games, top7Value, top5Over25 });
  } catch(err){
    console.error(err);
    res.status(500).json({ response:[], top7Value:[], top5Over25:[], error:err.message });
  }
});

app.get("*",(req,res)=>{
  res.sendFile(path.join(__dirname,"index.html"));
});

app.listen(PORT,()=>console.log(`Server läuft auf Port ${PORT}`));

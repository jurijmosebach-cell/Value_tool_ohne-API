import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
app.use(express.static(__dirname));

const PORT = process.env.PORT || 10000;
const API_KEY = process.env.FOOTBALL_DATA_API_KEY;
if(!API_KEY) console.warn("⚠️ FOOTBALL_DATA_API_KEY ist nicht gesetzt!");

const LEAGUES = {
  "Premier League":"PL",
  "Bundesliga":"BL1",
  "2. Bundesliga":"BL2",
  "La Liga":"PD",
  "Serie A":"SA",
  "Ligue 1":"FL1"
};

let cache = { timestamp: 0, data: [] };
const CACHE_DURATION = 15*60*1000; // 15 Minuten

function getFlag(team){
  const flags = {
    "Manchester":"gb","Liverpool":"gb","Chelsea":"gb","Arsenal":"gb","Bayern":"de","Dortmund":"de",
    "Real":"es","Barcelona":"es","Juventus":"it","Inter":"it","PSG":"fr"
  };
  const countries = {
    "England":"gb","Germany":"de","Spain":"es","Italy":"it","France":"fr"
  };
  for(const [name,flag] of Object.entries(flags)) if(team.includes(name)) return flag;
  for(const [country,flag] of Object.entries(countries)) if(team.includes(country)) return flag;
  return "eu";
}

async function fetchMatchesForLeague(compCode,dateFrom,dateTo){
  if(!API_KEY) return [];
  const url = `https://api.football-data.org/v4/matches?competitions=${compCode}&dateFrom=${dateFrom}&dateTo=${dateTo}`;
  const res = await fetch(url,{headers:{"X-Auth-Token":API_KEY}});
  if(!res.ok){ const text = await res.text(); throw new Error(`API ${res.status}: ${text}`); }
  const data = await res.json();
  return data.matches || [];
}

function formatDateISO(d){
  const yyyy=d.getUTCFullYear(), mm=String(d.getUTCMonth()+1).padStart(2,"0"), dd=String(d.getUTCDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}

async function refreshCache(){
  const now = Date.now();
  console.log("🔁 Aktualisiere Spiele...");
  const games = [];
  const from = new Date(), to = new Date(); to.setDate(to.getDate()+2);
  const dateFrom = formatDateISO(from), dateTo = formatDateISO(to);

  for(const [leagueName,compCode] of Object.entries(LEAGUES)){
    try{
      const matches = await fetchMatchesForLeague(compCode,dateFrom,dateTo);
      matches.forEach(m=>{
        const home = m.homeTeam?.name || "Home", away = m.awayTeam?.name || "Away";
        const homeLogo = m.homeTeam?.crest || `https://flagcdn.com/48x36/${getFlag(home)}.png`;
        const awayLogo = m.awayTeam?.crest || `https://flagcdn.com/48x36/${getFlag(away)}.png`;

        const homeXG = +(0.6+Math.random()*1.6).toFixed(2);
        const awayXG = +(0.6+Math.random()*1.6).toFixed(2);
        const totalXG = +(homeXG+awayXG).toFixed(2);

        const prob = {
          home: +(homeXG/totalXG).toFixed(2),
          away: +(awayXG/totalXG).toFixed(2),
          draw: +((1-(homeXG/totalXG+awayXG/totalXG))>0?(1-(homeXG/totalXG+awayXG/totalXG)).toFixed(2):0),
          over25: +(0.55+Math.random()*0.15).toFixed(2),
          under25: +(1-(0.55+Math.random()*0.15)).toFixed(2)
        };

        const odds = {
          home: +(1.6+Math.random()*1.2).toFixed(2),
          draw: +(2+Math.random()*1.2).toFixed(2),
          away: +(1.7+Math.random()*1.3).toFixed(2),
          over25: +(1.8+Math.random()*0.5).toFixed(2),
          under25: +(1.9+Math.random()*0.5).toFixed(2)
        };

        const value = {
          home: +(prob.home*odds.home-1).toFixed(2),
          draw: +(prob.draw*odds.draw-1).toFixed(2),
          away: +(prob.away*odds.away-1).toFixed(2),
          over25: +(prob.over25*odds.over25-1).toFixed(2),
          under25: +(prob.under25*odds.under25-1).toFixed(2)
        };

        games.push({
          id: m.id || `${leagueName}-${home}-${away}-${m.utcDate}`,
          home, away, league: leagueName, utcDate: m.utcDate,
          homeLogo, awayLogo,
          odds, value, totalXG, homeXG, awayXG, prob
        });
      });
    }catch(err){ console.error(`Fehler ${leagueName}:`, err.message); }
  }

  const sortedValue = [...games].sort((a,b)=>Math.max(b.value.home,b.value.draw,b.value.away)-Math.max(a.value.home,a.value.draw,a.value.away));
  const top7Value = sortedValue.slice(0,7);
  const sortedOver25 = [...games].sort((a,b)=>b.value.over25 - a.value.over25);
  const top5Over25 = sortedOver25.slice(0,5);

  cache = { timestamp: now, data: games, top7Value, top5Over25 };
  console.log(`✅ Cache aktualisiert (${games.length} Spiele)`);
}

// Initial refresh + Interval
(async()=>{ await refreshCache(); setInterval(refreshCache,CACHE_DURATION); })();

app.get("/api/games",(req,res)=>{
  res.json({ response: cache.data, top7Value: cache.top7Value||[], top5Over25: cache.top5Over25||[] });
});

app.get("*",(req,res)=>{ res.sendFile(path.join(__dirname,"index.html")); });

app.listen(PORT, ()=>console.log(`🚀 Server läuft auf Port ${PORT}`));

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
const CACHE_DURATION = 15 * 60 * 1000;

const LEAGUE_IDS = {
  "Premier League": 2021,
  "Bundesliga": 2002,
  "La Liga": 2014,
  "Serie A": 2019,
  "Ligue 1": 2015
};

function getFlag(team){
  const flags = { /* wie vorher */ };
  const countries = { /* wie vorher */ };
  for(const [name, flag] of Object.entries(flags)) if(team.includes(name)) return flag;
  for(const [country, flag] of Object.entries(countries)) if(team.includes(country)) return flag;
  return "eu";
}

function poissonProb(lambda, k){
  return Math.pow(lambda,k)*Math.exp(-lambda)/factorial(k);
}
function factorial(n){ return n <= 1 ? 1 : n*factorial(n-1); }

async function fetchGames(){
  if(!FOOTBALL_DATA_KEY) return [];
  const headers = { "X-Auth-Token": FOOTBALL_DATA_KEY };
  let games=[];
  for(const [leagueName,id] of Object.entries(LEAGUE_IDS)){
    try{
      const res = await fetch(`https://api.football-data.org/v4/competitions/${id}/matches?status=SCHEDULED`, {headers});
      const data = await res.json();
      if(!data.matches) continue;
      data.matches.forEach(m=>{
        const homeXG = +(1 + Math.random()*1).toFixed(2);
        const awayXG = +(1 + Math.random()*1).toFixed(2);
        const totalXG = homeXG+awayXG;

        const odds = {
          home: +(1.8 + Math.random()*1).toFixed(2),
          draw: +(2 + Math.random()*1).toFixed(2),
          away: +(1.9 + Math.random()*1).toFixed(2),
          over25: +(1.8 + Math.random()*0.5).toFixed(2),
          under25: +(1.9 + Math.random()*0.5).toFixed(2)
        };

        // Poisson-Wahrscheinlichkeiten für Sieg/Draw
        const homeWinProb = poissonProb(homeXG,1) + poissonProb(homeXG,2); 
        const awayWinProb = poissonProb(awayXG,1) + poissonProb(awayXG,2);
        const drawProb = 1 - (homeWinProb+awayWinProb);

        const prob = {
          home: +(homeWinProb).toFixed(2),
          draw: +(drawProb).toFixed(2),
          away: +(awayWinProb).toFixed(2),
          over25: 0.55 + Math.random()*0.15,
          under25: 1-(0.55 + Math.random()*0.15)
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
        const btts = +(homeProbGoal*awayProbGoal).toFixed(2);

        let trend="neutral";
        if(value.home>0.1 && homeXG>awayXG) trend="home";
        else if(value.away>0.1 && awayXG>homeXG) trend="away";
        else if(Math.abs(homeXG-awayXG)<0.2) trend="draw";

        games.push({
          id:m.id,
          date:m.utcDate,
          home:m.homeTeam.name,
          away:m.awayTeam.name,
          league:leagueName,
          homeLogo:`https://flagcdn.com/48x36/${getFlag(m.homeTeam.name)}.png`,
          awayLogo:`https://flagcdn.com/48x36/${getFlag(m.awayTeam.name)}.png`,
          odds,value,totalXG:+totalXG.toFixed(2),
          homeXG:+homeXG.toFixed(2),
          awayXG:+awayXG.toFixed(2),
          prob,btts,trend
        });
      });
    }catch(e){console.error(`Fehler Liga ${leagueName}:`, e);}
  }
  games.sort((a,b)=>new Date(a.date)-new Date(b.date));
  return games;
}

app.get("/api/games", async (req,res)=>{
  const now = Date.now();
  let games = cache.data;
  if(!games || now-cache.timestamp > CACHE_DURATION){
    games = await fetchGames();
    cache = {timestamp: now, data: games};
  }

  if(req.query.date){
    games = games.filter(g=>g.date.startsWith(req.query.date));
  }

  const top7Value = [...games].sort((a,b)=>Math.max(b.value.home,b.value.draw,b.value.away)-Math.max(a.value.home,a.value.draw,a.value.away))
    .slice(0,7).map(g=>({home:g.home,away:g.away,league:g.league,value:Math.max(g.value.home,g.value.draw,g.value.away),trend:g.trend}));

  const top5Over25 = [...games].sort((a,b)=>b.value.over25-a.value.over25)
    .slice(0,5).map(g=>({home:g.home,away:g.away,league:g.league,value:g.value.over25,trend:g.trend}));

  res.json({response:games,top7Value,top5Over25});
});

app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"index.html")));
app.listen(PORT,()=>console.log(`Server läuft auf Port ${PORT}`));

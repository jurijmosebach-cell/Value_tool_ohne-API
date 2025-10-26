import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.static(__dirname));

const PORT = process.env.PORT || 10000;

// Ligen
const LEAGUES = [
  { key: "soccer_epl", name: "Premier League" },
  { key: "soccer_germany_bundesliga", name: "Bundesliga" },
  { key: "soccer_germany_2_bundesliga", name: "2. Bundesliga" },
  { key: "soccer_spain_la_liga", name: "La Liga" },
  { key: "soccer_italy_serie_a", name: "Serie A" },
  { key: "soccer_france_ligue_one", name: "Ligue 1" },
];

// Hilfsfunktion für Flaggen
function getFlag(team) {
  const flags = { "England":"gb","Germany":"de","Spain":"es","Italy":"it","France":"fr" };
  for(const [country,flag] of Object.entries(flags)) if(team.includes(country)) return flag;
  return "eu";
}

// API Route
app.get("/api/games", (req,res)=>{
  const today = new Date().toISOString().slice(0,10);
  const date = req.query.date || today;
  const games = [];

  for(const league of LEAGUES){
    // Dummy-Spiele generieren
    for(let i=1;i<=3;i++){
      const home = league.name + " Team " + i;
      const away = league.name + " Team " + (i+3);

      const homeXG = +(1 + Math.random()*1).toFixed(2);
      const awayXG = +(1 + Math.random()*1).toFixed(2);
      const totalXG = homeXG + awayXG;

      const prob = {
        home: homeXG/totalXG,
        away: awayXG/totalXG,
        draw: 1 - (homeXG/totalXG + awayXG/totalXG),
        over25: 0.55 + Math.random()*0.15,
        under25: 1-(0.55 + Math.random()*0.15),
      };

      const odds = {
        home: +(1.8 + Math.random()*1).toFixed(2),
        draw: +(2 + Math.random()*1).toFixed(2),
        away: +(1.9 + Math.random()*1).toFixed(2),
        over25: +(1.8 + Math.random()*0.5).toFixed(2),
        under25: +(1.9 + Math.random()*0.5).toFixed(2),
      };

      const value = {
        home: +(prob.home*odds.home-1).toFixed(2),
        draw: +(prob.draw*odds.draw-1).toFixed(2),
        away: +(prob.away*odds.away-1).toFixed(2),
        over25: +(prob.over25*odds.over25-1).toFixed(2),
        under25: +(prob.under25*odds.under25-1).toFixed(2),
      };

      games.push({
        home,away,league:league.name,
        homeLogo:`https://flagcdn.com/48x36/${getFlag(home)}.png`,
        awayLogo:`https://flagcdn.com/48x36/${getFlag(away)}.png`,
        odds,value,totalXG:+totalXG.toFixed(2),
        homeXG:+homeXG.toFixed(2),
        awayXG:+awayXG.toFixed(2),
        prob
      });
    }
  }

  res.json({ response: games });
});

// Alle anderen Requests → index.html
app.get("*",(req,res)=>{
  res.sendFile(path.join(__dirname,"index.html"));
});

// Server starten
app.listen(PORT,()=>{
  console.log(`Server läuft auf Port ${PORT}`);
});

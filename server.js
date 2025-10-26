import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { fetchFlashscoreGames, LEAGUE_URLS } from "./scraper.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.static(__dirname));

const PORT = process.env.PORT || 10000;

function getFlag(team) {
  const flags = {
    "Manchester":"gb","Liverpool":"gb","Chelsea":"gb","Arsenal":"gb","Man United":"gb","Tottenham":"gb",
    "Bayern":"de","Dortmund":"de","Leipzig":"de","Gladbach":"de","Frankfurt":"de","Leverkusen":"de",
    "Real":"es","Barcelona":"es","Atletico":"es","Sevilla":"es","Valencia":"es","Villarreal":"es",
    "Juventus":"it","Inter":"it","Milan":"it","Napoli":"it","Roma":"it","Lazio":"it",
    "PSG":"fr","Marseille":"fr","Monaco":"fr","Lyon":"fr","Rennes":"fr","Nice":"fr"
  };
  for(const [name, flag] of Object.entries(flags)) if(team.includes(name)) return flag;
  return "eu";
}

app.get("/api/games", async (req,res)=>{
  try {
    const games = [];
    for(const [leagueName, url] of Object.entries(LEAGUE_URLS)){
      const matches = await fetchFlashscoreGames(url);

      matches.forEach(g=>{
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
          home: g.home,
          away: g.away,
          league: leagueName,
          homeLogo:`https://flagcdn.com/48x36/${getFlag(g.home)}.png`,
          awayLogo:`https://flagcdn.com/48x36/${getFlag(g.away)}.png`,
          odds,value,totalXG:+totalXG.toFixed(2),
          homeXG:+homeXG.toFixed(2),
          awayXG:+awayXG.toFixed(2),
          prob
        });
      });
    }

    res.json({ response: games });
  } catch(err) {
    console.error("API Fehler:", err);
    res.status(500).json({ response: [], error: err.message });
  }
});

app.get("*",(req,res)=>{
  res.sendFile(path.join(__dirname,"index.html"));
});

app.listen(PORT,()=>console.log(`Server läuft auf Port ${PORT}`));

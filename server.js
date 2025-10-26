import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.static(__dirname));

const PORT = process.env.PORT || 10000;

// Teams per league (short realistic lists)
const TEAMS = {
  "Premier League": ["Arsenal","Manchester City","Manchester United","Liverpool","Chelsea","Tottenham","Leicester"],
  "Bundesliga": ["Bayern München","Borussia Dortmund","RB Leipzig","Bayer Leverkusen","Schalke 04","VfB Stuttgart"],
  "La Liga": ["Real Madrid","Barcelona","Atletico Madrid","Sevilla","Valencia","Real Sociedad"],
  "Serie A": ["Juventus","Inter Mailand","AC Milan","Napoli","Roma","Lazio"]
};

function getFlag(team){
  const mapping = { "England":"gb","Germany":"de","Spain":"es","Italy":"it" };
  for(const k of Object.keys(mapping)) if(team.toLowerCase().includes(k.toLowerCase().split(' ')[0]) || team.toLowerCase().includes(k.toLowerCase())) return mapping[k];
  // fallback
  return 'eu';
}

function randomOddsBase(){
  const home = +(1.5 + Math.random()*1.6).toFixed(2);
  const draw = +(3.0 + Math.random()*0.9).toFixed(2);
  const away = +(1.8 + Math.random()*1.8).toFixed(2);
  const over25 = +(1.55 + Math.random()*0.5).toFixed(2);
  const under25 = +(1.9 + Math.random()*0.6).toFixed(2);
  return { home, draw, away, over25, under25 };
}

function pickMatchesForDate(date){
  // simple deterministic-ish generation based on date to keep results stable per day
  const seed = parseInt(date.replace(/-/g,''),10) % 1000;
  const games = [];
  const leagues = Object.keys(TEAMS);
  leagues.forEach((league, idx) => {
    const teams = TEAMS[league];
    // generate up to 3 matches per league
    const matchesCount = Math.min(3, Math.max(1, Math.floor((seed + idx) % teams.length)));
    for(let i=0;i<matchesCount;i++){
      const a = teams[(seed + i + idx) % teams.length];
      const b = teams[(seed + i + 3 + idx) % teams.length];
      if(a===b) continue;
      games.push({
        home: a,
        away: b,
        league,
        odds: randomOddsBase()
      });
    }
  });
  return games;
}

app.get('/api/games', (req, res) => {
  try{
    const date = req.query.date || new Date().toISOString().slice(0,10);
    const raw = pickMatchesForDate(date);
    const games = raw.map(g => {
      const homeXG = 1.2 + Math.random()*0.9;
      const awayXG = 1.0 + Math.random()*0.8;
      const totalXG = homeXG + awayXG;
      const prob = {
        home: homeXG/totalXG,
        away: awayXG/totalXG,
        draw: Math.max(0, 1 - (homeXG/totalXG + awayXG/totalXG)),
        over25: 0.5 + Math.random()*0.3,
        under25: 1 - (0.5 + Math.random()*0.3)
      };
      const value = {
        home: g.odds.home ? prob.home * g.odds.home - 1 : 0,
        draw: g.odds.draw ? prob.draw * g.odds.draw - 1 : 0,
        away: g.odds.away ? prob.away * g.odds.away - 1 : 0,
        over25: g.odds.over25 ? prob.over25 * g.odds.over25 - 1 : 0,
        under25: g.odds.under25 ? prob.under25 * g.odds.under25 - 1 : 0
      };
      return {
        ...g,
        date,
        homeLogo: `https://flagcdn.com/48x36/${getFlag(g.home)}.png`,
        awayLogo: `https://flagcdn.com/48x36/${getFlag(g.away)}.png`,
        homeXG: +homeXG.toFixed(2),
        awayXG: +awayXG.toFixed(2),
        totalXG: +totalXG.toFixed(2),
        prob,
        value
      };
    });
    res.json({ response: games });
  }catch(err){
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Erstellen der Spiele' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`XG Value Tool läuft auf http://localhost:${PORT}`);
});

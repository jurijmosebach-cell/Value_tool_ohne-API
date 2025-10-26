import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
app.use(express.static(__dirname));

const PORT = process.env.PORT || 10000;
const FOOTBALL_DATA_KEY = process.env.FOOTBALL_DATA_API_KEY || "";

let cache = { timestamp: 0, data: [] };
const CACHE_DURATION = 15 * 60 * 1000; // 15 Minuten

// League IDs for football-data.org
const LEAGUE_IDS = {
  "Premier League": 2021,
  "Bundesliga": 2002,
  "La Liga": 2014,
  "Serie A": 2019,
  "Ligue 1": 2015
};

/* ---------- Utilities ---------- */

function getFlag(team){
  const flags = {
    "Manchester":"gb","Liverpool":"gb","Chelsea":"gb","Arsenal":"gb","Man United":"gb","Tottenham":"gb",
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
  for(const [name, flag] of Object.entries(flags)) if(team.includes(name)) return flag;
  for(const [country, flag] of Object.entries(countries)) if(team.includes(country)) return flag;
  return "eu";
}

function factorial(n){
  if(n <= 1) return 1;
  let f = 1;
  for(let i=2;i<=n;i++) f *= i;
  return f;
}

function poisson(k, lambda){
  // return P(X = k)
  return Math.pow(lambda, k) * Math.exp(-lambda) / factorial(k);
}

/**
 * Compute probabilities of home win / draw / away using Poisson distributions
 * by summing joint probabilities for goals up to maxGoals.
 */
function computeMatchOutcomeProbs(homeLambda, awayLambda, maxGoals = 7){
  let homeProb = 0, drawProb = 0, awayProb = 0;
  for(let i=0;i<=maxGoals;i++){
    const pHome = poisson(i, homeLambda);
    for(let j=0;j<=maxGoals;j++){
      const pAway = poisson(j, awayLambda);
      const p = pHome * pAway;
      if(i > j) homeProb += p;
      else if(i === j) drawProb += p;
      else awayProb += p;
    }
  }
  // residual mass for tails (goals > maxGoals) approximate is tiny for reasonable lambdas
  const total = homeProb + drawProb + awayProb;
  // normalize to 1
  return {
    home: +(homeProb/total).toFixed(4),
    draw: +(drawProb/total).toFixed(4),
    away: +(awayProb/total).toFixed(4)
  };
}

/**
 * Compute probability of over 2.5 goals (sum goals >=3)
 */
function computeOver25Prob(homeLambda, awayLambda, maxGoals = 7){
  const joint = (max) => {
    let p = 0;
    for(let i=0;i<=max;i++){
      const ph = poisson(i, homeLambda);
      for(let j=0;j<=max;j++){
        const pa = poisson(j, awayLambda);
        p += ph * pa;
      }
    }
    return p;
  };
  // approximate P(total goals <= 2) by summing i+j <=2
  let pLe2 = 0;
  for(let i=0;i<=2;i++){
    const ph = poisson(i, homeLambda);
    for(let j=0;j<=2;j++){
      if(i + j <= 2){
        pLe2 += ph * poisson(j, awayLambda);
      }
    }
  }
  const over25 = 1 - pLe2;
  return +over25.toFixed(4);
}

/* ---------- Fetch matches ---------- */

async function fetchGamesFromAPI(){
  if(!FOOTBALL_DATA_KEY) return [];
  const headers = { "X-Auth-Token": FOOTBALL_DATA_KEY };
  const allGames = [];

  for(const [leagueName, id] of Object.entries(LEAGUE_IDS)){
    try {
      const url = `https://api.football-data.org/v4/competitions/${id}/matches?status=SCHEDULED`;
      const res = await fetch(url, { headers });
      if(!res.ok){
        console.error(`football-data response ${res.status} for ${leagueName}`);
        continue;
      }
      const data = await res.json();
      if(!data.matches || !Array.isArray(data.matches)) continue;

      data.matches.forEach(m => {
        // fallback xG (if you later want to use real xG, replace these with API values)
        const homeXG = +(0.8 + Math.random()*1.6).toFixed(2); // realistic-ish
        const awayXG = +(0.6 + Math.random()*1.6).toFixed(2);
        const totalXG = +(homeXG + awayXG).toFixed(2);

        // random-ish odds (replace with real odds source if available)
        const odds = {
          home: +(1.6 + Math.random()*1.6).toFixed(2),
          draw: +(2.0 + Math.random()*1.5).toFixed(2),
          away: +(1.7 + Math.random()*1.6).toFixed(2),
          over25: +(1.7 + Math.random()*0.7).toFixed(2),
          under25: +(1.8 + Math.random()*0.7).toFixed(2)
        };

        // compute Poisson-based match outcome probabilities
        const outcome = computeMatchOutcomeProbs(homeXG, awayXG, 7);
        const over25Prob = computeOver25Prob(homeXG, awayXG, 7);

        // BTTS approx: 1 - P(home 0) - P(away 0) + P(both 0)?? Better: 1 - P(home 0 OR away 0)
        // We'll compute prob at least one goal for each and multiply (approx independence)
        const pHomeAtLeast1 = 1 - poisson(0, homeXG);
        const pAwayAtLeast1 = 1 - poisson(0, awayXG);
        const bttsProb = +( (pHomeAtLeast1 * pAwayAtLeast1) ).toFixed(4);

        const prob = {
          home: +outcome.home.toFixed(4),
          draw: +outcome.draw.toFixed(4),
          away: +outcome.away.toFixed(4),
          over25: +over25Prob.toFixed(4),
          under25: +(1 - over25Prob).toFixed(4)
        };

        const value = {
          home: +((prob.home * odds.home) - 1).toFixed(4),
          draw: +((prob.draw * odds.draw) - 1).toFixed(4),
          away: +((prob.away * odds.away) - 1).toFixed(4),
          over25: +((prob.over25 * odds.over25) - 1).toFixed(4),
          under25: +((prob.under25 * odds.under25) - 1).toFixed(4)
        };

        // Trend logic
        let trend = "neutral";
        const mainValue = Math.max(value.home, value.draw, value.away);
        if(mainValue > 0.12 && prob.home > prob.away && prob.home > prob.draw) trend = "home";
        else if(mainValue > 0.12 && prob.away > prob.home && prob.away > prob.draw) trend = "away";
        else if(Math.abs(prob.home - prob.away) < 0.08 && prob.draw >= Math.max(prob.home, prob.away)) trend = "draw";

        allGames.push({
          id: m.id,
          date: m.utcDate,
          league: leagueName,
          home: m.homeTeam?.name || "Home",
          away: m.awayTeam?.name || "Away",
          homeLogo: `https://flagcdn.com/48x36/${getFlag(m.homeTeam?.name||"")}.png`,
          awayLogo: `https://flagcdn.com/48x36/${getFlag(m.awayTeam?.name||"")}.png`,
          homeXG, awayXG, totalXG,
          odds, prob, value,
          btts: bttsProb,
          trend
        });
      });

    } catch(err){
      console.error("Error fetching league", leagueName, err.message);
      continue;
    }
  }

  // sort by date ascending
  allGames.sort((a,b) => new Date(a.date) - new Date(b.date));
  return allGames;
}

/* ---------- API route ---------- */

app.get("/api/games", async (req, res) => {
  try {
    const now = Date.now();
    if(!cache.data.length || now - cache.timestamp > CACHE_DURATION){
      // refresh cache
      const games = await fetchGamesFromAPI();
      cache = { timestamp: now, data: games };
    }

    let filtered = cache.data.slice();

    // date filter: ?date=YYYY-MM-DD
    if(req.query.date){
      const q = req.query.date;
      filtered = filtered.filter(g => g.date && g.date.startsWith(q));
    }

    // Top lists computed from filtered
    const top7Value = filtered
      .slice()
      .sort((a,b) => Math.max(b.value.home,b.value.draw,b.value.away) - Math.max(a.value.home,a.value.draw,a.value.away))
      .slice(0,7)
      .map(g => ({ home: g.home, away: g.away, league: g.league, value: Number(Math.max(g.value.home,g.value.draw,g.value.away).toFixed(4)), trend: g.trend }));

    const top5Over25 = filtered
      .slice()
      .sort((a,b) => b.value.over25 - a.value.over25)
      .slice(0,5)
      .map(g => ({ home: g.home, away: g.away, league: g.league, value: Number(g.value.over25.toFixed(4)), trend: g.trend }));

    return res.json({ response: filtered, top7Value, top5Over25 });

  } catch(err){
    console.error("API error", err);
    return res.status(500).json({ response: [], top7Value: [], top5Over25: [], error: err.message });
  }
});

/* serve frontend */
app.get("*", (req,res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));

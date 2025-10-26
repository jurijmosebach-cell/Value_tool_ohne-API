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
const XG_API_URL = process.env.XG_API_URL || ""; // optional external xG API
const XG_API_KEY = process.env.XG_API_KEY || ""; // optional header for XG_API_URL

let cache = { timestamp: 0, data: [], dateKey: "" };
const CACHE_DURATION = 15 * 60 * 1000; // 15 min cache

// allowed league substrings (will match competition.name)
const ALLOWED_LEAGUES = [
  "Premier League",
  "Bundesliga",
  "2. Bundesliga",
  "La Liga",
  "Serie A",
  "Ligue 1",
  "Eredivisie",
  "Süper Lig",
  "Allsvenskan",
  "Campeonato Brasileiro",
  "Eliteserien",
  "Eredivisie", "Sverige", "Brasileirão", "Brazil"
];

/* ---------- utilities ---------- */

function slugify(name){
  if(!name) return "";
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-zA-Z0-9]+/g,"-").replace(/^-+|-+$/g,"").toLowerCase();
}

function getFlag(team){
  const flags = {
    "Manchester":"gb","Liverpool":"gb","Chelsea":"gb","Arsenal":"gb","Man United":"gb","Tottenham":"gb",
    "Bayern":"de","Dortmund":"de","Leipzig":"de","Gladbach":"de","Frankfurt":"de","Leverkusen":"de",
    "Real":"es","Barcelona":"es","Atletico":"es","Sevilla":"es","Valencia":"es","Villarreal":"es",
    "Juventus":"it","Inter":"it","Milan":"it","Napoli":"it","Roma":"it","Lazio":"it",
    "PSG":"fr","Marseille":"fr","Monaco":"fr","Lyon":"fr","Rennes":"fr","Nice":"fr"
  };
  const countries = {
    "England":"gb","Germany":"de","Spain":"es","Italy":"it","France":"fr","Turkey":"tr","Netherlands":"nl",
    "Sweden":"se","Brazil":"br","Norway":"no","Australia":"au","Belgium":"be","Japan":"jp"
  };
  for(const [k,v] of Object.entries(flags)) if(team.includes(k)) return v;
  for(const [k,v] of Object.entries(countries)) if(team.includes(k)) return v;
  return "eu";
}

function factorial(n){ if(n<=1) return 1; let f=1; for(let i=2;i<=n;i++) f*=i; return f; }
function poisson(k, lambda){ return Math.pow(lambda,k)*Math.exp(-lambda)/factorial(k); }

function computeMatchOutcomeProbs(homeLambda, awayLambda, maxGoals=7){
  let homeProb=0, drawProb=0, awayProb=0;
  for(let i=0;i<=maxGoals;i++){
    const pHome = poisson(i, homeLambda);
    for(let j=0;j<=maxGoals;j++){
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
    for(let j=0;j<=2;j++){
      pLe2 += poisson(i, homeLambda) * poisson(j, awayLambda);
    }
  }
  return +(1 - pLe2).toFixed(4);
}

/* ---------- Understat small scraper ---------- */

async function fetchUnderstatTeamMatches(teamName){
  const slug = slugify(teamName);
  if(!slug) throw new Error("empty slug");
  const url = `https://understat.com/team/${slug}`;
  const res = await fetch(url, { headers: { "User-Agent": "xg-value-tool/1.0" } });
  if(!res.ok) throw new Error("understat page error " + res.status);
  const text = await res.text();
  // find matches JSON
  const re = /matchesData\s*=\s*JSON\.parse\('([\s\S]*?)'\)/m;
  const m = text.match(re);
  if(!m) throw new Error("matchesData not found");
  let esc = m[1];
  // unescape
  esc = esc.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  const parsed = JSON.parse(esc);
  return parsed; // returns array of match objects
}

function extractXGFromObj(obj){
  // try common property names
  const hX = obj.h_xG ?? obj.hxG ?? obj.h_xg ?? obj.home_xg ?? null;
  const aX = obj.a_xG ?? obj.axG ?? obj.a_xg ?? obj.away_xg ?? null;
  const hx = hX != null ? parseFloat(hX) : null;
  const ax = aX != null ? parseFloat(aX) : null;
  if(hx != null && !Number.isNaN(hx) && ax != null && !Number.isNaN(ax)){
    return { homeXG: +hx.toFixed(2), awayXG: +ax.toFixed(2), date: obj.date ? obj.date.split('T')[0] : null };
  }
  return null;
}

async function tryUnderstatLookup(homeName, awayName, dateStr){
  // try home team page then away
  try {
    const arr = await fetchUnderstatTeamMatches(homeName);
    for(const o of arr){
      const x = extractXGFromObj(o);
      if(!x) continue;
      // try to match opponent by name substring
      const opp = (o.a && o.a.title) || (o.away) || (o.away_title) || "";
      const homeTitle = (o.h && o.h.title) || o.home || "";
      if(dateStr && x.date && x.date !== dateStr) continue;
      // if names plausible, return
      if( (homeTitle.toLowerCase().includes(homeName.toLowerCase()) || homeName.toLowerCase().includes(homeTitle.toLowerCase()))
        && (opp.toLowerCase().includes(awayName.toLowerCase()) || awayName.toLowerCase().includes(opp.toLowerCase()))
      ){
        return x;
      }
      // else, if x exists and date matches, return
      if(dateStr && x.date && x.date === dateStr) return x;
    }
  } catch(e){}
  try {
    const arr2 = await fetchUnderstatTeamMatches(awayName);
    for(const o of arr2){
      const x = extractXGFromObj(o);
      if(!x) continue;
      const opp = (o.h && o.h.title) || (o.home) || (o.home_title) || "";
      if(dateStr && x.date && x.date !== dateStr) continue;
      if( (opp.toLowerCase().includes(homeName.toLowerCase()) || homeName.toLowerCase().includes(opp.toLowerCase()))
        && ( (o.a && o.a.title && o.a.title.toLowerCase().includes(awayName.toLowerCase())) || awayName.toLowerCase().includes((o.a && o.a.title || "").toLowerCase()) )
      ){
        // careful: object is from away team page; swap roles if needed
        const maybe = extractXGFromObj(o);
        return maybe;
      }
      if(dateStr && x.date && x.date === dateStr) return x;
    }
  } catch(e){}
  throw new Error("understat not found");
}

/* ---------- fetch /matches and build games ---------- */

async function fetchGamesForDate(dateYYYYMMDD){
  if(!FOOTBALL_DATA_KEY) return [];
  // football-data supports /matches with dateFrom/dateTo
  const headers = { "X-Auth-Token": FOOTBALL_DATA_KEY };
  // use same day range
  const url = `https://api.football-data.org/v4/matches?dateFrom=${dateYYYYMMDD}&dateTo=${dateYYYYMMDD}&status=SCHEDULED`;
  const res = await fetch(url, { headers });
  if(!res.ok){
    console.error("football-data /matches status", res.status);
    return [];
  }
  const j = await res.json();
  if(!j.matches || !Array.isArray(j.matches)) return [];

  const out = [];
  for(const m of j.matches){
    const compName = m.competition?.name || "";
    // filter allowed leagues (substring match)
    const allowed = ALLOWED_LEAGUES.some(sub => compName.toLowerCase().includes(sub.toLowerCase()));
    if(!allowed) continue;

    const homeName = m.homeTeam?.name || "Home";
    const awayName = m.awayTeam?.name || "Away";
    const matchDate = m.utcDate ? m.utcDate.split("T")[0] : null;

    // try external XG provider first
    let homeXG = null, awayXG = null;
    if(XG_API_URL){
      try {
        const u = new URL(XG_API_URL);
        u.searchParams.set("home", homeName);
        u.searchParams.set("away", awayName);
        if(matchDate) u.searchParams.set("date", matchDate);
        const h = {};
        if(XG_API_KEY) h["Authorization"] = `Bearer ${XG_API_KEY}`;
        const xr = await fetch(u.toString(), { headers: h, timeout: 8000 });
        if(xr.ok){
          const jj = await xr.json();
          if(typeof jj.homeXG === "number" && typeof jj.awayXG === "number"){
            homeXG = +jj.homeXG;
            awayXG = +jj.awayXG;
          }
        }
      } catch(e){
        console.warn("external xg provider failed", e.message);
      }
    }

    // then try understat
    if(homeXG == null || awayXG == null){
      try {
        const x = await tryUnderstatLookup(homeName, awayName, matchDate);
        if(x && typeof x.homeXG === "number" && typeof x.awayXG === "number"){
          homeXG = x.homeXG;
          awayXG = x.awayXG;
        }
      } catch(e){
        // ignore - we'll fallback
      }
    }

    // fallback random-ish
    if(homeXG == null || awayXG == null){
      homeXG = +(0.8 + Math.random()*1.6).toFixed(2);
      awayXG = +(0.6 + Math.random()*1.6).toFixed(2);
    }

    const totalXG = +(homeXG + awayXG).toFixed(2);

    // dummy odds (replace with real odds integration later if desired)
    const odds = {
      home: +(1.6 + Math.random()*1.6).toFixed(2),
      draw: +(2.0 + Math.random()*1.5).toFixed(2),
      away: +(1.7 + Math.random()*1.6).toFixed(2),
      over25: +(1.7 + Math.random()*0.7).toFixed(2),
      under25: +(1.8 + Math.random()*0.7).toFixed(2)
    };

    const outcome = computeMatchOutcomeProbs(homeXG, awayXG, 7);
    const over25Prob = computeOver25Prob(homeXG, awayXG);
    const pHomeAtLeast1 = 1 - poisson(0, homeXG);
    const pAwayAtLeast1 = 1 - poisson(0, awayXG);
    const bttsProb = +(pHomeAtLeast1 * pAwayAtLeast1).toFixed(4);

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

    let trend = "neutral";
    const mainValue = Math.max(value.home, value.draw, value.away);
    if(mainValue > 0.12 && prob.home > prob.away && prob.home > prob.draw) trend = "home";
    else if(mainValue > 0.12 && prob.away > prob.home && prob.away > prob.draw) trend = "away";
    else if(Math.abs(prob.home - prob.away) < 0.08 && prob.draw >= Math.max(prob.home, prob.away)) trend = "draw";

    out.push({
      id: m.id,
      date: m.utcDate,
      league: compName,
      home: homeName,
      away: awayName,
      homeLogo: `https://flagcdn.com/48x36/${getFlag(homeName)}.png`,
      awayLogo: `https://flagcdn.com/48x36/${getFlag(awayName)}.png`,
      homeXG, awayXG, totalXG,
      odds, prob, value, btts: bttsProb, trend
    });
  }

  // sort by time
  out.sort((a,b)=>new Date(a.date) - new Date(b.date));
  return out;
}

/* ---------- API route ---------- */

app.get("/api/games", async (req, res) => {
  try {
    // date param or today
    const dateQuery = req.query.date;
    const today = new Date();
    function toYYYY(mmDate){
      const y = mmDate.getUTCFullYear();
      const m = String(mmDate.getUTCMonth()+1).padStart(2,"0");
      const d = String(mmDate.getUTCDate()).padStart(2,"0");
      return `${y}-${m}-${d}`;
    }
    const targetDate = dateQuery ? dateQuery : toYYYY(today);
    const cacheKey = targetDate;

    const now = Date.now();
    if(!cache.data.length || cache.dateKey !== cacheKey || (now - cache.timestamp) > CACHE_DURATION){
      const games = await fetchGamesForDate(targetDate);
      cache = { timestamp: now, data: games, dateKey: cacheKey };
    }

    let filtered = cache.data.slice();

    // produce top lists
    const top7Value = filtered.slice().sort((a,b)=>Math.max(b.value.home,b.value.draw,b.value.away)-Math.max(a.value.home,a.value.draw,a.value.away)).slice(0,7)
      .map(g=>({ home:g.home, away:g.away, league:g.league, value:Number(Math.max(g.value.home,g.value.draw,g.value.away).toFixed(4)), trend:g.trend }));
    const top5Over25 = filtered.slice().sort((a,b)=>b.value.over25 - a.value.over25).slice(0,5)
      .map(g=>({ home:g.home, away:g.away, league:g.league, value:Number(g.value.over25.toFixed(4)), trend:g.trend }));

    return res.json({ response: filtered, top7Value, top5Over25 });
  } catch(err){
    console.error("API error", err);
    return res.status(500).json({ response: [], top7Value: [], top5Over25: [], error: err.message });
  }
});

/* serve frontend */
app.get("*", (req,res) => {
  res.sendFile(path.join(__dirname,"index.html"));
});

app.listen(PORT, ()=>console.log(`Server läuft auf Port ${PORT}`));

// server.js
import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 10000;
const API_KEY = process.env.SPORTSAPI360_KEY;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let cache = {};
const CACHE_TIME = 5 * 60 * 1000; // 5 Minuten

app.use(express.json());
app.use(express.static(__dirname));
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

// ----- Mathematische Hilfsfunktionen -----
function factorial(n){
  if(n <= 1) return 1;
  let f = 1;
  for(let i=2;i<=n;i++) f *= i;
  return f;
}
function poisson(k, lambda){
  if(lambda <= 0) return k === 0 ? 1 : 0;
  return Math.pow(lambda, k) * Math.exp(-lambda) / factorial(k);
}
function computeMatchOutcomeProbs(homeLambda, awayLambda, maxGoals = 7){
  let homeProb = 0, drawProb = 0, awayProb = 0;
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
function computeOver25Prob(homeLambda, awayLambda, maxGoals=7){
  let pLe2 = 0;
  for(let i=0;i<=2;i++){
    const ph = poisson(i, homeLambda);
    for(let j=0;j<=2;j++){
      if(i+j<=2) pLe2 += ph * poisson(j, awayLambda);
    }
  }
  return +(1 - pLe2).toFixed(4);
}
function computeBTTSProb(homeLambda, awayLambda){
  const pHomeAtLeast1 = 1 - poisson(0, homeLambda);
  const pAwayAtLeast1 = 1 - poisson(0, awayLambda);
  return +(pHomeAtLeast1 * pAwayAtLeast1).toFixed(4);
}
function safeNumber(x, fallback=0.9){
  const n = Number(x);
  if(Number.isFinite(n)) return n;
  return fallback;
}

// ----- Helfer zum Parsen verschiedener API-Strukturen -----
async function fetchMatches(url){
  const res = await fetch(url, { headers: { Authorization: `Bearer ${API_KEY}` } });
  if(!res.ok){
    const txt = await res.text().catch(()=>null);
    throw new Error(`API Fehler ${res.status} ${res.statusText} - ${String(txt).slice(0,200)}`);
  }
  const data = await res.json().catch(()=>null);
  if(!data) return [];
  if(Array.isArray(data)) return data;
  if(Array.isArray(data.response)) return data.response;
  if(Array.isArray(data.data)) return data.data;
  if(data.data?.matches) return data.data.matches;
  if(data.matches) return data.matches;
  // unknown structure
  console.warn("⚠️ Unerwartete API Struktur:", Object.keys(data));
  return [];
}

function mapMatch(m, date){
  // Extract xG candidates from possible fields
  const homeXGRaw = m.stats?.home_xg ?? m.stats?.home?.xG ?? m.home_xg ?? m.home_xg_estimate ?? m.probabilities?.home_xg ?? null;
  const awayXGRaw = m.stats?.away_xg ?? m.stats?.away?.xG ?? m.away_xg ?? m.away_xg_estimate ?? m.probabilities?.away_xg ?? null;
  const homeXG = homeXGRaw != null ? safeNumber(homeXGRaw, 1.05) : +(0.8 + Math.random()*1.6).toFixed(2);
  const awayXG = awayXGRaw != null ? safeNumber(awayXGRaw, 0.95) : +(0.6 + Math.random()*1.6).toFixed(2);

  // compute probs from xG
  const probs = computeMatchOutcomeProbs(homeXG, awayXG);
  const over25 = computeOver25Prob(homeXG, awayXG);
  const btts = computeBTTSProb(homeXG, awayXG);

  // value: if API provides bookmaker odds, compute value = prob * odds - 1.
  // Many endpoints won't supply odds -> we fall back to using probs as "value" ranking signals.
  // try to read common odds shapes:
  let odds = null;
  if(m.odds && typeof m.odds === "object"){
    if(m.odds.home && m.odds.draw && m.odds.away) odds = { home:+m.odds.home, draw:+m.odds.draw, away:+m.odds.away };
    else if(Array.isArray(m.odds.markets)){
      const market = m.odds.markets.find(x=>x.key==="1X2") || m.odds.markets[0];
      if(market?.outcomes){
        const o = {};
        for(const oc of market.outcomes){
          const name = (oc.name||"").toLowerCase();
          if(name.includes("home")||name.includes("1")) o.home=+oc.price;
          else if(name.includes("draw")||name.includes("x")) o.draw=+oc.price;
          else if(name.includes("away")||name.includes("2")) o.away=+oc.price;
        }
        if(o.home && o.draw && o.away) odds = o;
      }
    }
  }
  if(!odds && Array.isArray(m.bookmakers) && m.bookmakers.length){
    const b = m.bookmakers[0];
    const mk = b.markets?.find(x=>x.key==="1X2") || b.markets?.[0];
    if(mk && Array.isArray(mk.outcomes)){
      const o={};
      for(const oc of mk.outcomes){
        const name=(oc.name||"").toLowerCase();
        if(name.includes("home")||name.includes("1")) o.home=+oc.price;
        else if(name.includes("draw")||name.includes("x")) o.draw=+oc.price;
        else if(name.includes("away")||name.includes("2")) o.away=+oc.price;
      }
      if(o.home&&o.draw&&o.away) odds=o;
    }
  }

  let value = { home: null, draw: null, away: null, over25: null, under25: null };
  if(odds){
    value.home = +(probs.home * odds.home - 1).toFixed(4);
    value.draw = +(probs.draw * odds.draw - 1).toFixed(4);
    value.away = +(probs.away * odds.away - 1).toFixed(4);
    if(odds.over25) value.over25 = +(over25 * odds.over25 - 1).toFixed(4);
    if(odds.under25) value.under25 = +((1-over25) * odds.under25 - 1).toFixed(4);
  } else {
    // no bookmaker odds -> use probabilities as ranking values (not monetary EV)
    value.home = probs.home;
    value.draw = probs.draw;
    value.away = probs.away;
    value.over25 = over25;
    value.under25 = +(1 - over25).toFixed(4);
  }

  // assemble normalized object
  return {
    id: m.id || m.fixture_id || m.match_id || Math.random().toString(36).slice(2,9),
    league: m.league?.name || m.competition?.name || m.league_name || "Unbekannt",
    date: m.date || m.match_start || m.utc_date || date,
    home: m.home_team?.name || m.home?.name || m.home_name || "Heim",
    away: m.away_team?.name || m.away?.name || m.away_name || "Gast",
    homeLogo: m.home_team?.logo || m.home?.logo || "",
    awayLogo: m.away_team?.logo || m.away?.logo || "",
    homeXG: +homeXG,
    awayXG: +awayXG,
    prob: { home: probs.home, draw: probs.draw, away: probs.away, over25, btts },
    value,
    odds: odds || null,
    btts,
    trend: probs.home > probs.away ? "home" : probs.away > probs.home ? "away" : "neutral"
  };
}

// ----- Endpoint: Spiele nach Datum -----
app.get("/api/games", async (req, res) => {
  const date = req.query.date || new Date().toISOString().split("T")[0];
  const key = `games-${date}`;
  if(cache[key] && Date.now() - cache[key].time < CACHE_TIME) {
    return res.json(cache[key].data);
  }
  try {
    console.log(`📅 Lade Spiele für ${date}`);
    const matches = await fetchMatches(`https://sportsapi360.com/api/soccer/matches?date=${date}`);
    const mapped = matches.map(m => mapMatch(m, date));
    const response = { response: mapped };
    cache[key] = { time: Date.now(), data: response };
    res.json(response);
  } catch(err){
    console.error("❌ Fehler /api/games:", err.message);
    res.status(500).json({ response: [], error: err.message });
  }
});

// ----- Endpoint: Live-Spiele -----
app.get("/api/live", async (req, res) => {
  try {
    console.log("📺 Lade Live-Spiele");
    const matches = await fetchMatches("https://sportsapi360.com/api/soccer/matches?live=1");
    const mapped = matches.map(m => mapMatch(m, new Date().toISOString().split("T")[0]));
    res.json({ response: mapped });
  } catch(err){
    console.error("❌ Fehler /api/live:", err.message);
    res.status(500).json({ response: [], error: err.message });
  }
});

app.listen(PORT, () => console.log(`🚀 Server läuft auf Port ${PORT} (SportsAPI360 aktiv)`));

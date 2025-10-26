/**
 * server.js
 * Hybrid backend:
 * - fetch matches from football-data.org (requires FOOTBALL_DATA_API_KEY)
 * - try to enrich each match with real xG from Understat (no key required)
 * - if Understat lookup fails, fall back to generated xG values
 * - produces prob/value/btts/trend and top lists
 *
 * Notes:
 * - Optional env: XG_API_URL (if you already run a separate xG provider) will be used first
 * - Understat scraping: fetch team pages, parse embedded matches JSON and find the match by opponent+date
 */

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

let cache = { timestamp: 0, data: [] };
const CACHE_DURATION = 15 * 60 * 1000; // 15 min cache

const LEAGUE_IDS = {
  "Premier League": 2021,
  "Bundesliga": 2002,
  "La Liga": 2014,
  "Serie A": 2019,
  "Ligue 1": 2015
};

/* ----------------- util/helpers ----------------- */

function slugify(name) {
  if (!name) return "";
  // basic slugify: remove diacritics (approx), lower, replace non-alnum by hyphen
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
             .replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();
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
  return Math.pow(lambda, k) * Math.exp(-lambda) / factorial(k);
}
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
  const total = homeProb + drawProb + awayProb;
  return {
    home: +(homeProb/total).toFixed(4),
    draw: +(drawProb/total).toFixed(4),
    away: +(awayProb/total).toFixed(4)
  };
}
function computeOver25Prob(homeLambda, awayLambda){
  // P(total goals >= 3) = 1 - P(total <= 2)
  let pLe2 = 0;
  for(let i=0;i<=2;i++){
    for(let j=0;j<=2;j++){
      pLe2 += poisson(i, homeLambda) * poisson(j, awayLambda);
    }
  }
  return +(1 - pLe2).toFixed(4);
}

/* ----------------- Understat scraping -----------------
Strategy:
- For a given home & away & date (YYYY-MM-DD) we attempt:
  1) Fetch Understat team page for home (https://understat.com/team/{homeSlug})
  2) Parse embedded JS: var matchesData = JSON.parse('...');  (matches data is an escaped JSON string)
  3) Find an entry where opponent matches away team and date matches
  4) If not found, try same for away team page
- If found, return { homeXG, awayXG }
- If fails, throw error so caller can fallback to random xG
Note: Understat encodes JSON as escaped string inside JS. We unescape carefully.
-------------------------------------------------- */

async function fetchUnderstatForTeam(teamName) {
  const teamSlug = slugify(teamName);
  if(!teamSlug) throw new Error("empty slug");
  const url = `https://understat.com/team/${teamSlug}`;
  const res = await fetch(url, { headers: { "User-Agent": "xg-value-tool/1.0" } });
  if(!res.ok) throw new Error(`Understat team page ${res.status}`);
  const text = await res.text();

  // Find the matches JSON: typically: var matchesData = JSON.parse('...'); or "matchesData = JSON.parse('...')"
  const re = /matchesData\s*=\s*JSON\.parse\('([\s\S]*?)'\)/m;
  const m = text.match(re);
  if(!m) throw new Error("matchesData not found on team page");
  let jsonEscaped = m[1];

  // Unescape sequence: the JSON inside is escaped (\' for single quote, \\ for backslash)
  // Replace sequences so we can parse
  try {
    // Replace escaped single quotes and escaped newlines
    jsonEscaped = jsonEscaped.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    const parsed = JSON.parse(jsonEscaped);
    return parsed; // array of matches objects (Understat structure)
  } catch(err){
    throw new Error("Failed to parse matchesData JSON: " + err.message);
  }
}

function extractXGFromUnderstatMatchObj(obj, homeName, awayName) {
  // Understat match object has fields. Typical fields include: h, a (team titles) or h_team/a_team and h_xG/a_xG
  // We'll attempt multiple property names to be robust.
  const homeTitle = (obj.h && obj.h.title) || obj.h_team || obj.home || obj.home_title;
  const awayTitle = (obj.a && obj.a.title) || obj.a_team || obj.away || obj.away_title;

  // xG fields
  const homeXG = obj.h_xG ?? obj.hxG ?? obj.h_xg ?? obj.home_xg ?? obj.h_xG_avg ?? null;
  const awayXG = obj.a_xG ?? obj.axG ?? obj.a_xg ?? obj.away_xg ?? obj.a_xG_avg ?? null;

  // Understat sometimes stores strings; coerce:
  const hx = homeXG != null ? parseFloat(homeXG) : null;
  const ax = awayXG != null ? parseFloat(awayXG) : null;

  // verify names match plausibly
  const n1 = (''+homeTitle).toLowerCase();
  const n2 = (''+awayTitle).toLowerCase();

  const matchesHome = n1.includes(homeName.toLowerCase()) || homeName.toLowerCase().includes(n1);
  const matchesAway = n2.includes(awayName.toLowerCase()) || awayName.toLowerCase().includes(n2);

  if((hx != null && !Number.isNaN(hx)) && (ax != null && !Number.isNaN(ax)) && matchesHome && matchesAway) {
    return { homeXG: +hx.toFixed(2), awayXG: +ax.toFixed(2) };
  }
  // If names don't match strictly, still allow if xG fields exist
  if((hx != null && !Number.isNaN(hx)) && (ax != null && !Number.isNaN(ax))) {
    return { homeXG: +hx.toFixed(2), awayXG: +ax.toFixed(2) };
  }
  return null;
}

async function tryUnderstatLookup(home, away, dateYYYYMMDD) {
  // Try home team page first
  try {
    const matches = await fetchUnderstatForTeam(home);
    for(const obj of matches){
      try {
        // Understat match object often has 'formatted_date' or 'date' fields: check for date match
        const objDate = obj.date ? obj.date.split('T')[0] : (obj.formatted_date ? obj.formatted_date : null);
        if(objDate && dateYYYYMMDD && !objDate.startsWith(dateYYYYMMDD)) continue;
        const xg = extractXGFromUnderstatMatchObj(obj, home, away);
        if(xg) return xg;
      } catch(e) { continue; }
    }
  } catch(e){ /* ignore */ }

  // Try away team page
  try {
    const matches2 = await fetchUnderstatForTeam(away);
    for(const obj of matches2){
      try {
        const objDate = obj.date ? obj.date.split('T')[0] : (obj.formatted_date ? obj.formatted_date : null);
        if(objDate && dateYYYYMMDD && !objDate.startsWith(dateYYYYMMDD)) continue;
        const xg = extractXGFromUnderstatMatchObj(obj, home, away);
        if(xg) return xg;
      } catch(e) { continue; }
    }
  } catch(e){ /* ignore */ }

  throw new Error("Understat lookup failed");
}

/* ----------------- fetch matches from football-data.org & enrich ----------------- */

async function fetchGamesFromAPI(){
  if(!FOOTBALL_DATA_KEY) return [];
  const headers = { "X-Auth-Token": FOOTBALL_DATA_KEY };
  const allGames = [];

  for(const [leagueName, id] of Object.entries(LEAGUE_IDS)){
    try {
      const url = `https://api.football-data.org/v4/competitions/${id}/matches?status=SCHEDULED`;
      const res = await fetch(url, { headers });
      if(!res.ok){
        console.warn(`football-data response ${res.status} for ${leagueName}`);
        continue;
      }
      const data = await res.json();
      if(!data.matches || !Array.isArray(data.matches)) continue;

      for(const m of data.matches){
        const matchDate = m.utcDate ? m.utcDate.split("T")[0] : undefined;
        let homeXG = null, awayXG = null;

        // 1) If external XG API configured, call it first
        if(XG_API_URL){
          try {
            const u = new URL(XG_API_URL);
            u.searchParams.set("home", m.homeTeam?.name || "");
            u.searchParams.set("away", m.awayTeam?.name || "");
            if(matchDate) u.searchParams.set("date", matchDate);
            const h = {};
            if(XG_API_KEY) h["Authorization"] = `Bearer ${XG_API_KEY}`;
            const xr = await fetch(u.toString(), { headers: h, timeout: 8000 });
            if(xr.ok){
              const j = await xr.json();
              if(typeof j.homeXG === "number" && typeof j.awayXG === "number"){
                homeXG = +j.homeXG;
                awayXG = +j.awayXG;
              }
            }
          } catch(e){
            console.warn("External XG API failed:", e.message);
          }
        }

        // 2) Try Understat
        if(homeXG == null || awayXG == null){
          try {
            const xg = await tryUnderstatLookup(m.homeTeam?.name || "", m.awayTeam?.name || "", matchDate);
            homeXG = xg.homeXG;
            awayXG = xg.awayXG;
          } catch(e){
            // Understat could fail for various reasons; we'll fallback below
            // console.warn("Understat lookup failed:", e.message);
          }
        }

        // 3) Fallback generated xG if we still don't have real xG
        if(homeXG == null || awayXG == null){
          homeXG = +(0.8 + Math.random()*1.6).toFixed(2);
          awayXG = +(0.6 + Math.random()*1.6).toFixed(2);
        }

        const totalXG = +(homeXG + awayXG).toFixed(2);

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

        // Trend logic
        let trend = "neutral";
        const mainValue = Math.max(value.home, value.draw, value.away);
        if(mainValue > 0.12 && prob.home > prob.away && prob.home > prob.draw) trend = "home";
        else if(mainValue > 0.12 && prob.away > prob.home && prob.away > prob.draw) trend = "away";
        else if(Math.abs(prob.home - prob.away) < 0.08 && prob.draw >= Math.max(prob.home, prob.away)) trend = "draw";

        allGamesPush:
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
      } // end for each match
    } // end try
    catch(err){
      console.error("Error fetching league", leagueName, err.message);
      continue;
    }
  } // end for leagues

  allGames.sort((a,b) => new Date(a.date) - new Date(b.date));
  return allGames;
}

/* ----------------- API route ----------------- */

app.get("/api/games", async (req, res) => {
  try {
    const now = Date.now();
    if(!cache.data.length || now - cache.timestamp > CACHE_DURATION){
      const games = await fetchGamesFromAPI();
      cache = { timestamp: now, data: games };
    }

    let filtered = cache.data.slice();
    if(req.query.date){
      const q = req.query.date;
      filtered = filtered.filter(g => g.date && g.date.startsWith(q));
    }

    const top7Value = filtered
      .slice()
      .sort((a,b) => Math.max(b.value.home,b.value.draw,b.value.away) - Math.max(a.value.home,a.value.draw,a.value.away))
      .slice(0,7)
      .map(g => ({ home:g.home, away:g.away, league:g.league, value: Number(Math.max(g.value.home,g.value.draw,g.value.away).toFixed(4)), trend:g.trend }));

    const top5Over25 = filtered
      .slice()
      .sort((a,b) => b.value.over25 - a.value.over25)
      .slice(0,5)
      .map(g => ({ home:g.home, away:g.away, league:g.league, value: Number(g.value.over25.toFixed(4)), trend:g.trend }));

    return res.json({ response: filtered, top7Value, top5Over25 });
  } catch(err){
    console.error("API error", err);
    return res.status(500).json({ response: [], top7Value: [], top5Over25: [], error: err.message });
  }
});

/* ----------------- serve frontend ----------------- */
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));

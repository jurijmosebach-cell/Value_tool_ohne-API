// app.js – rendert Top3, Top7 Value, Top5 Over2.5, Alle Spiele und Live
const top3Div = document.getElementById("top3");
const top7ValueDiv = document.getElementById("top7Value");
const top5OverDiv = document.getElementById("top5Over25");
const gamesDiv = document.getElementById("games");
const liveDiv = document.getElementById("liveGames");
const loadBtn = document.getElementById("loadBtn");
const liveBtn = document.getElementById("liveBtn");
const dateInput = document.getElementById("date");
const leagueSelect = document.getElementById("league");
const teamInput = document.getElementById("team");

// Create bar helper
function createBar(label, value, color){
  const wrap = document.createElement("div");
  wrap.className = "bar-container";
  const bar = document.createElement("div");
  bar.className = "bar";
  const pct = Math.round((value || 0) * 100);
  bar.style.width = `${pct}%`;
  bar.style.background = color;
  bar.textContent = `${label} ${pct}%`;
  wrap.appendChild(bar);
  return wrap;
}

function getTrafficColor(val){
  if(val >= 0.6) return "#16a34a";
  if(val >= 0.4) return "#f59e0b";
  return "#ef4444";
}

function renderLists(allGames){
  // populate league select
  const leagues = Array.from(new Set(allGames.map(g=>g.league).filter(Boolean))).sort();
  leagueSelect.innerHTML = '<option value="">Alle Ligen</option>' + leagues.map(l=>`<option>${l}</option>`).join("");

  // apply filters
  let games = allGames.slice();
  if(leagueSelect.value) games = games.filter(g=>g.league===leagueSelect.value);
  if(teamInput.value){
    const q = teamInput.value.toLowerCase();
    games = games.filter(g=>g.home.toLowerCase().includes(q) || g.away.toLowerCase().includes(q));
  }

  // top 3 by max value(1X2)
  games.sort((a,b)=>Math.max(b.value.home,b.value.draw,b.value.away)-Math.max(a.value.home,a.value.draw,a.value.away));
  const top3 = games.slice(0,3);
  const top7 = games.slice(0,7);
  const top5Over = games.slice().sort((a,b)=>b.value.over25 - a.value.over25).slice(0,5);
  const others = games.slice(3);

  // render top3
  top3Div.innerHTML = "";
  top3.forEach(g=>{
    const div = document.createElement("div");
    div.className = "game";
    const best = Math.max(g.value.home,g.value.draw,g.value.away);
    div.style.borderLeft = `6px solid ${getTrafficColor(best)}`;
    div.innerHTML = `<div><img src="${g.homeLogo}" alt=""> <strong>${g.home}</strong> vs <img src="${g.awayLogo}" alt=""> <strong>${g.away}</strong> (${g.league})</div>
      <div style="font-size:0.9rem;color:#9ca3af">Datum: ${new Date(g.date).toLocaleString()}</div>`;
    div.appendChild(createBar("Home", g.value.home, "#4caf50"));
    div.appendChild(createBar("Draw", g.value.draw, "#f59e0b"));
    div.appendChild(createBar("Away", g.value.away, "#ef4444"));
    div.appendChild(createBar("Over 2.5", g.value.over25, "#2196f3"));
    div.appendChild(createBar("BTTS", g.btts, "#ff7a00"));
    top3Div.appendChild(div);
  });

  // top7 value
  top7ValueDiv.innerHTML = "";
  top7.forEach(g=>{
    const div = document.createElement("div");
    div.className = "game";
    const best = Math.max(g.value.home,g.value.draw,g.value.away);
    div.style.borderLeft = `6px solid ${getTrafficColor(best)}`;
    div.textContent = `${g.home} vs ${g.away} (${g.league}) → Value ${(best).toFixed(3)}`;
    top7ValueDiv.appendChild(div);
  });

  // top5 over
  top5OverDiv.innerHTML = "";
  top5Over.forEach(g=>{
    const div = document.createElement("div");
    div.className = "game";
    div.style.borderLeft = `6px solid #2196f3`;
    div.textContent = `${g.home} vs ${g.away} (${g.league}) → Over2.5 ${(g.value.over25*100).toFixed(1)}%`;
    top5OverDiv.appendChild(div);
  });

  // all games
  gamesDiv.innerHTML = "";
  games.forEach(g=>{
    const div = document.createElement("div");
    div.className = "game";
    const best = Math.max(g.value.home,g.value.draw,g.value.away);
    div.style.borderLeft = `6px solid ${getTrafficColor(best)}`;
    div.innerHTML = `<div><img src="${g.homeLogo}"> <strong>${g.home}</strong> vs <img src="${g.awayLogo}"> <strong>${g.away}</strong> (${g.league})</div>
      <div style="font-size:0.9rem;color:#9ca3af">Datum: ${new Date(g.date).toLocaleString()}</div>`;
    div.appendChild(createBar("Home", g.value.home, "#4caf50"));
    div.appendChild(createBar("Draw", g.value.draw, "#f59e0b"));
    div.appendChild(createBar("Away", g.value.away, "#ef4444"));
    div.appendChild(createBar("Over 2.5", g.value.over25, "#2196f3"));
    div.appendChild(createBar("BTTS", g.btts, "#ff7a00"));
    gamesDiv.appendChild(div);
  });
}

async function loadGames(date){
  try{
    const res = await fetch(`/api/games?date=${date}`);
    const json = await res.json();
    if(!json || !Array.isArray(json.response)) {
      console.error("Ungültige API-Antwort", json);
      return;
    }
    renderLists(json.response);
  }catch(e){
    console.error("Fehler beim Laden:", e);
  }
}

async function loadLive(){
  try{
    const res = await fetch(`/api/live`);
    const json = await res.json();
    liveDiv.innerHTML = "";
    if(!json || !Array.isArray(json.response) || json.response.length===0){
      liveDiv.innerHTML = "<div class='game'>Keine Live-Spiele</div>";
      return;
    }
    json.response.forEach(g=>{
      const div = document.createElement("div");
      div.className = "game";
      div.innerHTML = `<div><strong>${g.league}</strong></div>
        <div><img src="${g.homeLogo}">${g.home} vs <img src="${g.awayLogo}">${g.away}</div>
        <div style="font-size:0.9rem;color:#9ca3af">${g.minute?g.minute+"'":""} ${g.score? `${g.score.home}:${g.score.away}`:""}</div>`;
      liveDiv.appendChild(div);
    });
  }catch(e){
    console.error("Fehler Live:", e);
    liveDiv.innerHTML = "<div class='game'>Fehler beim Laden der Live-Spiele.</div>";
  }
}

// event listeners
loadBtn.addEventListener("click", ()=>{
  const d = dateInput.value || new Date().toISOString().split("T")[0];
  loadGames(d);
});
liveBtn.addEventListener("click", loadLive);
leagueSelect.addEventListener("change", ()=>{
  const d = dateInput.value || new Date().toISOString().split("T")[0];
  loadGames(d);
});
teamInput.addEventListener("input", ()=>{
  const d = dateInput.value || new Date().toISOString().split("T")[0];
  loadGames(d);
});

window.addEventListener("load", ()=>{
  const today = new Date().toISOString().split("T")[0];
  dateInput.value = today;
  loadGames(today);
});

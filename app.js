const top3Div = document.getElementById("top3");
const top7ValueDiv = document.getElementById("top7Value");
const top5OverDiv = document.getElementById("top5Over25");
const gamesDiv = document.getElementById("games");
const loadBtn = document.getElementById("loadBtn");
const dateInput = document.getElementById("date");
const leagueSelect = document.getElementById("league");
const teamInput = document.getElementById("team");

function getTrafficColor(value, trend){
  if(value>0.15 && (trend==='home'||trend==='away')) return '#4caf50';
  if(value>0) return '#ffc107';
  return '#f44336';
}

async function loadGames(){
  let url = "/api/games";
  if(dateInput.value) url += "?date="+dateInput.value;
  const res = await fetch(url);
  const data = await res.json();
  let games = data.response;

  if(leagueSelect.value) games = games.filter(g=>g.league===leagueSelect.value);
  if(teamInput.value) games = games.filter(g=>g.home.toLowerCase().includes(teamInput.value.toLowerCase()) || g.away.toLowerCase().includes(teamInput.value.toLowerCase()));

  // Sortiere nach Value
  games.sort((a,b)=>Math.max(b.value.home,b.value.draw,b.value.away)-Math.max(a.value.home,a.value.draw,a.value.away));

  // Top 3 Spiele
  const topGames = games.slice(0,3);
  const otherGames = games.slice(3);

  top3Div.innerHTML="";
  topGames.forEach(g=>{
    const div=document.createElement("div");
    div.className="game top3";
    const dateObj = new Date(g.date);
    const color = getTrafficColor(Math.max(g.value.home,g.value.draw,g.value.away), g.trend);
    div.style.borderLeft = `5px solid ${color}`;
    div.innerHTML=`
      <div><strong>${g.home}</strong> vs <strong>${g.away}</strong> (${g.league}) - ${dateObj.toLocaleString()}</div>
      <div class="team"><img src="${g.homeLogo}" width="24" height="18">${g.home} xG:${g.homeXG} | Trend:${g.trend}</div>
      <div class="team"><img src="${g.awayLogo}" width="24" height="18">${g.away} xG:${g.awayXG} | Trend:${g.trend}</div>
    `;
    top3Div.appendChild(div);
  });

  // Top 7 Value
  top7ValueDiv.innerHTML="";
  const top7 = games.slice(0,7);
  top7.forEach(g=>{
    const div=document.createElement("div");
    const color = getTrafficColor(Math.max(g.value.home,g.value.draw,g.value.away), g.trend);
    div.className="game";
    div.style.borderLeft = `5px solid ${color}`;
    div.textContent = `${g.home} vs ${g.away} (${g.league}) → Value ${Math.max(g.value.home,g.value.draw,g.value.away).toFixed(2)} | Trend: ${g.trend}`;
    top7ValueDiv.appendChild(div);
  });

  // Top 5 Over2.5
  top5OverDiv.innerHTML="";
  const top5Over = games.sort((a,b)=>b.value.over25-a.value.over25).slice(0,5);
  top5Over.forEach(g=>{
    const div=document.createElement("div");
    div.className="game";
    div.style.borderLeft = `5px solid #2196f3`;
    div.textContent = `${g.home} vs ${g.away} (${g.league}) → Over2.5 Value ${g.value.over25.toFixed(2)}`;
    top5OverDiv.appendChild(div);
  });

  // Restliche Spiele
  gamesDiv.innerHTML="";
  otherGames.forEach(g=>{
    const div=document.createElement("div");
    div.className="game";
    const dateObj = new Date(g.date);
    const color = getTrafficColor(Math.max(g.value.home,g.value.draw,g.value.away), g.trend);
    div.style.borderLeft = `5px solid ${color}`;
    div.innerHTML=`
      <div><strong>${g.home}</strong> vs <strong>${g.away}</strong> (${g.league}) - ${dateObj.toLocaleString()}</div>
      <div class="team"><img src="${g.homeLogo}" width="24" height="18">${g.home} xG:${g.homeXG} | Trend:${g.trend}</div>
      <div class="team"><img src="${g.awayLogo}" width="24" height="18">${g.away} xG:${g.awayXG} | Trend:${g.trend}</div>
      <div class="bar-container"><div class="bar home-bar" style="width:${g.value.home*100}%"></div></div>
      <div class="bar-container"><div class="bar draw-bar" style="width:${g.value.draw*100}%"></div></div>
      <div class="bar-container"><div class="bar away-bar" style="width:${g.value.away*100}%"></div></div>
      <div class="bar-container"><div class="bar over25-bar" style="width:${g.value.over25*100}%"></div></div>
      <div class="bar-container"><div class="bar under25-bar" style="width:${g.value.under25*100}%"></div></div>
      <div class="bar-container"><div class="bar btts-bar" style="width:${g.btts*100}%"></div></div>
    `;
    gamesDiv.appendChild(div);
  });
}

loadBtn.addEventListener("click", loadGames);
window.addEventListener("load", loadGames);

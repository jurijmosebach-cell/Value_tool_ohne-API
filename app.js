function createBar(label, value, color){
  const container = document.createElement("div");
  container.className = "bar-container";

  const bar = document.createElement("div");
  bar.className = "bar";
  bar.style.width = `${value*100}%`;
  bar.style.background = color;

  // Label innerhalb des Balkens
  bar.textContent = `${label} ${Math.round(value*100)}%`;
  bar.style.color = "#fff";
  bar.style.fontSize = "12px";
  bar.style.fontWeight = "bold";
  bar.style.paddingLeft = "4px";

  container.appendChild(bar);
  return container;
}

async function loadGames(){
  let url = "/api/games";
  if(dateInput.value) url += "?date="+dateInput.value;
  const res = await fetch(url);
  const data = await res.json();
  let games = data.response;

  // Filter
  if(leagueSelect.value) games = games.filter(g=>g.league===leagueSelect.value);
  if(teamInput.value) games = games.filter(g=>g.home.toLowerCase().includes(teamInput.value.toLowerCase()) || g.away.toLowerCase().includes(teamInput.value.toLowerCase()));

  games.sort((a,b)=>Math.max(b.value.home,b.value.draw,b.value.away)-Math.max(a.value.home,a.value.draw,a.value.away));
  const topGames = games.slice(0,3);
  const otherGames = games.slice(3);

  // Top 3 Spiele
  top3Div.innerHTML="";
  topGames.forEach(g=>{
    const div=document.createElement("div");
    div.className="game top3";
    const dateObj = new Date(g.date);
    div.style.borderLeft = `5px solid #4caf50`;

    div.innerHTML=`
      <div><strong>${g.home}</strong> vs <strong>${g.away}</strong> (${g.league}) - ${dateObj.toLocaleString()}</div>
      <div class="team"><img src="${g.homeLogo}" width="24" height="18">${g.home} xG:${g.homeXG} | Trend:${g.trend}</div>
      <div class="team"><img src="${g.awayLogo}" width="24" height="18">${g.away} xG:${g.awayXG} | Trend:${g.trend}</div>
    `;

    // Balken hinzufügen
    div.appendChild(createBar("Home", g.value.home, "#4caf50"));
    div.appendChild(createBar("Draw", g.value.draw, "#ffc107"));
    div.appendChild(createBar("Away", g.value.away, "#f44336"));
    div.appendChild(createBar("Over 2.5", g.value.over25, "#2196f3"));
    div.appendChild(createBar("Under 2.5", g.value.under25, "#9c27b0"));
    div.appendChild(createBar("BTTS", g.btts, "#ff5722"));

    top3Div.appendChild(div);
  });

  // Restliche Spiele
  gamesDiv.innerHTML="";
  otherGames.forEach(g=>{
    const div=document.createElement("div");
    div.className="game";
    const dateObj = new Date(g.date);
    div.style.borderLeft = `5px solid #ccc`;

    div.innerHTML=`
      <div><strong>${g.home}</strong> vs <strong>${g.away}</strong> (${g.league}) - ${dateObj.toLocaleString()}</div>
      <div class="team"><img src="${g.homeLogo}" width="24" height="18">${g.home} xG:${g.homeXG} | Trend:${g.trend}</div>
      <div class="team"><img src="${g.awayLogo}" width="24" height="18">${g.away} xG:${g.awayXG} | Trend:${g.trend}</div>
    `;

    // Balken hinzufügen
    div.appendChild(createBar("Home", g.value.home, "#4caf50"));
    div.appendChild(createBar("Draw", g.value.draw, "#ffc107"));
    div.appendChild(createBar("Away", g.value.away, "#f44336"));
    div.appendChild(createBar("Over 2.5", g.value.over25, "#2196f3"));
    div.appendChild(createBar("Under 2.5", g.value.under25, "#9c27b0"));
    div.appendChild(createBar("BTTS", g.btts, "#ff5722"));

    gamesDiv.appendChild(div);
  });
}

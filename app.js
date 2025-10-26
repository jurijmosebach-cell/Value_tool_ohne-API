async function loadGames(){
  const res = await fetch("/api/games");
  const data = await res.json();
  const gamesContainer = document.getElementById("games-container");
  gamesContainer.innerHTML = "";

  // Alle Spiele
  data.response.forEach(g=>{
    const div = document.createElement("div");
    div.className = "game-card";
    div.innerHTML = `
      <div class="teams">
        <img src="${g.homeLogo}" alt="" class="logo">
        <span>${g.home}</span>
        <span>vs</span>
        <img src="${g.awayLogo}" alt="" class="logo">
        <span>${g.away}</span>
      </div>
      <div class="date">Datum: ${new Date(g.date).toLocaleString()}</div>
      <div class="xg">xG: ${g.homeXG} — ${g.awayXG}</div>
      <div class="balken">
        <div class="bar home" style="width:${Math.max(g.value.home,0)*100}%">Home: ${g.value.home}</div>
        <div class="bar draw" style="width:${Math.max(g.value.draw,0)*100}%">Draw: ${g.value.draw}</div>
        <div class="bar away" style="width:${Math.max(g.value.away,0)*100}%">Away: ${g.value.away}</div>
        <div class="bar over" style="width:${Math.max(g.value.over25,0)*100}%">Over 2.5: ${g.value.over25}</div>
        <div class="bar under" style="width:${Math.max(g.value.under25,0)*100}%">Under 2.5: ${g.value.under25}</div>
        <div class="bar btts" style="width:${g.btts*100}%">BTTS: ${g.btts}</div>
      </div>
      <div class="trend">Trend: ${g.trend}</div>
    `;
    gamesContainer.appendChild(div);
  });

  // Top 7 Value
  const topValue = document.getElementById("top-value");
  topValue.innerHTML = "";
  data.top7Value.forEach(g=>{
    const div = document.createElement("div");
    div.textContent = `${g.home} vs ${g.away} → ${Math.max(g.value.home,g.value.draw,g.value.away)}`;
    topValue.appendChild(div);
  });

  // Top 5 Over
  const topOver = document.getElementById("top-over");
  topOver.innerHTML = "";
  data.top5Over25.forEach(g=>{
    const div = document.createElement("div");
    div.textContent = `${g.home} vs ${g.away} → Value ${g.value.over25}`;
    topOver.appendChild(div);
  });
}

// Direkt laden beim Start
loadGames();

// Optional: Automatisch alle 5 Minuten aktualisieren
setInterval(loadGames, 5*60*1000);

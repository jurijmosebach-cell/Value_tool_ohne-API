const topValue = document.getElementById("topValue");
const topOver = document.getElementById("topOver");
const gamesDiv = document.getElementById("games");
const loadBtn = document.getElementById("loadBtn");
const dateInput = document.getElementById("date");

async function loadGames(){
  const date = dateInput.value;
  const res = await fetch(`/api/games${date ? "?date="+date : ""}`);
  const data = await res.json();

  topValue.innerHTML="";
  data.top7Value.forEach(g=>{
    const div = document.createElement("div");
    div.textContent = `${g.home} vs ${g.away} (${g.league}) → Value ${g.value} | Trend: ${g.trend}`;
    topValue.appendChild(div);
  });

  topOver.innerHTML="";
  data.top5Over25.forEach(g=>{
    const div = document.createElement("div");
    div.textContent = `${g.home} vs ${g.away} (${g.league}) → Over 2.5 Value ${g.value} | Trend: ${g.trend}`;
    topOver.appendChild(div);
  });

  gamesDiv.innerHTML="";
  data.response.forEach(g=>{
    const div = document.createElement("div");
    div.className="game";
    const dateObj = new Date(g.date);
    div.innerHTML=`
      <div><strong>${g.home}</strong> vs <strong>${g.away}</strong> (${g.league}) - ${dateObj.toLocaleString()}</div>
      <div class="team">
        <img src="${g.homeLogo}" width="24" height="18">${g.home} xG:${g.homeXG} | Trend:${g.trend}
      </div>
      <div class="team">
        <img src="${g.awayLogo}" width="24" height="18">${g.away} xG:${g.awayXG} | Trend:${g.trend}
      </div>
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

loadBtn.addEventListener("click",loadGames);
window.addEventListener("load",loadGames);
